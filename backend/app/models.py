from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Dict, Union, Any

# --- EXISTING MODELS (LEGACY & SMART INDICATORS) ---

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

# --- NEW: SHADOW BACK COMPUTE (SBC) MODELS ---

class IndicatorParams(BaseModel):
    """
    Modèle flexible pour les paramètres d'indicateurs.
    Permet des champs arbitraires (stdDev, multiplier, etc.) grâce à extra='allow'.
    """
    period: Optional[int] = 20
    
    class Config:
        extra = "allow" 

class IndicatorSaveRequest(BaseModel):
    """Payload pour la sauvegarde d'un indicateur"""
    ticker: str
    type: str              # ex: "SMA", "BB", "RSI"
    params: Dict[str, Any] # JSON d'objets params (period, color, etc.)
    style: Dict[str, Any]  # ex: {color: "#...", lineWidth: 1}
    granularity: str = "days" # "days" (Macro) ou "data" (Intraday)
    name: Optional[str] = None # Nom personnalisé par l'utilisateur

class IndicatorDTO(BaseModel):
    """Objet de transfert pour l'affichage liste des indicateurs"""
    id: int
    ticker: str
    type: str
    params: Dict[str, Any]
    style: Dict[str, Any]
    granularity: str
    name: str

# Structures pour les réponses de données calculées
class IndicatorPoint(BaseModel):
    time: int
    value: float

class IndicatorBandPoint(BaseModel):
    time: int
    upper: Optional[float] = None
    lower: Optional[float] = None
    basis: Optional[float] = None

# Union pour la réponse API : soit une ligne simple, soit des bandes
IndicatorDataResponse = List[Union[IndicatorPoint, IndicatorBandPoint, Dict[str, Any]]]

# --- EXISTING MODELS (DPMS / TRADING) ---

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
    current_price: float = 0.0  # Sera rempli par le live data
    market_value: float = 0.0   # Qty * CurrentPrice
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
    total_pnl: float    # Equity - Investissement initial
    pnl_pct: float
    positions_count: int
    invested_capital: float = 0.0 # Ajouté pour le suivi du capital réel