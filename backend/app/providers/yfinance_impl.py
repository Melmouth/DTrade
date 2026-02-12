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

    def fetch_bulk_1m_status(self, tickers: list):
        """
        Récupère les données 1m pour tous les tickers en une seule requête.
        Version BLINDÉE contre les erreurs Yahoo.
        """
        if not tickers: return {}
        
        try:
            # On télécharge les 2 derniers jours en 1m
            # Astuce : On ajoute auto_adjust=True pour simplifier les données
            data = yf.download(tickers, period="2d", interval="1m", group_by='ticker', threads=True, progress=False, auto_adjust=True)
            
            # Si Yahoo bloque ou renvoie vide
            if data is None or data.empty:
                print("[YF Bulk] Warning: Yahoo returned empty data (Rate Limit?)")
                return {}

            results = {}
            
            for t in tickers:
                try:
                    # Gestion du MultiIndex (si plusieurs tickers) ou DataFrame simple (si 1 ticker)
                    df = data[t] if len(tickers) > 1 else data
                    
                    # Vérification supplémentaire que df est bien un DataFrame valide
                    if df is None or df.empty:
                        continue
                        
                    # Nettoyage des lignes où Close est NaN
                    df = df.dropna(subset=['Close'])
                    
                    if df.empty:
                        continue

                    last_price = df['Close'].iloc[-1]
                    # Protection si une seule ligne dispo (pas de prev_close)
                    prev_close = df['Close'].iloc[-2] if len(df) > 1 else last_price
                    
                    # Protection contre NaN (Not a Number) qui fait planter le JSON
                    if pd.isna(last_price) or pd.isna(prev_close):
                        continue

                    results[t] = {
                        "price": round(float(last_price), 2),
                        "change_pct": round(float(((last_price - prev_close) / prev_close) * 100), 2),
                        "is_open": True 
                    }
                except KeyError:
                    # Ticker introuvable dans le lot
                    continue
                except Exception as e:
                    print(f"[YF Bulk] Error processing {t}: {e}")
                    continue
                    
            return results
            
        except Exception as e:
            print(f"[YF Bulk] Critical Error: {e}")
            return {}