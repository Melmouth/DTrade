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

# --- SHARED SERIALIZER ---
def _serialize_company_profile(raw_info: dict) -> dict:
    if not raw_info: return {}
    def g(k, d=None): return raw_info.get(k, d)

    return {
        "identity": {
            "symbol": g("symbol"),
            "longName": g("longName") or g("shortName"),
            "city": g("city"),
            "country": g("country"),
            "sector": g("sector"),
            "industry": g("industry"),
            "website": g("website"),
            "exchange": g("exchange"),
            "quoteType": g("quoteType", "EQUITY"),
            "currency": g("currency")
        },
        "profile": {
            "longBusinessSummary": g("longBusinessSummary"),
            "fullTimeEmployees": g("fullTimeEmployees", 0)
        },
        "valuation": {
            "marketCap": g("marketCap", 0),
            "enterpriseValue": g("enterpriseValue", 0),
            "trailingPE": g("trailingPE", 0),
            "forwardPE": g("forwardPE", 0),
            "trailingPegRatio": g("trailingPegRatio", 0),
            "priceToBook": g("priceToBook", 0)
        },
        "financials": {
             "revenueGrowth": g("revenueGrowth", 0),
             "totalDebt": g("totalDebt", 0),
             "totalCash": g("totalCash", 0),
             "returnOnEquity": g("returnOnEquity", 0),
             "freeCashflow": g("freeCashflow", 0),
             "quickRatio": g("quickRatio", 0)
        },
        "performance": {
            "fiftyTwoWeekHigh": g("fiftyTwoWeekHigh", 0),
            "fiftyTwoWeekLow": g("fiftyTwoWeekLow", 0),
            "fiftyDayAverage": g("fiftyDayAverage", 0),
            "twoHundredDayAverage": g("twoHundredDayAverage", 0),
            "dividendYield": g("dividendYield", 0),
            "payoutRatio": g("payoutRatio", 0),
            "beta": g("beta", 0)
        }
    }

# --- CENTRALIZED MAPPING LOGIC (CRITIQUE POUR HARMONISATION) ---
def resolve_fetch_params(view_period: str):
    """
    Définit QUOI charger chez Yahoo en fonction de la vue graphique.
    Source de vérité unique pour le Frontend et le Backend Compute.
    """
    chart_fetch_period = "max"
    chart_interval = "1d"
    
    if view_period == "1d":
        # Pour voir 1 jour, on charge 5 à 7 jours en 1m pour avoir de l'historique intraday
        # Cela permet aux indicateurs (EMA, RSI) de s'initialiser correctement sur les bougies précédentes
        chart_fetch_period = "5d" 
        chart_interval = "1m"
    elif view_period == "5d":
        chart_fetch_period = "5d"
        chart_interval = "5m" # ou 15m selon préférence
    elif view_period == "1mo":
        chart_fetch_period = "1mo"
        chart_interval = "1h" # ou 30m
    elif view_period == "3mo":
        chart_fetch_period = "3mo"
        chart_interval = "1d" # Passage en daily pour la lisibilité
    elif view_period in ["6mo", "ytd", "1y", "2y", "5y", "max"]:
        chart_fetch_period = view_period if view_period != "ytd" else "1y"
        chart_interval = "1d"
        
    return chart_fetch_period, chart_interval

# --- NEW: RESOLUTION MAPPING FOR RBI (Resolution-Based Independence) ---
def resolve_fetch_params_from_resolution(resolution: str):
    """
    Traduit une résolution technique (1m, 1h, 1d) en paramètres de fetch Yahoo optimaux.
    C'est le moteur de l'indépendance des données.
    """
    if resolution == '1m':
        return "5d", "1m"  # Yahoo limite le 1m à 7 jours max. 5d est safe.
    elif resolution in ['2m', '5m', '15m']:
        return "1mo", resolution # On prend 1 mois de 5m/15m (max Yahoo ~60j)
    elif resolution in ['30m', '1h', '60m']:
        return "3mo", "1h" # On prend 3 mois de H1 (max Yahoo ~730j)
    elif resolution == '1d':
        return "2y", "1d"  # Standard Daily
    elif resolution in ['1wk', '1mo']:
        return "max", resolution
    
    # Fallback par défaut
    return "1y", "1d"

# --- LAYER 1 : STATIC DATA (Cached) ---
@lru_cache(maxsize=32)
def _fetch_heavy_data(ticker: str, period: str, time_hash: int):
    try:
        # Utilisation de la logique centralisée
        chart_fetch_period, chart_interval = resolve_fetch_params(period)

        hist_main = provider.fetch_history(ticker, chart_fetch_period, chart_interval)
        info = provider.fetch_info(ticker)
        
        hist_daily = None
        if chart_interval != "1d":
            hist_daily = provider.fetch_history(ticker, "1y", "1d")
        else:
            hist_daily = hist_main

        if hist_main is None or hist_main.empty: return None
        
        chart_data = _format_df_to_list(hist_main)
        daily_data = _format_df_to_list(hist_daily) if hist_daily is not None else []

        return {
            "chart_data": chart_data,
            "daily_data": daily_data,
            "raw_info": info, 
            "meta": {"period": period, "interval": chart_interval}
        }
    except Exception as e:
        print(f"Service Error: {e}")
        return None

# --- LAYER 2 : DYNAMIC DATA (Live) ---
def _fetch_live_data(ticker: str):
    return provider.fetch_live_price(ticker)

# --- PUBLIC METHODS ---

def get_full_snapshot(ticker: str, period: str):
    # 1. Static
    static = _fetch_heavy_data(ticker, period, get_time_hash(300))
    if not static: return None
    
    # 2. Live
    live = _fetch_live_data(ticker)
    
    # 3. Merge Intelligent
    chart = list(static["chart_data"])
    
    if chart and live["price"] > 0 and live.get("is_open"):
        last = chart[-1]
        last["close"] = live["price"]
        if live["price"] > last["high"]: last["high"] = live["price"]
        if live["price"] < last["low"]: last["low"] = live["price"]
    
    structured_info = _serialize_company_profile(static["raw_info"])

    return {
        "ticker": ticker,
        "live": live,
        "chart": {
            "data": chart,
            "daily_data": static["daily_data"],
            "meta": static["meta"]
        },
        "info": structured_info 
    }

@lru_cache(maxsize=16) 
def get_company_profile(ticker: str):
    raw_info = provider.fetch_info(ticker)
    if not raw_info:
        return None
    return _serialize_company_profile(raw_info)

def get_internal_history(ticker, days):
    end = datetime.now()
    start = end - timedelta(days=days+60)
    period_str = "2y" if days < 700 else "5y"
    return provider.fetch_history(ticker, period_str, "1d")