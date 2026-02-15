from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import json
import pandas as pd

from ..database import get_db
from ..models import (
    IndicatorSaveRequest, IndicatorDTO, 
    SmartPeriodRequest, SmartBandRequest, SmartFactorRequest
)
from ..services import market_data, optimizer
from ..services.indicators import compute_indicator

router = APIRouter(prefix="/api/indicators", tags=["indicators"])

@router.get("/{ticker}", response_model=List[IndicatorDTO])
def get_saved_indicators(ticker: str):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM saved_indicators WHERE ticker = ?", (ticker,)).fetchall()
        
    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "ticker": r["ticker"],
            "type": r["type"],
            "name": r["name"] or r["type"],
            "params": json.loads(r["params"]),
            "style": json.loads(r["style"]),
            "granularity": r["granularity"],
            "period": r["period"] or "1mo" 
        })
    return results

@router.post("/", response_model=IndicatorDTO)
def save_indicator(req: IndicatorSaveRequest):
    params_json = json.dumps(req.params)
    style_json = json.dumps(req.style)
    
    with get_db() as conn:
        cursor = conn.execute("""
            INSERT INTO saved_indicators (ticker, type, name, params, style, granularity, period)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (req.ticker, req.type, req.name, params_json, style_json, req.granularity, req.period))
        new_id = cursor.lastrowid
        conn.commit()

    return {
        "id": new_id,
        "ticker": req.ticker,
        "type": req.type,
        "name": req.name,
        "params": req.params,
        "style": req.style,
        "granularity": req.granularity,
        "period": req.period
    }

@router.delete("/{ind_id}")
def delete_indicator(ind_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM saved_indicators WHERE id = ?", (ind_id,))
        conn.commit()
    return {"status": "deleted"}

@router.get("/{ticker}/calculate/{ind_id}")
def calculate_saved_indicator(
    ticker: str, 
    ind_id: int, 
    context_period: Optional[str] = Query(None) # <--- ZERO-DISCREPANCY FIX
):
    """
    SBC CORE : Calcul "Zero-Discrepancy".
    context_period: La vue actuelle du graphique (ex: '1d', '1mo') envoyée par le front.
    """
    with get_db() as conn:
        row = conn.execute("SELECT * FROM saved_indicators WHERE id = ?", (ind_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Indicator not found")
    
    params = json.loads(row["params"])
    ind_type = row["type"]
    granularity = row["granularity"]
    
    # --- LOGIQUE D'HARMONISATION DE CONTEXTE ---
    
    period_fetch = "2y" 
    interval_fetch = "1d"
    
    if granularity == 'days':
        # CAS 1 : MACRO / DAILY
        # On force toujours une vue long terme, peu importe le zoom du graphique
        period_fetch = "2y"
        interval_fetch = "1d"
        
    else:
        # CAS 2 : INTRADAY / CHART
        # C'est ici que le bug résidait. On ne doit PAS utiliser row['period'] (création)
        # de manière stricte si le contexte visuel a changé.
        
        # Si le front nous dit "Je suis en 1d", on utilise '1d'. Sinon fallback sur la DB.
        active_period = context_period if context_period else (row["period"] or "1mo")
        
        # On demande au service de nous donner les params exacts correspondant à cette vue
        # Ex: Vue '1d' -> Fetch '5d' en '1m' (Warmup inclus)
        period_fetch, interval_fetch = market_data.resolve_fetch_params(active_period)
    
    # 2. Fetch Data (Même source que le Front)
    df = market_data.provider.fetch_history(ticker, period_fetch, interval_fetch)
    
    if df is None or df.empty:
        return []

    # 3. Calcul & Retour
    try:
        data = compute_indicator(ind_type, df, params)
        return data
    except Exception as e:
        print(f"[SBC] Calculation Error for {ind_type}: {e}")
        # On ne raise pas 500 pour ne pas crasher tout le dashboard si un calcul fail
        return []

# ... (Routes Smart AI inchangées)
@router.post("/smart/sma")
def smart_sma(req: SmartPeriodRequest):
    return optimizer.optimize_period_ma(req.ticker, req.target_up_percent, req.lookback_days, lambda df, n: df['Close'].rolling(n).mean())
@router.post("/smart/ema")
def smart_ema(req: SmartPeriodRequest):
    return optimizer.optimize_period_ma(req.ticker, req.target_up_percent, req.lookback_days, lambda df, n: df['Close'].ewm(span=n, adjust=False).mean())
@router.post("/smart/wma")
def smart_wma(req: SmartPeriodRequest):
    return optimizer.optimize_period_ma(req.ticker, req.target_up_percent, req.lookback_days, lambda df, n: optimizer.calculate_wma(df['Close'], n))
@router.post("/smart/hma")
def smart_hma(req: SmartPeriodRequest):
    def calc_hma(df, n):
        wma_half = optimizer.calculate_wma(df['Close'], int(n/2))
        wma_full = optimizer.calculate_wma(df['Close'], n)
        raw_hma = 2 * wma_half - wma_full
        return optimizer.calculate_wma(raw_hma, int(np.sqrt(n)))
    return optimizer.optimize_period_ma(req.ticker, req.target_up_percent, req.lookback_days, calc_hma)
@router.post("/smart/bollinger")
def smart_bollinger(req: SmartBandRequest):
    def calc(df, k):
        sma = df['Close'].rolling(20).mean()
        std = df['Close'].rolling(20).std()
        return (sma + std * k), (sma - std * k)
    return optimizer.optimize_band_multiplier(req.ticker, req.target_inside_percent, req.lookback_days, calc)
@router.post("/smart/envelope")
def smart_envelope(req: SmartBandRequest):
    return optimizer.optimize_band_multiplier(req.ticker, req.target_inside_percent, req.lookback_days, lambda df, k: (df['Close'].rolling(20).mean() * (1 + k/100), df['Close'].rolling(20).mean() * (1 - k/100)))
@router.post("/smart/supertrend")
def smart_supertrend(req: SmartFactorRequest):
    return optimizer.optimize_supertrend(req.ticker, req.target_up_percent, req.lookback_days)