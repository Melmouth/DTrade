from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from typing import Annotated, Literal, Optional, List, Dict, Union, Any
from datetime import datetime
import math

Ticker = Annotated[str, StringConstraints(pattern=r"^[A-Z0-9^][A-Z0-9.^=\-]{0,19}$", max_length=20)]
Period = Literal["1d", "5d", "1mo", "3mo", "6mo", "ytd", "1y", "2y", "5y", "max"]
Resolution = Literal["1m", "2m", "5m", "15m", "30m", "1h", "60m", "1d", "1wk", "1mo"]
IndicatorType = Literal["SMA", "EMA", "WMA", "HMA", "VWMA", "DEMA", "TEMA", "ZLEMA", "KAMA", "MCG", "BB", "KELT", "DONCH", "ENV", "STARC", "REG", "SUPERT", "PSAR", "CHAND"]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80, pattern=r"^[^\x00-\x1f\x7f]+$")]

class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

class SmartPeriodRequest(InputModel):
    ticker: Ticker
    target_up_percent: float = Field(0.5, ge=0, le=1)
    lookback_days: int = Field(365, ge=30, le=1825)

class SmartSMARequest(SmartPeriodRequest): pass
class SmartEMARequest(SmartPeriodRequest): pass

class SmartBandRequest(InputModel):
    ticker: Ticker
    target_inside_percent: float = Field(0.8, ge=0, le=1)
    lookback_days: int = Field(365, ge=30, le=1825)

class SmartFactorRequest(SmartPeriodRequest): pass

class PortfolioRequest(InputModel):
    name: Label

class PortfolioItemRequest(InputModel):
    ticker: Ticker

class IndicatorSaveRequest(InputModel):
    ticker: Ticker
    type: IndicatorType
    params: Dict[str, Any] = Field(max_length=16)
    style: Dict[str, Any] = Field(max_length=8)
    granularity: Literal["days", "data"] = "days"
    resolution: Resolution = "1d"
    period: Period = "1mo"
    name: Optional[Label] = None

    @field_validator("params")
    @classmethod
    def bounded_params(cls, params):
        permitted = {"period", "stdDev", "deviation", "multiplier", "factor", "step", "max", "maxAf", "atrPeriod", "atrMultiplier", "offset", "source"}
        if params.keys() - permitted:
            raise ValueError("Unknown indicator parameter")
        for key, value in params.items():
            if key == "source":
                if not isinstance(value, str) or value not in {"close", "open", "high", "low", "hl2", "hlc3", "ohlc4", "Close", "Open", "High", "Low"}:
                    raise ValueError("Invalid source")
                continue
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
                raise ValueError("Finite numeric parameters required")
            if "period" in key.lower():
                if value != int(value) or not 2 <= value <= 500:
                    raise ValueError("Periods must be integers between 2 and 500")
            elif not 0 < value <= 100:
                raise ValueError("Parameter outside supported bounds")
        return params

    @field_validator("style")
    @classmethod
    def bounded_style(cls, style):
        import re
        for key, value in style.items():
            if key in {"color", "lineColor", "fillColor"}:
                if not isinstance(value, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?", value):
                    raise ValueError("Hexadecimal color required")
            elif key == "lineWidth":
                if type(value) is not int or not 1 <= value <= 5:
                    raise ValueError("Invalid line width")
            elif key == "lineStyle":
                if type(value) is not int or not 0 <= value <= 4:
                    raise ValueError("Invalid line style")
            elif key == "type":
                if not isinstance(value, str) or value not in {"LINE", "BAND"}:
                    raise ValueError("Invalid display type")
            elif key == "visible":
                if type(value) is not bool:
                    raise ValueError("Invalid visibility")
            else:
                raise ValueError("Unknown style parameter")
        return style

class IndicatorDTO(BaseModel):
    id: int
    ticker: str
    type: str
    params: Dict[str, Any]
    style: Dict[str, Any]
    granularity: str
    resolution: str
    period: str
    name: str
    created_at: Optional[datetime] = None # <--- AJOUT CRITIQUE

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

class OrderRequest(InputModel):
    ticker: Ticker
    action: Literal['BUY', 'SELL']
    quantity: float = Field(..., gt=0, le=1_000_000, description="Quantité d'actions")

class CashOperationRequest(InputModel):
    amount: float = Field(..., gt=0, le=1_000_000_000, description="Montant positif uniquement")
    type: Literal['DEPOSIT', 'WITHDRAW']

class PositionDTO(BaseModel):
    ticker: str
    quantity: float
    avg_price: float
    current_price: float = 0.0
    market_value: float = 0.0
    pnl_unrealized: float = 0.0
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
    equity_value: float
    total_pnl: float
    pnl_pct: float
    positions_count: int
    invested_capital: float = 0.0
