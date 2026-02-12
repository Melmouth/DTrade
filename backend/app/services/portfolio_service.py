import sqlite3
from datetime import datetime
from fastapi import HTTPException
from ..database import get_db
from ..models import OrderRequest, CashOperationRequest, PortfolioSummary, PositionDTO, TransactionDTO

def get_account():
    """Récupère le compte principal (Singleton pour cette version)."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM accounts LIMIT 1").fetchone()
        if not row:
            # Fallback de sécurité (ne devrait pas arriver si init_db a tourné)
            return {"id": 1, "balance": 0.0, "currency": "USD"}
        return dict(row)

def get_positions():
    """Récupère toutes les positions ouvertes."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM positions WHERE quantity > 0").fetchall()
        return [dict(r) for r in rows]

def get_history(limit: int = 50):
    """Récupère l'historique des transactions."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]

def manage_cash(req: CashOperationRequest):
    """Gère les Dépôts et Retraits (Cash In/Out)."""
    with get_db() as conn:
        account = conn.execute("SELECT * FROM accounts LIMIT 1").fetchone()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        current_balance = account['balance']
        new_balance = current_balance

        if req.type == 'DEPOSIT':
            new_balance += req.amount
        elif req.type == 'WITHDRAW':
            if req.amount > current_balance:
                raise HTTPException(status_code=400, detail="Insufficient funds")
            new_balance -= req.amount
        
        # 1. Update Balance
        conn.execute("UPDATE accounts SET balance = ? WHERE id = ?", (new_balance, account['id']))
        
        # 2. Log Transaction
        conn.execute("""
            INSERT INTO transactions (ticker, type, quantity, price, total_amount, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (None, req.type, None, None, req.amount, datetime.now()))
        
        return {"old_balance": current_balance, "new_balance": new_balance}

def execute_order(order: OrderRequest, live_price: float):
    """
    Exécute un ordre d'achat ou de vente.
    CRITIQUE : live_price doit être fourni par le contrôleur (source de vérité).
    """
    if live_price <= 0:
        raise HTTPException(status_code=400, detail="Invalid market price")

    # Calcul du montant total de la transaction
    total_value = order.quantity * live_price

    with get_db() as conn:
        # Récupération du compte (Lock implicite via transaction SQL)
        account = conn.execute("SELECT * FROM accounts LIMIT 1").fetchone()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        current_balance = account['balance']

        # --- LOGIQUE ACHAT (BUY) ---
        if order.action == 'BUY':
            if current_balance < total_value:
                raise HTTPException(status_code=400, detail=f"Insufficient funds. Need {total_value:.2f}, have {current_balance:.2f}")
            
            # 1. Débit Cash
            new_balance = current_balance - total_value
            conn.execute("UPDATE accounts SET balance = ? WHERE id = ?", (new_balance, account['id']))

            # 2. Gestion Position (Avg Price)
            pos = conn.execute("SELECT * FROM positions WHERE ticker = ?", (order.ticker,)).fetchone()
            
            if pos:
                # Update existant (Calcul PMP)
                old_qty = pos['quantity']
                old_avg = pos['avg_price']
                new_qty = old_qty + order.quantity
                # Formule Moyenne Pondérée
                new_avg = ((old_qty * old_avg) + (order.quantity * live_price)) / new_qty
                
                conn.execute("""
                    UPDATE positions SET quantity = ?, avg_price = ?, last_updated = CURRENT_TIMESTAMP 
                    WHERE ticker = ?
                """, (new_qty, new_avg, order.ticker))
            else:
                # Nouvelle position
                conn.execute("""
                    INSERT INTO positions (ticker, quantity, avg_price) VALUES (?, ?, ?)
                """, (order.ticker, order.quantity, live_price))

            # 3. Log Transaction
            conn.execute("""
                INSERT INTO transactions (ticker, type, quantity, price, total_amount, timestamp)
                VALUES (?, 'BUY', ?, ?, ?, CURRENT_TIMESTAMP)
            """, (order.ticker, order.quantity, live_price, total_value))

        # --- LOGIQUE VENTE (SELL) ---
        elif order.action == 'SELL':
            # 1. Vérif Position
            pos = conn.execute("SELECT * FROM positions WHERE ticker = ?", (order.ticker,)).fetchone()
            if not pos or pos['quantity'] < order.quantity:
                raise HTTPException(status_code=400, detail="Insufficient asset quantity")
            
            # 2. Crédit Cash
            new_balance = current_balance + total_value
            conn.execute("UPDATE accounts SET balance = ? WHERE id = ?", (new_balance, account['id']))

            # 3. Update Position
            new_qty = pos['quantity'] - order.quantity
            if new_qty > 0.000001: # Tolérance float
                # Le prix de revient (Avg Price) ne change PAS à la vente
                conn.execute("""
                    UPDATE positions SET quantity = ?, last_updated = CURRENT_TIMESTAMP 
                    WHERE ticker = ?
                """, (new_qty, order.ticker))
            else:
                # Clôture complète
                conn.execute("DELETE FROM positions WHERE ticker = ?", (order.ticker,))

            # 4. Log Transaction
            conn.execute("""
                INSERT INTO transactions (ticker, type, quantity, price, total_amount, timestamp)
                VALUES (?, 'SELL', ?, ?, ?, CURRENT_TIMESTAMP)
            """, (order.ticker, order.quantity, live_price, total_value))

        return {"status": "executed", "action": order.action, "ticker": order.ticker, "price": live_price}

def nuke_portfolio():
    """RESET COMPLET (Danger Zone)."""
    with get_db() as conn:
        # 1. Reset Cash (On ne remet pas 100k ici, on met 0, l'utilisateur devra déposer)
        conn.execute("UPDATE accounts SET balance = 0")
        # 2. Vide les positions
        conn.execute("DELETE FROM positions")
        # 3. Vide l'historique
        conn.execute("DELETE FROM transactions")
        # 4. Log le reset
        conn.execute("INSERT INTO transactions (type, total_amount) VALUES ('RESET', 0)")
        
    return {"status": "nuked"}