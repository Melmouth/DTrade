from fastapi import APIRouter, HTTPException
from typing import List
import json
import numpy as np
import pandas as pd

from ..database import get_db
from ..models import (
    # Nouveaux Modèles SBC
    IndicatorSaveRequest, IndicatorDTO, 
    # Modèles Smart AI existants
    SmartPeriodRequest, SmartBandRequest, SmartFactorRequest
)
from ..services import market_data, optimizer
from ..services.indicators import compute_indicator

# Préfixe global : toutes les routes commencent par /api/indicators
router = APIRouter(prefix="/api/indicators", tags=["indicators"])

# ==============================================================================
# 1. SHADOW BACK COMPUTE (SBC) - CRUD & CALCULATION ENGINE
# ==============================================================================

@router.get("/{ticker}", response_model=List[IndicatorDTO])
def get_saved_indicators(ticker: str):
    """
    Récupère la configuration des indicateurs sauvegardés pour un ticker.
    N'inclut pas les données lourdes (points), seulement la config.
    """
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM saved_indicators WHERE ticker = ?", 
            (ticker,)
        ).fetchall()
        
    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "ticker": r["ticker"],
            "type": r["type"],
            "name": r["name"] or r["type"],
            "params": json.loads(r["params"]),
            "style": json.loads(r["style"]),
            "granularity": r["granularity"]
        })
    return results

@router.post("/", response_model=IndicatorDTO)
def save_indicator(req: IndicatorSaveRequest):
    """
    Sauvegarde la configuration d'un indicateur créé dans le Frontend.
    """
    params_json = json.dumps(req.params)
    style_json = json.dumps(req.style)
    
    with get_db() as conn:
        cursor = conn.execute("""
            INSERT INTO saved_indicators (ticker, type, name, params, style, granularity)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (req.ticker, req.type, req.name, params_json, style_json, req.granularity))
        new_id = cursor.lastrowid
        conn.commit()

    return {
        "id": new_id,
        "ticker": req.ticker,
        "type": req.type,
        "name": req.name,
        "params": req.params,
        "style": req.style,
        "granularity": req.granularity
    }

@router.delete("/{ind_id}")
def delete_indicator(ind_id: int):
    """Supprime un indicateur de la base."""
    with get_db() as conn:
        conn.execute("DELETE FROM saved_indicators WHERE id = ?", (ind_id,))
        conn.commit()
    return {"status": "deleted"}

@router.get("/{ticker}/calculate/{ind_id}")
def calculate_saved_indicator(ticker: str, ind_id: int):
    """
    SBC CORE : Recalcule les données d'un indicateur sauvegardé.
    Utilise le moteur Python strict (Pandas/Numpy) sur des données consolidées.
    """
    # 1. Chargement de la config depuis la DB
    with get_db() as conn:
        row = conn.execute("SELECT * FROM saved_indicators WHERE id = ?", (ind_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Indicator not found")
    
    params = json.loads(row["params"])
    ind_type = row["type"]
    granularity = row["granularity"]
    
    # 2. Récupération de l'Historique Consolidé (Market Data Service)
    # Si granularity='days' -> 2 ans de daily
    # Si granularity='data' -> 5 jours de 5m (ou 1m selon dispo)
    period_fetch = "2y" if granularity == 'days' else "5d"
    interval_fetch = "1d" if granularity == 'days' else "5m"
    
    # On tape directement le provider pour avoir un DataFrame Pandas propre
    df = market_data.provider.fetch_history(ticker, period_fetch, interval_fetch)
    
    if df is None or df.empty:
        return []

    # 3. Exécution du Moteur de Calcul Python
    try:
        data = compute_indicator(ind_type, df, params)
        return data
    except Exception as e:
        print(f"[SBC] Calculation Error for {ind_type}: {e}")
        # On renvoie une erreur 500 propre pour que le front sache qu'il y a un souci de calc
        raise HTTPException(500, f"Math Engine Error: {str(e)}")


# ==============================================================================
# 2. SMART AI OPTIMIZER WRAPPERS (LEGACY / AI FEATURES)
# ==============================================================================

# Ces routes sont conservées pour le mode "Smart" de l'éditeur.
# Elles calculent les meilleurs paramètres mais ne sauvegardent rien.

@router.post("/smart/sma")
def smart_sma(req: SmartPeriodRequest):
    return optimizer.optimize_period_ma(req.ticker, req.target_up_percent, req.lookback_days, 
        lambda df, n: df['Close'].rolling(n).mean())

@router.post("/smart/ema")
def smart_ema(req: SmartPeriodRequest):
    return optimizer.optimize_period_ma(req.ticker, req.target_up_percent, req.lookback_days, 
        lambda df, n: df['Close'].ewm(span=n, adjust=False).mean())

@router.post("/smart/wma")
def smart_wma(req: SmartPeriodRequest):
    return optimizer.optimize_period_ma(req.ticker, req.target_up_percent, req.lookback_days, 
        lambda df, n: optimizer.calculate_wma(df['Close'], n))

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
    return optimizer.optimize_band_multiplier(req.ticker, req.target_inside_percent, req.lookback_days, 
        lambda df, k: (df['Close'].rolling(20).mean() * (1 + k/100), df['Close'].rolling(20).mean() * (1 - k/100)))

@router.post("/smart/supertrend")
def smart_supertrend(req: SmartFactorRequest):
    return optimizer.optimize_supertrend(req.ticker, req.target_up_percent, req.lookback_days)