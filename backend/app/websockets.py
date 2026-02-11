from typing import Dict, List, Set
from fastapi import WebSocket
from datetime import datetime

def log(msg):
    print(f"\033[93m[{datetime.now().strftime('%H:%M:%S')}] [MANAGER]\033[0m {msg}")

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.active_tickers: Set[str] = set()

    async def connect(self, websocket: WebSocket, ticker: str):
        await websocket.accept()
        if ticker not in self.active_connections:
            self.active_connections[ticker] = []
        self.active_connections[ticker].append(websocket)
        self.active_tickers.add(ticker)
        
        count = len(self.active_connections[ticker])
        log(f"Client ajouté sur {ticker}. Total spectateurs: {count}")

    def disconnect(self, websocket: WebSocket, ticker: str):
        if ticker in self.active_connections:
            if websocket in self.active_connections[ticker]:
                self.active_connections[ticker].remove(websocket)
                log(f"Client retiré de {ticker}.")
            
            if len(self.active_connections[ticker]) == 0:
                del self.active_connections[ticker]
                self.active_tickers.discard(ticker)
                log(f"Plus de spectateurs pour {ticker}. Arrêt surveillance.")

    async def broadcast(self, ticker: str, message: dict):
        if ticker in self.active_connections:
            connections = list(self.active_connections[ticker])
            # log(f"Broadcasting prix {ticker} à {len(connections)} clients") # Décommenter si besoin
            
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error broadcasting: {e}")
                    self.disconnect(connection, ticker)

manager = ConnectionManager()