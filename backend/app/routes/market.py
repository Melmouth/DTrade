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

# --- ROUTES SATELLITES (NETTOYÉES) ---

@router.get("/api/company/{ticker}")
def get_company_info_route(ticker: str):
    """
    Appelé par CompanyInfo.jsx.
    Version optimisée : Ne charge QUE les métadonnées (pas d'historique).
    """
    # Utilisation de la nouvelle méthode légère + Serializer partagé
    data = market_data.get_company_profile(ticker)
    
    if not data:
        raise HTTPException(404, detail="Info introuvable")
    return data