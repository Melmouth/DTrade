from pydantic import BaseModel, Field
from typing import Literal, Optional, List

# --- EXISTING MODELS (INDICATORS) ---
class SmartPeriodRequest(BaseModel):
    ticker: str
    target_up_percent: float = 0.5
    lookback_days: int = 365

class SmartSMARequest(SmartPeriodRequest): pass
class SmartEMARequest(SmartPeriodRequest): pass

class SmartBandRequest(BaseModel):
    ticker: str
    target_inside_percent: float = 0.8 
    lookback_days: int = 365

class SmartFactorRequest(BaseModel):
    ticker: str
    target_up_percent: float = 0.5
    lookback_days: int = 365

class PortfolioRequest(BaseModel):
    name: str

class PortfolioItemRequest(BaseModel):
    ticker: str

# --- NEW: DPMS MODELS (EPIC 1) ---

class OrderRequest(BaseModel):
    ticker: str
    action: Literal['BUY', 'SELL']
    quantity: float = Field(..., gt=0, description="Quantité d'actions") 

class CashOperationRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Montant positif uniquement")
    type: Literal['DEPOSIT', 'WITHDRAW']

class PositionDTO(BaseModel):
    ticker: str
    quantity: float
    avg_price: float
    current_price: float = 0.0 # Sera rempli par le live data
    market_value: float = 0.0  # Qty * CurrentPrice
    pnl_unrealized: float = 0.0 # MarketValue - (Qty * AvgPrice)
    pnl_pct: float = 0.0

class TransactionDTO(BaseModel):
    id: int
    ticker: Optional[str]
    type: str
    quantity: Optional[float]
    price: Optional[float]
    total_amount: float
    timestamp: str

class PortfolioSummary(BaseModel):
    cash_balance: float
    equity_value: float # Cash + Valeur Positions
    total_pnl: float    # Equity - Investissement initial (ou simple diff vs cash start)
    pnl_pct: float
    positions_count: int