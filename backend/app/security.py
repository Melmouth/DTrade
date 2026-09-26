"""Authentication, CSRF, bounded sessions and transport resource limits.

Single process / single owner. Reverse proxies must also bound connections and
request timeouts. Never trust forwarded client IPs as an authentication boundary.
"""
import asyncio
from collections import deque
import hashlib
from http.cookies import SimpleCookie
import secrets
import time

from starlette.datastructures import Headers
from starlette.responses import JSONResponse

COOKIE = "dtrade_session"

class SecurityState:
    def __init__(self, settings):
        self.settings = settings
        self.sessions = {}
        self.requests = {"anonymous": deque(), "authenticated": deque(), "login": deque(), "websocket": deque()}
        self.websockets = 0

    def allow(self, bucket, limit):
        now = time.monotonic()
        times = self.requests[bucket]
        while times and times[0] <= now - 60:
            times.popleft()
        if len(times) >= limit:
            return False
        times.append(now)
        return True

    def matches_key(self, value):
        return secrets.compare_digest(hashlib.sha256(value.encode()).digest(), hashlib.sha256(self.settings.access_token.encode()).digest())

    def prune(self):
        now = time.monotonic()
        self.sessions = {key: expiry for key, expiry in self.sessions.items() if expiry > now}

    def new_session(self):
        self.prune()
        if len(self.sessions) >= self.settings.max_sessions:
            self.sessions.pop(next(iter(self.sessions)))
        session = secrets.token_urlsafe(32)
        self.sessions[hashlib.sha256(session.encode()).hexdigest()] = time.monotonic() + self.settings.session_seconds
        return session

    def session_key(self, headers):
        try:
            cookies = SimpleCookie()
            cookies.load(headers.get("cookie", ""))
            value = cookies[COOKIE].value if COOKIE in cookies else ""
            return hashlib.sha256(value.encode()).hexdigest()
        except (ValueError, KeyError):
            return ""

    def valid(self, key):
        return self.sessions.get(key, 0) > time.monotonic()

    def bearer(self, headers):
        value = headers.get("authorization", "")
        return value.startswith("Bearer ") and len(value) <= 263 and self.matches_key(value[7:])

class SecurityMiddleware:
    def __init__(self, app, security):
        self.app, self.security = app, security

    async def __call__(self, scope, receive, send):
        kind = scope["type"]
        if kind not in {"http", "websocket"}:
            return await self.app(scope, receive, send)
        state = self.security
        headers = Headers(scope=scope)
        origin = headers.get("origin")
        session_key = state.session_key(headers)
        bearer = state.bearer(headers)
        authenticated = bearer or state.valid(session_key)
        allowed_origin = origin in state.settings.origins

        async def secure_send(message):
            if message["type"] == "http.response.start":
                message["headers"] = list(message.get("headers", [])) + [
                    (b"cache-control", b"no-store"), (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"), (b"referrer-policy", b"no-referrer"),
                    (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"),
                ]
            await send(message)

        async def reject(code, detail):
            response = JSONResponse({"detail": detail}, status_code=code,
                                    headers={"Retry-After": "60"} if code == 429 else None)
            await response(scope, receive, secure_send)

        if kind == "websocket":
            # Browsers cannot set Authorization on WebSocket; use the HttpOnly session.
            if (not allowed_origin or not state.valid(session_key)
                    or not state.allow("websocket", 30) or state.websockets >= state.settings.max_websockets):
                await send({"type": "websocket.close", "code": 1008})
                return
            state.websockets += 1
            scope.setdefault("state", {})["session_key"] = session_key
            closed = False
            async def guarded_send(message):
                nonlocal closed
                if closed:
                    return
                if message["type"] in {"websocket.accept", "websocket.send"} and not state.valid(session_key):
                    closed = True
                    await send({"type": "websocket.close", "code": 1008})
                    return
                if message["type"] == "websocket.close":
                    closed = True
                await send(message)
            try:
                await self.app(scope, receive, guarded_send)
            finally:
                state.websockets -= 1
            return

        if origin is not None and not allowed_origin:
            return await reject(403, "Origin not allowed")
        method, path = scope["method"], scope["path"]
        if method == "OPTIONS":
            if not allowed_origin:
                return await reject(403, "Origin required")
            return await self.app(scope, receive, secure_send)
        if not state.allow("authenticated" if authenticated else "anonymous", state.settings.request_limit):
            return await reject(429, "Request limit reached")
        login = path == "/api/auth/login" and method == "POST"
        if login and not state.allow("login", state.settings.login_limit):
            return await reject(429, "Login limit reached")
        if not login and not authenticated:
            return await reject(401, "Authentication required")
        if method not in {"GET", "HEAD"} and not allowed_origin and not bearer:
            return await reject(403, "Origin required")
        # Read at most 16 KiB before JSON parsing; bound slow/chunked bodies too.
        body = bytearray()
        try:
            if int(headers.get("content-length", "0")) > 16384:
                return await reject(413, "Request too large")
            async with asyncio.timeout(5):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    body.extend(message.get("body", b""))
                    if len(body) > 16384:
                        return await reject(413, "Request too large")
                    if not message.get("more_body", False):
                        break
        except (ValueError, TimeoutError):
            return await reject(400, "Invalid or incomplete request")
        sent = False
        async def replay():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()
        scope.setdefault("state", {})["session_key"] = session_key
        await self.app(scope, replay, secure_send)
