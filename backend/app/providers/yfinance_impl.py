import yfinance as yf
import pandas as pd
import exchange_calendars as ecals
from .base import MarketDataProvider
from datetime import datetime

class YFinanceProvider(MarketDataProvider):
    def fetch_history(self, ticker: str, period: str, interval: str) -> pd.DataFrame:
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(period=period, interval=interval)
            
            if df.empty:
                return None
            
            # Standardisation : On veut s'assurer que l'index est datetime
            # et que les colonnes sont propres
            return df
        except Exception as e:
            print(f"[YF Provider] Error history: {e}")
            return None

    def fetch_info(self, ticker: str) -> dict:
        try:
            stock = yf.Ticker(ticker)
            return stock.info
        except Exception as e:
            print(f"[YF Provider] Error info: {e}")
            return {}

    def fetch_live_price(self, ticker: str) -> dict:
        try:
            stock = yf.Ticker(ticker)
            price = stock.fast_info.last_price
            prev_close = stock.fast_info.previous_close
            
            # --- Logique Exchange Calendar (Spécifique à la façon dont YF nomme les tickers) ---
            cal_name = "XNYS" # Default US
            if ticker.endswith(".PA"): cal_name = "XPAR"
            elif ticker.endswith(".L"): cal_name = "XLON"
            elif ticker.endswith(".TO"): cal_name = "XTSE"
            elif ticker.endswith(".DE"): cal_name = "XETR"

            try:
                cal = ecals.get_calendar(cal_name)
                now = pd.Timestamp.now(tz='UTC').floor('min')
                is_open = cal.is_trading_minute(now)
                next_event = cal.next_close(now) if is_open else cal.next_open(now)
                next_event_iso = next_event.isoformat()
            except:
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