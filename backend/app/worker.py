import asyncio
import time
from datetime import datetime
from .websockets import manager
from .services import market_data

UPDATE_INTERVAL = 15

def log(msg):
    # En vert pour le worker
    print(f"\033[92m[{datetime.now().strftime('%H:%M:%S')}] [WORKER]\033[0m {msg}")

async def market_data_worker():
    log("Démarrage du Thread Background...")
    
    while True:
        try:
            start_time = time.time()
            tickers_to_fetch = list(manager.active_tickers)
            
            if not tickers_to_fetch:
                # log("Idle... Aucun ticker actif.") # Trop verbeux
                await asyncio.sleep(1)
                continue

            log(f"Cycle Update: {tickers_to_fetch}")

            for ticker in tickers_to_fetch:
                try:
                    # Mesure du temps API YFinance
                    t0 = time.time()
                    data = await asyncio.to_thread(market_data._fetch_live_data, ticker)
                    t1 = time.time()
                    
                    if t1 - t0 > 1.0:
                        log(f"⚠️ YFinance LENT pour {ticker}: {t1-t0:.2f}s")

                    if data:
                        payload = {
                            "type": "PRICE_UPDATE",
                            "ticker": ticker,
                            "price": data.get("price"),
                            "change_pct": data.get("change_pct"),
                            "is_open": data.get("is_open"),
                            "timestamp": time.time()
                        }
                        await manager.broadcast(ticker, payload)
                        
                except Exception as e:
                    log(f"Erreur fetch {ticker}: {e}")

            # Calcul du temps de sommeil pour garder le rythme
            elapsed = time.time() - start_time
            sleep_time = max(0.1, UPDATE_INTERVAL - elapsed)
            await asyncio.sleep(sleep_time)

        except Exception as e:
            log(f"CRITICAL LOOP ERROR: {e}")
            await asyncio.sleep(5)