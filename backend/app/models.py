from pydantic import BaseModel

# Modèle générique pour les MAs (Optimisation de la période N)
class SmartPeriodRequest(BaseModel):
    ticker: str
    target_up_percent: float = 0.5
    lookback_days: int = 365

# Alias
class SmartSMARequest(SmartPeriodRequest): pass
class SmartEMARequest(SmartPeriodRequest): pass

# Modèle pour les Bandes (Optimisation du Multiplicateur K)
class SmartBandRequest(BaseModel):
    ticker: str
    target_inside_percent: float = 0.8 
    lookback_days: int = 365

# Modèle pour SuperTrend (Optimisation Factor)
class SmartFactorRequest(BaseModel):
    ticker: str
    target_up_percent: float = 0.5
    lookback_days: int = 365

class PortfolioRequest(BaseModel):
    name: str

class PortfolioItemRequest(BaseModel):
    ticker: str