from fastapi import APIRouter, HTTPException
from ..services import market_data

router = APIRouter(tags=["market"])

# --- ROUTE PRINCIPALE (SNAPSHOT) ---
@router.get("/api/snapshot/{ticker}")
def get_market_snapshot(ticker: str, period: str = "1mo"):
    """
    Appelé par App.jsx pour l'affichage principal.
    Charge tout : Graphique, Info, Prix, Status.
    """
    data = market_data.get_full_snapshot(ticker, period)
    if not data:
        raise HTTPException(404, detail="Ticker introuvable ou API erreur")
    return data

# --- ROUTES SATELLITES (RÉTABLIES) ---

@router.get("/api/status/{ticker}")
def get_lightweight_status(ticker: str):
    """
    Appelé par la Sidebar pour les petites pastilles (vert/rouge).
    Ultra-léger, pas d'historique.
    """
    # On utilise directement la méthode live du service
    return market_data._fetch_live_data(ticker)

@router.get("/api/company/{ticker}")
def get_company_info_route(ticker: str):
    """
    Appelé par CompanyInfo.jsx si les données ne sont pas pré-chargées.
    """
    # On réutilise le snapshot mais on ne renvoie que la partie info
    # C'est plus simple que de recréer une fonction dédiée dans le service
    data = market_data.get_full_snapshot(ticker, "1d") # Période minime pour aller vite
    if not data or 'info' not in data:
        raise HTTPException(404, detail="Info introuvable")
    return data['info']