from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import time
from datetime import datetime

from app.database import init_db
# Import des 4 modules de routes : Market, Indicators, Watchlist (Favoris), Portfolio (Trading)
from app.routes import market, indicators, watchlist, portfolio
from app.websockets import manager
from app.worker import market_data_worker

# Fonctions de log pour la lisibilité
def log(tag, msg):
    print(f"\033[96m[{datetime.now().strftime('%H:%M:%S')}] [{tag}]\033[0m {msg}")

app = FastAPI()

# Init DB
log("SYSTEM", "Initializing Database...")
init_db()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware pour logger TOUTES les requêtes HTTP
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    if request.method != "OPTIONS":
        log("HTTP", f"{request.method} {request.url.path} - {response.status_code} ({process_time:.2f}ms)")
    return response

# Include Routers
app.include_router(market.router)
app.include_router(indicators.router)
app.include_router(watchlist.router)  # Gère /api/watchlists (Sidebar)
app.include_router(portfolio.router)  # Gère /api/portfolio (Trading, Cash, Ordres)

@app.websocket("/ws/global")
async def global_websocket_endpoint(websocket: WebSocket):
    log("WS", "Connexion au flux GLOBAL...")
    await manager.connect_global(websocket)
    try:
        while True:
            await websocket.receive_text() # Garde la connexion ouverte
    except WebSocketDisconnect:
        manager.disconnect_global(websocket)

# --- WEBSOCKET ENDPOINT ---
@app.websocket("/ws/{ticker}")
async def websocket_endpoint(websocket: WebSocket, ticker: str):
    log("WS", f"Connexion entrante pour {ticker}...")
    
    await manager.connect(websocket, ticker)
    
    try:
        while True:
            # On garde la connexion ouverte
            data = await websocket.receive_text()
            log("WS", f"Message reçu de {ticker}: {data}")
            
    except WebSocketDisconnect:
        log("WS", f"Déconnexion client: {ticker}")
        manager.disconnect(websocket, ticker)
    except Exception as e:
        log("WS", f"ERREUR CRITIQUE sur {ticker}: {e}")
        manager.disconnect(websocket, ticker)

# --- LIFECYCLE EVENTS ---
@app.on_event("startup")
async def startup_event():
    log("SYSTEM", "🚀 Backend Démarré")
    # Lance le worker en arrière-plan
    asyncio.create_task(market_data_worker())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)