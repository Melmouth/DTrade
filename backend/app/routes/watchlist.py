from fastapi import APIRouter, HTTPException
from ..database import get_db
from ..models import PortfolioRequest, PortfolioItemRequest
from ..services.market_data import provider
import sqlite3

# Changement de prefix et de tag pour éviter le conflit avec le vrai Portfolio
router = APIRouter(prefix="/api/watchlists", tags=["watchlists"])

@router.get("/sidebar")
def get_sidebar():
    """
    Récupère la structure de la sidebar (Dossiers de favoris).
    Note: On continue d'utiliser la table 'portfolios' pour le stockage existant,
    mais sémantiquement, ce sont des watchlists.
    """
    with get_db() as conn:
        # On utilise toujours la table 'portfolios' (Legacy naming) pour les dossiers
        folders = conn.execute("SELECT * FROM portfolios").fetchall()
        all_items_rows = conn.execute("SELECT portfolio_id, ticker FROM portfolio_items").fetchall()

    unique_tickers = list(set([row['ticker'] for row in all_items_rows]))
    bulk_data = provider.fetch_bulk_1m_status(unique_tickers)

    result = []
    for f in folders:
        p_items = [row for row in all_items_rows if row['portfolio_id'] == f['id']]
        tickers_data = []
        for item in p_items:
            ticker = item['ticker']
            data = bulk_data.get(ticker, {})
            tickers_data.append({
                "ticker": ticker, 
                "change_pct": data.get('change_pct', 0)
            })
        
        result.append({
            "id": f['id'], 
            "name": f['name'], 
            "items": tickers_data
        })
    return result

@router.post("/")
def create_watchlist(p: PortfolioRequest):
    try:
        with get_db() as conn:
            cursor = conn.execute("INSERT INTO portfolios (name) VALUES (?)", (p.name,))
            new_id = cursor.lastrowid
            conn.commit()
        return {"id": new_id, "name": p.name, "items": []}
    except sqlite3.IntegrityError:
        raise HTTPException(400, "Name exists")

@router.delete("/{pid}")
def delete_watchlist(pid: int):
    with get_db() as conn:
        conn.execute("DELETE FROM portfolios WHERE id = ?", (pid,))
        conn.commit()
    return {"status": "deleted"}

@router.post("/{pid}/items")
def add_ticker_to_watchlist(pid: int, item: PortfolioItemRequest):
    with get_db() as conn:
        conn.execute("INSERT OR IGNORE INTO portfolio_items (portfolio_id, ticker) VALUES (?, ?)", (pid, item.ticker))
        conn.commit()
    return {"status": "added"}

@router.delete("/{pid}/items/{ticker}")
def remove_ticker_from_watchlist(pid: int, ticker: str):
    with get_db() as conn:
        conn.execute("DELETE FROM portfolio_items WHERE portfolio_id = ? AND ticker = ?", (pid, ticker))
        conn.commit()
    return {"status": "removed"}