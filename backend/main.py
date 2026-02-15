from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from app.database import init_db
from app.routes import market, indicators, watchlist, portfolio
from app.websockets import manager
from app.worker import market_data_worker

app = FastAPI()

# Initialisation de la DB sans logs verbeux
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROUTES ---
app.include_router(market.router)
app.include_router(indicators.router)
app.include_router(watchlist.router)
app.include_router(portfolio.router)

# --- WEBSOCKETS ---
@app.websocket("/ws/global")
async def global_websocket_endpoint(websocket: WebSocket):
    await manager.connect_global(websocket)
    try:
        while True:
            await websocket.receive_text() # Keep alive
    except WebSocketDisconnect:
        manager.disconnect_global(websocket)

@app.websocket("/ws/{ticker}")
async def websocket_endpoint(websocket: WebSocket, ticker: str):
    await manager.connect(websocket, ticker)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket, ticker)

@app.on_event("startup")
async def startup_event():
    # Lancement du worker en arrière-plan
    asyncio.create_task(market_data_worker())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)