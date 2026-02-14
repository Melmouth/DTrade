from fastapi import APIRouter, HTTPException
from ..services import portfolio_service, market_data
from ..models import OrderRequest, CashOperationRequest
from ..database import get_db

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

@router.get("/summary")
def get_portfolio_summary():
    """
    Dashboard principal : Cash, Equity Totale, P&L Global.
    Calcul dynamique basé sur l'historique des transactions.
    """
    # 1. Récupérer le cash et le Capital Investi (Net Deposits)
    with get_db() as conn:
        account = conn.execute("SELECT * FROM accounts LIMIT 1").fetchone()
        cash = account['balance'] if account else 0.0

        # Calculer le total investi (Dépôts - Retraits)
        # On utilise COALESCE ou "or 0.0" pour gérer le cas où c'est vide (None)
        dep = conn.execute("SELECT SUM(total_amount) FROM transactions WHERE type='DEPOSIT'").fetchone()[0] or 0.0
        wit = conn.execute("SELECT SUM(total_amount) FROM transactions WHERE type='WITHDRAW'").fetchone()[0] or 0.0
        invested_capital = dep - wit

    # 2. Récupérer les positions
    positions = portfolio_service.get_positions()

    # 3. Calculer l'Equity (Valeur Latente)
    equity_positions = 0.0
    for pos in positions:
        live = market_data.provider.fetch_live_price(pos['ticker'])
        current_price = live.get('price', 0.0)
        equity_positions += pos['quantity'] * current_price

    total_equity = cash + equity_positions
    
    # 4. Calcul du P&L Réel (Equity actuelle - Capital réellement investi)
    # Si aucun capital investi (cas après un nuke total sans dépôt), on évite la division par zéro
    if invested_capital <= 0:
        total_pnl = 0.0
        pnl_pct = 0.0
    else:
        total_pnl = total_equity - invested_capital
        pnl_pct = total_pnl / invested_capital

    return {
        "cash_balance": round(cash, 2),
        "equity_value": round(total_equity, 2),
        "total_pnl": round(total_pnl, 2),
        "pnl_pct": round(pnl_pct, 4),
        "positions_count": len(positions),
        "invested_capital": invested_capital # On renvoie cette info au front pour le calcul temps réel
    }

@router.get("/positions")
def get_open_positions():
    """
    Liste détaillée des actifs détenus avec calcul P&L temps réel.
    """
    positions = portfolio_service.get_positions()
    results = []

    for pos in positions:
        live = market_data.provider.fetch_live_price(pos['ticker'])
        current_price = live.get('price', 0.0)
        market_val = pos['quantity'] * current_price
        
        # P&L Latent = (Prix Actuel - Prix Moyen) * Qté
        pnl_unrealized = (current_price - pos['avg_price']) * pos['quantity']
        pnl_pct = (pnl_unrealized / (pos['avg_price'] * pos['quantity'])) if pos['avg_price'] > 0 else 0

        results.append({
            "ticker": pos['ticker'],
            "quantity": pos['quantity'],
            "avg_price": pos['avg_price'],
            "current_price": current_price,
            "market_value": round(market_val, 2),
            "pnl_unrealized": round(pnl_unrealized, 2),
            "pnl_pct": round(pnl_pct, 4)
        })
    
    return results

@router.get("/history")
def get_transactions_history():
    return portfolio_service.get_history()

@router.post("/order")
def place_order(order: OrderRequest):
    """
    Passe un ordre. Le backend vérifie le prix LIVE avant d'exécuter.
    """
    # 1. Récupération du prix autoritaire
    live = market_data.provider.fetch_live_price(order.ticker)
    price = live.get('price', 0.0)
    
    if price <= 0:
        raise HTTPException(400, "Marché fermé ou donnée indisponible")

    # 2. Exécution via le service (Transactionnel)
    return portfolio_service.execute_order(order, price)

@router.post("/cash")
def manage_cash_flow(req: CashOperationRequest):
    return portfolio_service.manage_cash(req)

@router.post("/nuke")
def nuke_data():
    return portfolio_service.nuke_portfolio()