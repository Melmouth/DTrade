import pandas as pd
from datetime import datetime, timedelta
from functools import lru_cache
import time

# --- PROVIDER INJECTION ---
from ..providers.yfinance_impl import YFinanceProvider as CurrentProvider

provider = CurrentProvider()

# --- CACHE CONTROL ---
def get_time_hash(seconds=300):
    return int(time.time() / seconds)

# --- HELPER FORMATAGE ---
def _format_df_to_list(df):
    """Convertit un DataFrame en liste de dictionnaires optimisée pour le front"""
    if df is None or df.empty: return []
    res = []
    # Reset index pour avoir la Date en colonne si ce n'est pas déjà fait
    df = df.reset_index()
    
    for _, r in df.iterrows():
        d_val = r.get('Date') or r.get('Datetime')
        if pd.isna(d_val): continue
        
        res.append({
            "date": d_val.isoformat(),
            "open": round(r['Open'], 2), 
            "high": round(r['High'], 2),
            "low": round(r['Low'], 2), 
            "close": round(r['Close'], 2),
            "volume": int(r['Volume']) if not pd.isna(r['Volume']) else 0
        })
    return res

# --- LAYER 1 : STATIC DATA (Cached) ---
@lru_cache(maxsize=32)
def _fetch_heavy_data(ticker: str, period: str, time_hash: int):
    try:
        # 1. Déterminer les paramètres principaux
        chart_fetch_period = "max"
        chart_interval = "1d"
        
        if period == "1d":
            chart_fetch_period = "7d" # Buffer pour le week-end
            chart_interval = "1m"
        elif period == "5d":
            chart_fetch_period = "5d"
            chart_interval = "5m"
        elif period == "7d":
            chart_fetch_period = "7d"
            chart_interval = "1m"
        elif period in ["1mo", "3mo"]:
            chart_fetch_period = period
            chart_interval = "1h"

        # 2. Appel Principal (La vue demandée par l'utilisateur)
        hist_main = provider.fetch_history(ticker, chart_fetch_period, chart_interval)
        info = provider.fetch_info(ticker)
        
        # 3. Appel Contexte Macro (Toujours 1 an en Daily pour les indicateurs)
        # On ne le fait que si la vue principale n'est PAS déjà du daily long terme
        hist_daily = None
        if chart_interval != "1d":
            hist_daily = provider.fetch_history(ticker, "1y", "1d")
        else:
            # Si on est déjà en daily, on utilise la même donnée (ou une version étendue si besoin)
            hist_daily = hist_main

        if hist_main is None or hist_main.empty: return None
        
        # 4. Formatage
        chart_data = _format_df_to_list(hist_main)
        daily_data = _format_df_to_list(hist_daily) if hist_daily is not None else []

        return {
            "chart_data": chart_data,
            "daily_data": daily_data, # <--- NOUVEAU CHAMP
            "raw_info": info,
            "meta": {"period": period, "interval": chart_interval}
        }
    except Exception as e:
        print(f"Service Error: {e}")
        return None

# --- LAYER 2 : DYNAMIC DATA (Live) ---
def _fetch_live_data(ticker: str):
    return provider.fetch_live_price(ticker)

# --- MAIN AGGREGATOR ---
def get_full_snapshot(ticker: str, period: str):
    # 1. Static
    static = _fetch_heavy_data(ticker, period, get_time_hash(300))
    if not static: return None
    
    # 2. Live
    live = _fetch_live_data(ticker)
    
    # 3. Merge (Mise à jour de la dernière bougie avec le prix live)
    chart = list(static["chart_data"])
    if chart and live["price"] > 0:
        last = chart[-1]
        last["close"] = live["price"]
        if live["price"] > last["high"]: last["high"] = live["price"]
        if live["price"] < last["low"]: last["low"] = live["price"]
    
    raw = static["raw_info"]
    def g(k, d=None): return raw.get(k, d)

    return {
        "ticker": ticker,
        "live": live,
        "chart": {
            "data": chart,
            "daily_data": static["daily_data"], # On passe le contexte au front
            "meta": static["meta"]
        },
        "info": {
            "name": g("longName") or g("shortName"),
            "city": g("city"),
            "country": g("country"),
            "sector": g("sector"),
            "industry": g("industry"),
            "website": g("website"),
            "exchange": g("exchange"),
            "quoteType": g("quoteType"),
            "currency": g("currency"),
            "summary": g("longBusinessSummary"),
            "employees": g("fullTimeEmployees", 0),
            "marketCap": g("marketCap", 0),
            "enterpriseValue": g("enterpriseValue", 0),
            "peRatio": g("trailingPE", 0),
            "forwardPE": g("forwardPE", 0),
            "pegRatio": g("trailingPegRatio", 0),
            "priceToBook": g("priceToBook", 0),
            "beta": g("beta", 0),
            "financials": {
                 "revenueGrowth": g("revenueGrowth", 0),
                 "debt": g("totalDebt", 0),
                 "cash": g("totalCash", 0),
                 "roe": g("returnOnEquity", 0),
                 "freeCashflow": g("freeCashflow", 0),
                 "quickRatio": g("quickRatio", 0)
            },
            "performance": {
                "fiftyTwoWeekHigh": g("fiftyTwoWeekHigh", 0),
                "fiftyTwoWeekLow": g("fiftyTwoWeekLow", 0),
                "fiftyDayAverage": g("fiftyDayAverage", 0),
                "twoHundredDayAverage": g("twoHundredDayAverage", 0),
                "dividendYield": g("dividendYield", 0),
                "payoutRatio": g("payoutRatio", 0)
            }
        }
    }

def get_internal_history(ticker, days):
    end = datetime.now()
    start = end - timedelta(days=days+60)
    period_str = "2y" if days < 700 else "5y"
    return provider.fetch_history(ticker, period_str, "1d")