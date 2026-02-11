from fastapi import APIRouter, HTTPException
from ..database import get_db
from ..models import PortfolioRequest, PortfolioItemRequest
import sqlite3
import yfinance as yf

router = APIRouter(prefix="/api", tags=["portfolio"])

@router.get("/sidebar")
def get_sidebar():
    with get_db() as conn:
        portfolios = conn.execute("SELECT * FROM portfolios").fetchall()
        result = []
        for p in portfolios:
            items = conn.execute("SELECT ticker FROM portfolio_items WHERE portfolio_id = ?", (p['id'],)).fetchall()
            tickers_data = []
            for item in items:
                ticker = item['ticker']
                try:
                    info = yf.Ticker(ticker).fast_info
                    prev = info.previous_close
                    curr = info.last_price
                    pct = ((curr - prev)/prev)*100 if prev else 0
                except: pct = 0
                tickers_data.append({"ticker": ticker, "change_pct": round(pct, 2)})
            result.append({"id": p['id'], "name": p['name'], "items": tickers_data})
    return result

@router.post("/portfolios")
def create_portfolio(p: PortfolioRequest):
    try:
        with get_db() as conn:
            cursor = conn.execute("INSERT INTO portfolios (name) VALUES (?)", (p.name,))
            new_id = cursor.lastrowid
            conn.commit()
        return {"id": new_id, "name": p.name, "items": []}
    except sqlite3.IntegrityError:
        raise HTTPException(400, "Name exists")

@router.delete("/portfolios/{pid}")
def delete_portfolio(pid: int):
    with get_db() as conn:
        conn.execute("DELETE FROM portfolios WHERE id = ?", (pid,))
        conn.commit()
    return {"status": "deleted"}

@router.post("/portfolios/{pid}/items")
def add_item(pid: int, item: PortfolioItemRequest):
    with get_db() as conn:
        conn.execute("INSERT OR IGNORE INTO portfolio_items (portfolio_id, ticker) VALUES (?, ?)", (pid, item.ticker))
        conn.commit()
    return {"status": "added"}

@router.delete("/portfolios/{pid}/items/{ticker}")
def remove_item(pid: int, ticker: str):
    with get_db() as conn:
        conn.execute("DELETE FROM portfolio_items WHERE portfolio_id = ? AND ticker = ?", (pid, ticker))
        conn.commit()
    return {"status": "removed"}

@router.delete("/database")
def nuke_db():
    with get_db() as conn:
        conn.execute("DELETE FROM watchlist")
        conn.execute("DELETE FROM portfolios")
        conn.execute("DELETE FROM portfolio_items")
        conn.execute("INSERT INTO portfolios (name) VALUES (?)", ("Favoris",))
        conn.commit()
    return {"status": "nuked"}