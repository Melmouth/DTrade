import asyncio
import time
from datetime import datetime
from .websockets import manager
from .services import market_data
from .database import get_db

# Aligné sur l'intervalle 1m (avec une marge de sécurité)
UPDATE_INTERVAL = 4

def log(msg):
    print(f"\033[92m[{datetime.now().strftime('%H:%M:%S')}] [WORKER]\033[0m {msg}")

async def market_data_worker():
    log("Démarrage du Thread Background (Mode Unifié Bulk)...")
    
    while True:
        try:
            start_time = time.time()
            
            # 1. RÉCUPÉRATION DE TOUS LES TICKERS D'INTÉRÊT
            # On récupère ce qui est affiché à l'écran (Active) + ce qui est en favoris (Sidebar)
            active_tickers = list(manager.active_tickers)
            db_tickers = []
            try:
                with get_db() as conn:
                    rows = conn.execute("SELECT DISTINCT ticker FROM portfolio_items").fetchall()
                    db_tickers = [r['ticker'] for r in rows]
            except Exception as e:
                log(f"Erreur DB: {e}")

            # Union des sets pour éviter les doublons
            all_tickers = list(set(active_tickers + db_tickers))
            
            if not all_tickers:
                await asyncio.sleep(1)
                continue

            log(f"Cycle Bulk : {len(all_tickers)} tickers (Graphiques actifs : {len(active_tickers)})")

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

                # Broadcast aux abonnés de ce ticker spécifique (ex: Graphique ouvert)
                await manager.broadcast(ticker, payload)

                # --- NOUVEAUTÉ : DIFFUSION AU CANAL GLOBAL (Pour la Sidebar vivante) ---
                # On envoie la donnée au gestionnaire global qui la redistribuera à tous les clients
                await manager.broadcast_global(payload)

            # 4. CALCUL DU SOMMEIL (Sync sur 1 minute)
            elapsed = time.time() - start_time
            sleep_time = max(0.1, UPDATE_INTERVAL - elapsed)
            await asyncio.sleep(sleep_time)

        except Exception as e:
            log(f"CRITICAL ERROR: {e}")
            await asyncio.sleep(5)