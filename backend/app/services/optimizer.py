import numpy as np
import pandas as pd
from datetime import timedelta
from .market_data import get_internal_history

# --- MATH HELPERS ---
def calculate_wma(series, period):
    weights = np.arange(1, period + 1)
    def weighted_mean(x): return np.dot(x, weights) / weights.sum()
    return series.rolling(window=period).apply(weighted_mean, raw=True)

def calculate_atr(high, low, close, period=14):
    tr1 = high - low
    tr2 = (high - close.shift()).abs()
    tr3 = (low - close.shift()).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.ewm(alpha=1/period, adjust=False).mean()

# --- OPTIMIZERS ---

def optimize_period_ma(ticker, target_up, lookback, calc_func):
    df = get_clean_history(ticker, lookback)
    if df is None: raise ValueError("Data unavailable")
    
    closes = df['Close']
    cutoff_date = df.index[-1] - timedelta(days=lookback)
    
    best_n = 20
    min_error = 1.0
    best_actual = 0.0

    possible_periods = range(5, 201, 2)

    for n in possible_periods:
        try:
            ma_series = calc_func(df, n)
            mask = df.index >= cutoff_date
            valid_c = closes[mask]
            valid_ma = ma_series[mask]
            
            if len(valid_c) == 0: continue
            
            ratio = (valid_c > valid_ma).sum() / len(valid_c)
            error = abs(ratio - target_up)
            
            if error < min_error:
                min_error = error
                best_n = n
                best_actual = ratio
                if min_error < 0.005: break
        except: continue

    return { "optimal_n": best_n, "actual_pct": round(best_actual, 4) }

def optimize_band_multiplier(ticker, target_inside, lookback, calc_func):
    df = get_clean_history(ticker, lookback)
    if df is None: raise ValueError("Data unavailable")
    
    closes = df['Close']
    cutoff_date = df.index[-1] - timedelta(days=lookback)
    mask = df.index >= cutoff_date
    valid_c = closes[mask]

    best_k = 2.0
    min_error = 1.0
    best_actual = 0.0
    
    possible_k = [x / 10.0 for x in range(1, 51)]
    
    for k in possible_k:
        try:
            upper, lower = calc_func(df, k)
            valid_u = upper[mask]
            valid_l = lower[mask]
            
            inside_count = ((valid_c <= valid_u) & (valid_c >= valid_l)).sum()
            ratio = inside_count / len(valid_c)
            
            if abs(ratio - target_inside) < min_error:
                min_error = abs(ratio - target_inside)
                best_k = k
                best_actual = ratio
                if min_error < 0.005: break
        except: continue
    
    return { "optimal_k": best_k, "actual_pct": round(best_actual, 4) }

def optimize_supertrend(ticker, target_up, lookback):
    df = get_clean_history(ticker, lookback)
    if df is None: raise ValueError("Data unavailable")
    
    high, low, close = df['High'], df['Low'], df['Close']
    cutoff_date = df.index[-1] - timedelta(days=lookback)
    mask = df.index >= cutoff_date
    
    atr = calculate_atr(high, low, close, 10)
    hl2 = (high + low) / 2
    
    best_f = 3.0
    min_error = 1.0
    best_actual = 0.0
    
    possible_f = [x/2.0 for x in range(1, 21)]
    
    for f in possible_f:
        basic_lower = hl2 - (f * atr)
        is_above = (close > basic_lower)
        valid_is_above = is_above[mask]
        ratio = valid_is_above.sum() / len(valid_is_above)
        
        if abs(ratio - target_up) < min_error:
            min_error = abs(ratio - target_up)
            best_f = f
            best_actual = ratio
            
    return { "optimal_n": best_f, "actual_pct": round(best_actual, 4) }