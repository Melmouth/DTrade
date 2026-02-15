from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import time
import json
from datetime import datetime
from starlette.concurrency import iterate_in_threadpool

from app.database import init_db
from app.routes import market, indicators, watchlist, portfolio
from app.websockets import manager
from app.worker import market_data_worker

# --- LOGGER AVANCÉ ---
def log_deep(tag, msg, data=None):
    timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
    print(f"\033[96m[{timestamp}] [{tag}]\033[0m {msg}")
    if data:
        # Pretty print du JSON pour inspection structurelle
        try:
            if isinstance(data, (dict, list)):
                formatted = json.dumps(data, indent=2, default=str)
                # On colore le JSON en gris pour la lisibilité
                print(f"\033[90m{formatted}\033[0m")
            else:
                print(f"\033[90m{str(data)}\033[0m")
        except:
            print(f"\033[90m{str(data)}\033[0m")

app = FastAPI()

log_deep("SYSTEM", "Initializing Database & Audit Systems...")
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MIDDLEWARE D'INSPECTION TOTALE ---
@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    start_time = time.time()
    
    # 1. INGESTION (Capture Request Body)
    req_body = await request.body()
    log_deep("INGEST >", f"{request.method} {request.url.path}")
    if req_body:
        try:
            log_deep("PAYLOAD >", "Données reçues du Front:", json.loads(req_body))
        except:
            log_deep("PAYLOAD >", "Données reçues (Raw):", req_body.decode())

    # Pour ne pas consommer le stream, on doit reconstruire le body pour FastAPI
    async def receive():
        return {"type": "http.request", "body": req_body}
    request._receive = receive

    # 2. TRAITEMENT
    response = await call_next(request)
    
    # 3. ÉMISSION (Capture Response Body)
    # Attention : cela consomme le générateur de réponse, il faut le reconstruire
    resp_body = b""
    async for chunk in response.body_iterator:
        resp_body += chunk
    
    process_time = (time.time() - start_time) * 1000
    status_color = "\033[92m" if response.status_code < 400 else "\033[91m"
    
    log_deep("EGRESS <", f"{status_color}Status {response.status_code}\033[0m ({process_time:.2f}ms)")
    
    # On n'affiche le body que s'il est pertinent (ex: JSON d'indicateurs)
    if response.headers.get("content-type") == "application/json":
        try:
            log_deep("DATA <", "Données envoyées au Front:", json.loads(resp_body))
        except:
            pass
            
    # Reconstruction de la réponse
    return Response(
        content=resp_body,
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type=response.media_type
    )

# ... (Routes inclusions: market, indicators, etc. RESTENT IDENTIQUES)
app.include_router(market.router)
app.include_router(indicators.router)
app.include_router(watchlist.router)
app.include_router(portfolio.router)

# --- WEBSOCKET INSPECTOR ---
@app.websocket("/ws/global")
async def global_websocket_endpoint(websocket: WebSocket):
    log_deep("WS", "GLOBAL STREAM: New Connection")
    await manager.connect_global(websocket)
    try:
        while True:
            data = await websocket.receive_text() # Keep alive
            # log_deep("WS", "Ping Global", data)
    except WebSocketDisconnect:
        manager.disconnect_global(websocket)

@app.websocket("/ws/{ticker}")
async def websocket_endpoint(websocket: WebSocket, ticker: str):
    log_deep("WS", f"STREAM {ticker}: Connexion")
    await manager.connect(websocket, ticker)
    try:
        while True:
            data = await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket, ticker)

@app.on_event("startup")
async def startup_event():
    log_deep("SYSTEM", "🚀 Backend Audit Ready")
    asyncio.create_task(market_data_worker())

# ... (if __name__ == "__main__": ...)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)