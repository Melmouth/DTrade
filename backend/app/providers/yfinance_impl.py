import yfinance as yf
import pandas as pd
import exchange_calendars as ecals
from .base import MarketDataProvider
from datetime import datetime
from threading import BoundedSemaphore
from curl_cffi import requests

_OUTBOUND = BoundedSemaphore(4)

class BoundedSession(requests.Session):
    def request(self, *args, **kwargs):
        if not _OUTBOUND.acquire(timeout=1):
            raise RuntimeError("Market data busy")
        try:
            kwargs["timeout"] = 10
            return super().request(*args, **kwargs)
        finally:
            _OUTBOUND.release()

class YFinanceProvider(MarketDataProvider):
    def __init__(self):
        self.session = BoundedSession(impersonate="chrome")

    
    # --- HELPER: Détection du calendrier selon le suffixe ---
    def _get_cal_name(self, ticker: str) -> str:
        if ticker.endswith(".PA"): return "XPAR"  # Euronext Paris
        if ticker.endswith(".AS"): return "XAMS"  # Euronext Amsterdam (Adyen)
        if ticker.endswith(".BR"): return "XBRU"  # Euronext Brussels
        if ticker.endswith(".L"):  return "XLON"  # London
        if ticker.endswith(".DE"): return "XETR"  # Xetra (Germany)
        if ticker.endswith(".TO"): return "XTSE"  # Toronto
        return "XNYS" # Default US (NYSE/NASDAQ)

    def fetch_history(self, ticker: str, period: str, interval: str) -> pd.DataFrame:
        try:
            stock = yf.Ticker(ticker, session=self.session)
            df = stock.history(period=period, interval=interval, timeout=10)
            if df.empty: return None
            return df.tail(10000)
        except Exception as e:
            print(f"[YF Provider] Error history: {e}")
            return None

    def fetch_info(self, ticker: str) -> dict:
        try:
            stock = yf.Ticker(ticker, session=self.session)
            return stock.info
        except Exception as e:
            print(f"[YF Provider] Error info: {e}")
            return {}

    def fetch_live_price(self, ticker: str) -> dict:
        try:
            stock = yf.Ticker(ticker, session=self.session)
            # Utilisation de fast_info pour la performance
            price = stock.fast_info.last_price
            prev_close = stock.fast_info.previous_close
            
            # --- CORRECTION LOGIQUE CALENDRIER ---
            cal_name = self._get_cal_name(ticker)

            try:
                cal = ecals.get_calendar(cal_name)
                now = pd.Timestamp.now(tz='UTC') # Pas de floor pour plus de précision ici
                is_open = cal.is_trading_minute(now)
                # Next event
                next_event = cal.next_close(now) if is_open else cal.next_open(now)
                next_event_iso = next_event.isoformat()
            except Exception as e:
                # Fallback si exchange_calendars n'a pas la place
                print(f"Calendar error for {ticker}: {e}")
                is_open = False
                next_event_iso = None

            return {
                "price": round(price, 2) if price else 0,
                "change_pct": round(((price - prev_close)/prev_close)*100, 2) if price and prev_close else 0,
                "is_open": is_open,
                "next_event": next_event_iso,
                "exchange": cal_name
            }
        except Exception as e:
            print(f"[YF Provider] Error live: {e}")
            return {"price": 0, "change_pct": 0, "is_open": False, "next_event": None}

    def fetch_bulk_1m_status(self, tickers: list):
        """
        Récupère les données 1m pour tous les tickers.
        CORRIGÉ : Vérifie le calendrier par ticker individuel.
        """
        if not tickers: return {}
        
        try:
            # On récupère le timestamp UTC actuel une seule fois
            now = pd.Timestamp.now(tz='UTC')

            # Téléchargement Bulk
            data = yf.download(tickers, period="2d", interval="1m", group_by='ticker', threads=4, progress=False, auto_adjust=True, timeout=10, session=self.session)
            
            if data is None or data.empty:
                return {}

            results = {}
            
            # Cache simple des calendriers pour éviter de recharger "XNYS" 50 fois
            calendar_cache = {}

            for t in tickers:
                try:
                    df = data[t] if len(tickers) > 1 else data
                    if df is None or df.empty: continue
                        
                    df = df.dropna(subset=['Close'])
                    if df.empty: continue

                    last_price = df['Close'].iloc[-1]
                    prev_close = df['Close'].iloc[-2] if len(df) > 1 else last_price
                    
                    if pd.isna(last_price): continue

                    # --- CORRECTION ICI ---
                    # 1. Identifier le bon calendrier
                    cal_name = self._get_cal_name(t)
                    
                    # 2. Vérifier l'ouverture
                    ticker_is_open = False
                    try:
                        if cal_name not in calendar_cache:
                            calendar_cache[cal_name] = ecals.get_calendar(cal_name)
                        
                        ticker_is_open = calendar_cache[cal_name].is_trading_minute(now)
                    except:
                        ticker_is_open = False # Fallback safe

                    results[t] = {
                        "price": round(float(last_price), 2),
                        "change_pct": round(float(((last_price - prev_close) / prev_close) * 100), 2),
                        "is_open": ticker_is_open
                    }
                except KeyError:
                    continue
                except Exception as e:
                    print(f"[YF Bulk] Error processing {t}: {e}")
                    continue
                    
            return results
            
        except Exception as e:
            print(f"[YF Bulk] Critical Error: {e}")
            return {}