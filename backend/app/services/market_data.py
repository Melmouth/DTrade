import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import exchange_calendars as ecals

def get_clean_history(ticker: str, lookback_days: int):
    end = datetime.now()
    start = end - timedelta(days=lookback_days + 300) # Buffer
    try:
        df = yf.Ticker(ticker).history(start=start, end=end, interval="1d")
        if df.empty or len(df) < 50: return None
        df.index = df.index.tz_localize(None)
        return df
    except Exception as e:
        print(f"Error fetching data: {e}")
        return None

def get_company_info_data(ticker: str):
    raw = yf.Ticker(ticker).info
    def g(key, default="N/A"): return raw.get(key, default)
    
    return {
        "identity": {
            "symbol": g("symbol"), "longName": g("longName"), "city": g("city"),
            "country": g("country"), "website": g("website"), "exchange": g("exchange"),
            "fullExchangeName": g("fullExchangeName"), "currency": g("currency"),
            "quoteType": g("quoteType"), "sector": g("sector"), "industry": g("industry")
        },
        "valuation": {
            "marketCap": g("marketCap", 0), "enterpriseValue": g("enterpriseValue", 0),
            "trailingPE": g("trailingPE", 0), "forwardPE": g("forwardPE", 0),
            "priceToBook": g("priceToBook", 0), "trailingPegRatio": g("trailingPegRatio", 0),
        },
        "performance": {
            "currentPrice": g("currentPrice", 0), "fiftyTwoWeekHigh": g("fiftyTwoWeekHigh", 0),
            "fiftyTwoWeekLow": g("fiftyTwoWeekLow", 0), "fiftyDayAverage": g("fiftyDayAverage", 0),
            "twoHundredDayAverage": g("twoHundredDayAverage", 0), "dividendYield": g("dividendYield", 0),
            "payoutRatio": g("payoutRatio", 0), "beta": g("beta", 0),
        },
        "financials": {
            "totalCash": g("totalCash", 0), "totalDebt": g("totalDebt", 0),
            "quickRatio": g("quickRatio", 0), "currentRatio": g("currentRatio", 0),
            "returnOnEquity": g("returnOnEquity", 0), "revenueGrowth": g("revenueGrowth", 0),
            "freeCashflow": g("freeCashflow", 0),
        },
        "profile": {
            "longBusinessSummary": g("longBusinessSummary", "Aucune description disponible."),
            "fullTimeEmployees": g("fullTimeEmployees", 0),
        }
    }

def get_market_status_data(ticker: str):
    def get_exchange(t):
        if t.endswith(".PA"): return "XPAR"
        if t.endswith(".L"): return "XLON"
        if t.endswith(".DE"): return "XETR"
        if t.endswith(".TO"): return "XTSE"
        return "XNYS"

    cal_name = get_exchange(ticker)
    cal = ecals.get_calendar(cal_name)
    now = pd.Timestamp.now(tz='UTC').floor('min')
    is_open = cal.is_trading_minute(now)
    
    if is_open:
        next_event = cal.next_close(now).isoformat()
        state = "OPEN"
    else:
        next_event = cal.next_open(now).isoformat()
        state = "CLOSED"
        
    return {
        "ticker": ticker, "exchange": cal_name, "state": state,
        "next_event": next_event, "server_time": now.isoformat()
    }