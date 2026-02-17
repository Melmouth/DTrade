from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import json
import pandas as pd
import numpy as np

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
            "resolution": r["resolution"], 
            "period": r["period"] or "1mo",
            "created_at": r["created_at"]
        })
    return results

@router.post("/", response_model=IndicatorDTO)
def save_indicator(req: IndicatorSaveRequest):
    params_json = json.dumps(req.params)
    style_json = json.dumps(req.style)
    
    # 1. RBI LOGIC : ON FAIT CONFIANCE AU FRONTEND
    # Si le front a envoyé une resolution précise (1m, 5m, 1h), on l'utilise.
    # Sinon (Legacy), on applique la logique de fallback.
    final_resolution = req.resolution
    
    if not final_resolution:
        if req.granularity == 'days':
            final_resolution = '1d'
        else:
            # Fallback legacy si le front n'est pas à jour
            if req.period in ['1d', '5d']: final_resolution = '1m'
            elif req.period == '1mo': final_resolution = '1h'
            else: final_resolution = '1d'

    with get_db() as conn:
        cursor = conn.execute("""
            INSERT INTO saved_indicators (ticker, type, name, params, style, granularity, resolution, period)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (req.ticker, req.type, req.name, params_json, style_json, req.granularity, final_resolution, req.period))
        new_id = cursor.lastrowid
        
        # Récupération immédiate du timestamp de création
        created_row = conn.execute("SELECT created_at FROM saved_indicators WHERE id = ?", (new_id,)).fetchone()
        created_at = created_row['created_at'] if created_row else None
        
        conn.commit()

    return {
        "id": new_id,
        "ticker": req.ticker,
        "type": req.type,
        "name": req.name,
        "params": req.params,
        "style": req.style,
        "granularity": req.granularity,
        "resolution": final_resolution,
        "period": req.period,
        "created_at": created_at
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
    # context_period est obsolète pour le calcul RBI pur, mais on le garde pour compatibilité API
    context_period: Optional[str] = Query(None) 
):
    """
    RBI CORE : Calcul basé STRICTEMENT sur la résolution stockée.
    L'indicateur est 'Timeframe Invariant'. Il ignore la vue actuelle du graphique.
    """
    with get_db() as conn:
        row = conn.execute("SELECT * FROM saved_indicators WHERE id = ?", (ind_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Indicator not found")
    
    params = json.loads(row["params"])
    ind_type = row["type"]
    resolution = row["resolution"] # <--- VÉRITÉ TERRAIN (ex: '1m', '1d')
    
    # --- LOGIQUE RBI : RÉSOLUTION -> FETCH PARAMS ---
    # On utilise la nouvelle fonction de résolution stricte
    period_fetch, interval_fetch = market_data.resolve_fetch_params_from_resolution(resolution)

    # 2. Fetch Data (Indépendant du graphique actuel)
    df = market_data.provider.fetch_history(ticker, period_fetch, interval_fetch)
    
    if df is None or df.empty:
        return []

    # 3. Calcul
    try:
        data = compute_indicator(ind_type, df, params)
        return data
    except Exception as e:
        print(f"[RBI] Calculation Error for {ind_type} ({resolution}): {e}")
        return []

# --- SMART AI ROUTES ---

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