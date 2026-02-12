from fastapi import APIRouter, HTTPException
from ..services import portfolio_service, market_data
from ..models import OrderRequest, CashOperationRequest

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

@router.get("/summary")
def get_portfolio_summary():
    """
    Dashboard principal : Cash, Equity Totale, P&L Global.
    """
    # 1. Récupérer le cash
    account = portfolio_service.get_account()
    cash = account['balance']

    # 2. Récupérer les positions
    positions = portfolio_service.get_positions()

    # 3. Calculer l'Equity (Valeur Latente)
    equity_positions = 0.0
    
    # On récupère les prix live pour toutes les positions
    # (Optimisation: on pourrait faire un bulk fetch ici aussi si beaucoup de positions)
    for pos in positions:
        live = market_data.provider.fetch_live_price(pos['ticker'])
        current_price = live.get('price', 0.0)
        equity_positions += pos['quantity'] * current_price

    total_equity = cash + equity_positions
    
    # 4. Estimation simplifiée du P&L (Equity actuelle - 100k départ)
    # Dans une version avancée, on sommerait les dépôts nets.
    start_capital = 100000.0 
    total_pnl = total_equity - start_capital
    pnl_pct = (total_pnl / start_capital) if start_capital > 0 else 0.0

    return {
        "cash_balance": round(cash, 2),
        "equity_value": round(total_equity, 2),
        "total_pnl": round(total_pnl, 2),
        "pnl_pct": round(pnl_pct, 4),
        "positions_count": len(positions)
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