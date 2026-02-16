import asyncio
import time
from datetime import datetime
from .websockets import manager
from .services import market_data
from .database import get_db

# Aligné sur l'intervalle 1m (avec une marge de sécurité)
UPDATE_INTERVAL = 5

def log(msg):
    print(f"\033[92m[{datetime.now().strftime('%H:%M:%S')}] [WORKER]\033[0m {msg}")

async def market_data_worker():
    log("Démarrage du Thread Background (Mode Unifié Bulk)...")
    
    while True:
        try:
            start_time = time.time()
            
            # 1. RÉCUPÉRATION DE TOUS LES TICKERS D'INTÉRÊT
            # On récupère :
            # A. Ce qui est affiché sur un graphique actif (Clients WebSocket)
            # B. Ce qui est dans les favoris (Sidebar)
            # C. Ce qui est détenu en portefeuille (Positions -> Pour le calcul Equity)
            
            active_tickers = list(manager.active_tickers)
            db_tickers = []
            
            try:
                with get_db() as conn:
                    # Fetch Watchlist
                    rows_watchlist = conn.execute("SELECT DISTINCT ticker FROM portfolio_items").fetchall()
                    
                    # Fetch Positions (NOUVEAU : Epic 2.2)
                    rows_positions = conn.execute("SELECT DISTINCT ticker FROM positions").fetchall()
                    
                    # Merge des deux sources DB
                    db_tickers = [r['ticker'] for r in rows_watchlist] + [r['ticker'] for r in rows_positions]
                    
            except Exception as e:
                log(f"Erreur DB: {e}")

            # Union des sets pour éviter les doublons et nettoyer
            all_tickers = list(set(active_tickers + db_tickers))
            # Filtrage des None ou vide au cas où
            all_tickers = [t for t in all_tickers if t]
            
            if not all_tickers:
                await asyncio.sleep(1)
                continue

            #log(f"Cycle Bulk : {len(all_tickers)} tickers (Graphiques actifs : {len(active_tickers)})")

            # 2. FETCH UNIQUE (1 requête pour N tickers)
            # Cette méthode retourne { ticker: { price, change_pct, is_open } }
            bulk_data = await asyncio.to_thread(
                market_data.provider.fetch_bulk_1m_status, 
                all_tickers
            )

            # 3. DIFFUSION CIBLÉE ET GLOBALE
            for ticker in all_tickers:
                data = bulk_data.get(ticker)
                if not data:
                    continue
                
                payload = {
                    "type": "PRICE_UPDATE",
                    "ticker": ticker,
                    "price": data.get("price"),
                    "change_pct": data.get("change_pct"),
                    "is_open": data.get("is_open", False),
                    "timestamp": time.time()
                }

                # A. Broadcast aux abonnés de ce ticker spécifique (Graphique ouvert)
                await manager.broadcast(ticker, payload)

                # B. DIFFUSION AU CANAL GLOBAL
                # Sert à mettre à jour la Sidebar ET le calcul d'Equity du Portfolio en temps réel
                await manager.broadcast_global(payload)

            # 4. CALCUL DU SOMMEIL (Sync sur cycle)
            elapsed = time.time() - start_time
            sleep_time = max(0.1, UPDATE_INTERVAL - elapsed)
            await asyncio.sleep(sleep_time)

        except Exception as e:
            log(f"CRITICAL ERROR: {e}")
            await asyncio.sleep(5)