from fastapi import APIRouter, HTTPException, WebSocket, Query
from ..services import market_data
import yfinance as yf
import pandas as pd
import asyncio

router = APIRouter(tags=["market"])

@router.get("/api/company/{ticker}")
def get_company(ticker: str):
    try:
        return market_data.get_company_info_data(ticker)
    except Exception as e:
        raise HTTPException(500, f"Error: {str(e)}")

@router.get("/api/market-status/{ticker}")
def get_status(ticker: str):
    return market_data.get_market_status_data(ticker)

@router.get("/api/history/{ticker}")
def get_history(ticker: str, period: str = "1mo"):
    # Logique History inchangée (rapide à intégrer ici ou dans un service, ici ok)
    stock = yf.Ticker(ticker)
    chart_fetch_period = "max" if period not in ["1d", "5d", "7d"] else "1mo"
    chart_interval = "1d"
    if period == "1d": chart_interval = "5m"
    elif period in ["5d", "7d"]: chart_interval = "15m"

    hist_chart = stock.history(period=chart_fetch_period, interval=chart_interval)
    hist_daily = stock.history(period="2y", interval="1d")

    def fmt(df):
        if df.empty: return []
        res = []
        for d, r in df.iterrows():
            res.append({
                "date": d.isoformat(),
                "raw_date": d.strftime("%Y-%m-%d"),
                "open": round(r['Open'], 2), "high": round(r['High'], 2),
                "low": round(r['Low'], 2), "close": round(r['Close'], 2),
                "volume": int(r['Volume']) if not pd.isna(r['Volume']) else 0
            })
        return res

    return {
        "data": fmt(hist_chart),
        "daily_data": fmt(hist_daily),
        "meta": {"period": period, "interval": chart_interval}
    }

@router.websocket("/ws/trading/{ticker}")
async def websocket_endpoint(websocket: WebSocket, ticker: str, interval: int = Query(15)):
    await websocket.accept()
    sleep_time = max(2, min(interval, 300))
    stock = yf.Ticker(ticker)
    try:
        while True:
            try:
                price = stock.fast_info.last_price
                if price: await websocket.send_json({"symbol": ticker.upper(), "price": round(price, 2)})
            except: pass
            await asyncio.sleep(sleep_time)
    except: pass