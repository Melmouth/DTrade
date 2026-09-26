import asyncio
from dataclasses import replace
import json
from pathlib import Path
import secrets
import socket
import sys

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import create_app
from app.config import Settings
from app.database import get_db
from app.services import market_data
from app.websockets import manager

ORIGIN = 'http://localhost:5173'

@pytest.fixture
def settings(tmp_path):
    return Settings(access_token=secrets.token_urlsafe(48), data_dir=tmp_path / 'private', worker_enabled=False)

@pytest.fixture
def client(settings, monkeypatch):
    def no_network(*args, **kwargs):
        raise AssertionError('External network is forbidden in security tests')
    monkeypatch.setattr(socket.socket, 'connect', no_network)
    monkeypatch.setattr(market_data.provider, 'fetch_live_price', lambda ticker: {'price': 100, 'is_open': True})
    monkeypatch.setattr(market_data.provider, 'fetch_bulk_1m_status', lambda tickers: {})
    with TestClient(create_app(settings), base_url='http://localhost') as c:
        yield c


def login(client, settings):
    return client.post('/api/auth/login', json={'access_key': settings.access_token}, headers={'Origin': ORIGIN})

@pytest.mark.parametrize('method,path,payload', [
    ('get', '/api/portfolio/history', None), ('get', '/api/portfolio/summary', None),
    ('get', '/api/portfolio/positions', None), ('get', '/api/watchlists/sidebar', None),
    ('get', '/api/indicators/MSFT', None), ('get', '/api/company/MSFT', None),
    ('get', '/api/snapshot/MSFT', None), ('post', '/api/portfolio/nuke', {}),
    ('post', '/api/portfolio/cash', {'type': 'DEPOSIT', 'amount': 1}),
    ('post', '/api/portfolio/order', {'action': 'BUY', 'ticker': 'MSFT', 'quantity': 1}),
    ('post', '/api/watchlists/', {'name': 'Private'}), ('delete', '/api/watchlists/1', None),
    ('delete', '/api/indicators/1', None), ('post', '/api/indicators/smart/sma', {'ticker': 'MSFT'}),
])
def test_all_sensitive_routes_reject_anonymous(client, method, path, payload):
    kwargs = {'json': payload} if payload is not None else {}
    assert getattr(client, method)(path, **kwargs).status_code == 401


def test_owner_login_cash_order_and_logout(client, settings):
    response = login(client, settings)
    assert response.status_code == 200
    cookie = response.headers['set-cookie']
    assert 'HttpOnly' in cookie and 'SameSite=strict' in cookie and 'Max-Age=28800' in cookie
    assert settings.access_token not in cookie
    client.headers['Origin'] = ORIGIN
    assert client.post('/api/portfolio/cash', json={'amount': 10, 'type': 'DEPOSIT'}).status_code == 200
    assert client.post('/api/portfolio/order', json={'action': 'BUY', 'ticker': 'MSFT', 'quantity': 1}).status_code == 200
    assert client.get('/api/portfolio/positions').json()[0]['ticker'] == 'MSFT'
    before = client.get('/api/portfolio/history').json()
    assert len(before) == 3
    assert client.post('/api/auth/logout').status_code == 200
    assert client.get('/api/portfolio/history').status_code == 401

@pytest.mark.parametrize('origin', ['https://attacker.invalid', 'null', 'http://localhost:5173.attacker.invalid'])
def test_hostile_origin_blocked_even_with_session(client, settings, origin):
    assert login(client, settings).status_code == 200
    for method, path in [('get', '/api/portfolio/history'), ('post', '/api/portfolio/nuke')]:
        r = getattr(client, method)(path, headers={'Origin': origin})
        assert r.status_code == 403
        assert 'access-control-allow-origin' not in r.headers


def test_csrf_missing_origin_and_preflight(client, settings):
    login(client, settings)
    assert client.post('/api/portfolio/nuke').status_code == 403
    r = client.options('/api/portfolio/nuke', headers={'Origin': ORIGIN, 'Access-Control-Request-Method': 'POST'})
    assert r.status_code == 200 and r.headers['access-control-allow-origin'] == ORIGIN
    assert client.options('/api/portfolio/nuke', headers={'Origin': 'https://attacker.invalid', 'Access-Control-Request-Method': 'POST'}).status_code == 403


def test_host_and_forwarded_headers_do_not_bypass_auth(client):
    assert client.get('/api/portfolio/history', headers={'Host': 'attacker.invalid'}).status_code == 400
    assert client.get('/api/portfolio/history', headers={'X-Forwarded-For': '127.0.0.1', 'X-Forwarded-Host': 'localhost'}).status_code == 401


def test_bearer_for_non_browser_client(client, settings):
    r = client.get('/api/portfolio/history', headers={'Authorization': 'Bearer ' + settings.access_token})
    assert r.status_code == 200
    assert r.headers['cache-control'] == 'no-store'
    assert r.headers['x-content-type-options'] == 'nosniff'


def test_failed_and_invalid_login_never_echoes_secret(client, settings):
    bad = secrets.token_urlsafe(48)
    for key, status in [(bad, 401), ('x', 422), (bad * 10, 422)]:
        r = client.post('/api/auth/login', json={'access_key': key}, headers={'Origin': ORIGIN})
        assert r.status_code == status
        assert key not in r.text


def test_login_rate_limit(client):
    for _ in range(5):
        assert client.post('/api/auth/login', json={'access_key': secrets.token_urlsafe(48)}, headers={'Origin': ORIGIN}).status_code == 401
    r = client.post('/api/auth/login', json={'access_key': secrets.token_urlsafe(48)}, headers={'Origin': ORIGIN})
    assert r.status_code == 429 and r.headers['retry-after'] == '60'


def test_session_expiry_and_bounded_store(client, settings):
    login(client, settings)
    state = client.app.state.security
    for key in state.sessions:
        state.sessions[key] = 0
    assert client.get('/api/portfolio/history').status_code == 401
    for _ in range(100):
        state.new_session()
    assert len(state.sessions) == settings.max_sessions

@pytest.mark.parametrize('has_login,origin', [(False, ORIGIN), (True, 'https://attacker.invalid'), (True, None)])
def test_websocket_rejects_missing_session_or_bad_origin(client, settings, has_login, origin):
    if has_login:
        login(client, settings)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect('ws://localhost/ws/global', headers={'Origin': origin} if origin else {}):
            pass
    assert exc.value.code == 1008


def test_websocket_owner_then_revoked_session(client, settings):
    login(client, settings)
    with client.websocket_connect('ws://localhost/ws/global', headers={'Origin': ORIGIN}) as ws:
        client.portal.call(manager.broadcast_global, {'type': 'PRICE_UPDATE', 'ticker': 'MSFT'})
        assert ws.receive_json()['ticker'] == 'MSFT'
        assert client.post('/api/auth/logout', headers={'Origin': ORIGIN}).status_code == 200
        client.portal.call(manager.broadcast_global, {'type': 'PRICE_UPDATE', 'ticker': 'PRIVATE'})
        with pytest.raises(WebSocketDisconnect):
            ws.receive_json()


def test_websocket_connection_quota(client, settings):
    login(client, settings)
    client.app.state.security.websockets = settings.max_websockets
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect('ws://localhost/ws/global', headers={'Origin': ORIGIN}):
            pass
    client.app.state.security.websockets = 0

@pytest.mark.parametrize('amount', [-1, 0, 1e100, 'NaN', 'Infinity'])
def test_invalid_cash_does_not_change_balance(client, settings, amount):
    login(client, settings)
    r = client.post('/api/portfolio/cash', json={'amount': amount, 'type': 'DEPOSIT'}, headers={'Origin': ORIGIN})
    assert r.status_code == 422
    with get_db() as conn:
        assert conn.execute('SELECT balance FROM accounts').fetchone()[0] == 100000


def test_invalid_symbols_and_unbounded_indicators(client, settings):
    login(client, settings)
    client.headers['Origin'] = ORIGIN
    assert client.get('/api/snapshot/MSFT?period=unbounded').status_code == 422
    assert client.get('/api/company/https:evil').status_code == 422
    base = {'ticker': 'MSFT', 'type': 'SMA', 'params': {'period': 20}, 'style': {'color': '#00f3ff', 'lineStyle': 0, 'type': 'LINE'}, 'granularity': 'data', 'resolution': '1h'}
    assert client.post('/api/indicators/', json=base).status_code == 200
    for changes in [{'params': {'period': 10**8}}, {'params': {'period': 'NaN'}}, {'style': {'color': 'url(https://evil.invalid)'}}, {'params': {'source': []}}, {'type': 'CUSTOM'}, {'resolution': 'arbitrary'}]:
        assert client.post('/api/indicators/', json={**base, **changes}).status_code == 422


def test_request_body_limits(client, settings):
    login(client, settings)
    r = client.post('/api/watchlists/', content=b'x' * 17000, headers={'Origin': ORIGIN, 'Content-Type': 'application/json'})
    assert r.status_code == 413
    def chunks():
        for _ in range(20):
            yield b'x' * 1024
    r = client.post('/api/watchlists/', content=chunks(), headers={'Origin': ORIGIN})
    assert r.status_code == 413


def test_storage_outside_repository_private_and_quota(client, settings):
    assert settings.data_dir.stat().st_mode & 0o077 == 0
    assert (settings.data_dir / 'market.db').stat().st_mode & 0o077 == 0
    login(client, settings)
    with get_db() as conn:
        for n in range(99):
            conn.execute('INSERT INTO portfolios(name) VALUES (?)', (f'fixture-{n}',))
    assert client.post('/api/watchlists/', json={'name': 'over-quota'}, headers={'Origin': ORIGIN}).status_code in {400, 409}


def test_configuration_fails_closed(tmp_path):
    with pytest.raises(ValueError):
        Settings(access_token='', data_dir=tmp_path)
    with pytest.raises(ValueError):
        Settings(access_token=secrets.token_urlsafe(48), data_dir=Path(__file__).resolve().parents[1])
    with pytest.raises(ValueError):
        Settings(access_token=secrets.token_urlsafe(48), data_dir=tmp_path, origins=('http://public.invalid',))


def test_production_cookie_is_secure(settings):
    production = replace(settings, origins=('https://trade.example.invalid',), hosts=('trade.example.invalid',), secure_cookie=True)
    with TestClient(create_app(production), base_url='https://trade.example.invalid') as client:
        r = client.post('/api/auth/login', json={'access_key': settings.access_token}, headers={'Origin': 'https://trade.example.invalid'})
        assert r.status_code == 200 and 'Secure' in r.headers['set-cookie']
        assert client.get('/api/auth/session').status_code == 200
        assert client.get('/docs').status_code == 404
        assert client.get('/openapi.json').status_code == 404


def test_saved_indicator_must_match_ticker_and_remain_bounded(client, settings, monkeypatch):
    login(client, settings)
    client.headers['Origin'] = ORIGIN
    payload = {'ticker': 'MSFT', 'type': 'SMA', 'params': {'period': 20}, 'style': {}}
    result = client.post('/api/indicators/', json=payload)
    assert result.status_code == 200
    ident = result.json()['id']
    assert client.get(f'/api/indicators/AAPL/calculate/{ident}').status_code == 404
    with get_db() as conn:
        conn.execute('UPDATE saved_indicators SET params=? WHERE id=?', ('{"period":1000000000}', ident))
    assert client.get(f'/api/indicators/MSFT/calculate/{ident}').status_code == 409


def test_concurrent_withdrawals_are_serialized(client, settings):
    from concurrent.futures import ThreadPoolExecutor
    from app.models import CashOperationRequest
    from app.services.portfolio_service import manage_cash
    from fastapi import HTTPException
    def withdraw():
        try:
            manage_cash(CashOperationRequest(amount=75000, type='WITHDRAW'))
            return True
        except HTTPException:
            return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sum(pool.map(lambda _: withdraw(), range(2))) == 1
    with get_db() as conn:
        assert conn.execute('SELECT balance FROM accounts').fetchone()[0] == 25000


def test_session_replay_fails_after_logout(client, settings):
    login(client, settings)
    cookie = '; '.join(f'{k}={v}' for k, v in client.cookies.items())
    assert client.post('/api/auth/logout', headers={'Origin': ORIGIN}).status_code == 200
    assert client.get('/api/portfolio/history', headers={'Cookie': cookie}).status_code == 401


def test_authenticated_rate_limit_and_oversized_websocket_message(client, settings):
    login(client, settings)
    with client.websocket_connect('ws://localhost/ws/global', headers={'Origin': ORIGIN}) as ws:
        ws.send_text('x' * 300)
        with pytest.raises(WebSocketDisconnect):
            ws.receive_text()
    state = client.app.state.security
    for _ in range(settings.request_limit):
        state.allow('authenticated', settings.request_limit)
    assert client.get('/api/portfolio/history').status_code == 429
