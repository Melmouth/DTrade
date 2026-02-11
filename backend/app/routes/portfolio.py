from fastapi import APIRouter, HTTPException
from ..database import get_db
from ..models import PortfolioRequest, PortfolioItemRequest
from ..services.market_data import provider
import sqlite3

router = APIRouter(prefix="/api", tags=["portfolio"])

@router.get("/sidebar")
def get_sidebar():
    """
    Récupère la liste des portfolios et les tickers associés.
    Utilise un chargement 'Bulk' pour récupérer les variations de prix 
    en une seule requête HTTP, au lieu de boucler sur chaque ticker.
    """
    with get_db() as conn:
        # 1. Récupération de la structure (Portfolios + Items)
        portfolios = conn.execute("SELECT * FROM portfolios").fetchall()
        all_items_rows = conn.execute("SELECT portfolio_id, ticker FROM portfolio_items").fetchall()

    # 2. Extraction des tickers uniques (Dédoublonnage)
    # Si 'AAPL' est dans 3 dossiers différents, on ne le demande qu'une fois à l'API.
    unique_tickers = list(set([row['ticker'] for row in all_items_rows]))

    # 3. Appel Bulk (1 requête HTTP unique)
    # Retourne un dict: {'AAPL': {'price': 150, 'change_pct': 1.5}, ...}
    bulk_data = provider.fetch_bulk_1m_status(unique_tickers)

    # 4. Reconstruction de la réponse hiérarchique
    result = []
    for p in portfolios:
        # Filtrage en mémoire (très rapide) pour retrouver les items de ce portfolio
        p_items = [row for row in all_items_rows if row['portfolio_id'] == p['id']]
        
        tickers_data = []
        for item in p_items:
            ticker = item['ticker']
            # On récupère la donnée du dictionnaire bulk
            # Si le ticker a échoué ou n'existe pas, on met 0 par défaut
            data = bulk_data.get(ticker, {})
            pct = data.get('change_pct', 0)
            
            tickers_data.append({
                "ticker": ticker, 
                "change_pct": pct
            })
        
        result.append({
            "id": p['id'], 
            "name": p['name'], 
            "items": tickers_data
        })
            
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