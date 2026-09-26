import asyncio
from contextlib import asynccontextmanager, suppress
import sqlite3

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware import Middleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import JSONResponse

from app.config import Settings
from app.database import configure_database, init_db
from app.routes import auth, market, indicators, watchlist, portfolio
from app.security import SecurityMiddleware, SecurityState
from app.websockets import manager
from app.worker import market_data_worker
from app.models import Ticker
from pydantic import TypeAdapter, ValidationError


def create_app(settings=None):
    settings = settings or Settings.from_env()
    security = SecurityState(settings)

    @asynccontextmanager
    async def lifespan(app):
        configure_database(settings.data_dir)
        init_db()
        import yfinance as yf
        yf.set_tz_cache_location(str(settings.data_dir / "yfinance"))
        task = asyncio.create_task(market_data_worker()) if settings.worker_enabled else None
        yield
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan, middleware=[
        Middleware(TrustedHostMiddleware, allowed_hosts=list(settings.hosts), www_redirect=False),
        Middleware(SecurityMiddleware, security=security),
        Middleware(CORSMiddleware, allow_origins=list(settings.origins), allow_credentials=True,
                   allow_methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type", "Authorization"]),
    ])
    app.state.settings, app.state.security = settings, security
    for router in (auth.router, market.router, indicators.router, watchlist.router, portfolio.router):
        app.include_router(router)

    @app.exception_handler(RequestValidationError)
    async def invalid_input(request, exc):
        # Pydantic's default errors include submitted values, including access keys.
        return JSONResponse({"detail": "Invalid request", "errors": [
            {"loc": error["loc"], "type": error["type"]} for error in exc.errors()
        ]}, status_code=422)

    @app.exception_handler(sqlite3.IntegrityError)
    async def invalid_write(request, exc):
        return JSONResponse({"detail": "Storage constraint or quota reached"}, status_code=409)

    @app.exception_handler(sqlite3.OperationalError)
    async def storage_error(request, exc):
        return JSONResponse({"detail": "Storage temporarily unavailable"}, status_code=503)

    async def socket_loop(websocket, ticker=None):
        if ticker is not None:
            try:
                TypeAdapter(Ticker).validate_python(ticker)
            except ValidationError:
                await websocket.close(code=1008)
                return
        if ticker is None:
            await manager.connect_global(websocket)
        else:
            await manager.connect(websocket, ticker)
        try:
            while security.valid(websocket.state.session_key):
                try:
                    message = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                    if len(message) > 256 or message != "ping":
                        await websocket.close(code=1008)
                        return
                    # Clients do not need to send messages; cap unsolicited heartbeats.
                    await asyncio.sleep(1)
                except TimeoutError:
                    continue
            await websocket.close(code=1008)
        except WebSocketDisconnect:
            pass
        finally:
            if ticker is None:
                manager.disconnect_global(websocket)
            else:
                manager.disconnect(websocket, ticker)

    @app.websocket("/ws/global")
    async def global_socket(websocket: WebSocket):
        await socket_loop(websocket)

    @app.websocket("/ws/{ticker}")
    async def ticker_socket(websocket: WebSocket, ticker: str):
        await socket_loop(websocket, ticker)

    return app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:create_app", factory=True, host="127.0.0.1", port=8000,
                proxy_headers=False, access_log=False, ws_max_size=1024,
                ws_max_queue=4, limit_concurrency=64, timeout_keep_alive=5)
