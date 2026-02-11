from fastapi import APIRouter, HTTPException
import numpy as np
import pandas as pd
from ..models import SmartPeriodRequest, SmartBandRequest, SmartFactorRequest
from ..services import optimizer

router = APIRouter(prefix="/api/indicators/smart", tags=["indicators"])

# --- MA WRAPPERS ---
@router.post("/sma")
def smart_sma(req: SmartPeriodRequest):
    return optimizer.optimize_period_ma(req.ticker, req.target_up_percent, req.lookback_days, 
        lambda df, n: df['Close'].rolling(n).mean())

@router.post("/ema")
def smart_ema(req: SmartPeriodRequest):
    return optimizer.optimize_period_ma(req.ticker, req.target_up_percent, req.lookback_days, 
        lambda df, n: df['Close'].ewm(span=n, adjust=False).mean())

@router.post("/wma")
def smart_wma(req: SmartPeriodRequest):
    return optimizer.optimize_period_ma(req.ticker, req.target_up_percent, req.lookback_days, 
        lambda df, n: optimizer.calculate_wma(df['Close'], n))

@router.post("/hma")
def smart_hma(req: SmartPeriodRequest):
    def calc_hma(df, n):
        wma_half = optimizer.calculate_wma(df['Close'], int(n/2))
        wma_full = optimizer.calculate_wma(df['Close'], n)
        raw_hma = 2 * wma_half - wma_full
        return optimizer.calculate_wma(raw_hma, int(np.sqrt(n)))
    return optimizer.optimize_period_ma(req.ticker, req.target_up_percent, req.lookback_days, calc_hma)

# --- BANDS WRAPPERS ---
@router.post("/bollinger")
def smart_bollinger(req: SmartBandRequest):
    def calc(df, k):
        sma = df['Close'].rolling(20).mean()
        std = df['Close'].rolling(20).std()
        return (sma + std * k), (sma - std * k)
    return optimizer.optimize_band_multiplier(req.ticker, req.target_inside_percent, req.lookback_days, calc)

@router.post("/envelope")
def smart_envelope(req: SmartBandRequest):
    # Envelope utilise un % (ex: 5.0) mais le service test 0.1->5.0
    # On ruse un peu pour adapter
    res = optimizer.optimize_band_multiplier(req.ticker, req.target_inside_percent, req.lookback_days, 
        lambda df, k: (df['Close'].rolling(20).mean() * (1 + k/100), df['Close'].rolling(20).mean() * (1 - k/100)))
    # Note: Dans le code précédent, on itérait le pourcentage directement. 
    # Pour simplifier ici, on utilise le logic générique et on assume que k est le facteur direct.
    # Pour Env, on retourne le %
    return res

# --- STOPS ---
@router.post("/supertrend")
def smart_supertrend(req: SmartFactorRequest):
    return optimizer.optimize_supertrend(req.ticker, req.target_up_percent, req.lookback_days)