import pandas as pd
import numpy as np
from .trend import *
from .volatility import *
from .stops import *

# Mapping des IDs
REGISTRY = {
    "SMA": indicator_sma, "EMA": indicator_ema, "WMA": indicator_wma, "HMA": indicator_hma,
    "VWMA": indicator_vwma, "DEMA": indicator_dema, "TEMA": indicator_tema, "ZLEMA": indicator_zlema,
    "KAMA": indicator_kama, "MCG": indicator_mcg,
    "BB": indicator_bb, "KELT": indicator_kelt, "DONCH": indicator_donch, "ENV": indicator_envelope,
    "STARC": indicator_starc, "REG": indicator_reg,
    "SUPERT": indicator_supert, "PSAR": indicator_psar, "CHAND": indicator_chand
}

def clean_nan(val):
    if val is None or pd.isna(val) or np.isinf(val):
        return None
    return float(val)

def compute_indicator(id_key: str, df: pd.DataFrame, params: dict):
    func = REGISTRY.get(id_key)
    if not func:
        raise ValueError(f"Indicator {id_key} not implemented")
        
    # --- 1. SANITIZATION DE L'INDEX (CRITIQUE) ---
    # On veut un DatetimeIndex UTC propre.
    
    # A. Check colonnes si l'index est un RangeIndex (0, 1, 2...)
    if not isinstance(df.index, pd.DatetimeIndex):
        # On cherche une colonne date candidate
        candidate_cols = [c for c in df.columns if c.lower() in ['date', 'datetime', 'time', 'timestamp']]
        if candidate_cols:
            df = df.set_index(candidate_cols[0])
    
    # B. Force conversion (Blindé)
    try:
        # coerce=errors permet de gérer les cas exotiques
        df.index = pd.to_datetime(df.index, utc=True)
    except Exception as e:
        print(f"[SBC] Index conversion failed: {e}")
        return []

    # C. Tri et Dédoublonnage (Vital pour le Frontend)
    df = df.sort_index()
    df = df[~df.index.duplicated(keep='last')]

    # --- 2. CALCUL ---
    try:
        result = func(df, params)
    except Exception as e:
        print(f"[SBC] Math Error on {id_key}: {e}")
        return []
    
    # --- 3. EXTRACTION DES TIMESTAMPS (SAFE) ---
    # On utilise la méthode map(timestamp) qui renvoie toujours des secondes (float)
    # peu importe si l'index est en ns, ms ou s.
    try:
        timestamps = df.index.map(lambda x: int(x.timestamp())).tolist()
    except:
        # Fallback ultime
        timestamps = [int(x.timestamp()) for x in df.index]

    output_data = []
    
    # --- 4. FORMATAGE SORTIE ---
    
    # Cas A : Série Unique
    if isinstance(result, pd.Series):
        if len(result) != len(timestamps):
            result = result.reindex(df.index)
        
        values = result.values
        for t, v in zip(timestamps, values):
            val = clean_nan(v)
            if val is not None:
                output_data.append({"time": t, "value": val})
                
    # Cas B : Bandes (Dict)
    elif isinstance(result, dict):
        keys = list(result.keys())
        # Alignement
        for k in keys:
            if len(result[k]) != len(timestamps):
                result[k] = result[k].reindex(df.index)
        
        for i, t in enumerate(timestamps):
            row = {"time": t}
            has_data = False
            for k in keys:
                val = clean_nan(result[k].iloc[i])
                row[k] = val
                if val is not None: has_data = True
            if has_data:
                output_data.append(row)
                
    return output_data