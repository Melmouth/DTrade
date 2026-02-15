import numpy as np
import pandas as pd
from .core import calc_sma, calc_ema, calc_wma, get_series

def indicator_sma(df, params):
    series = get_series(df, 'Close')
    period = int(params.get('period', 20))
    return calc_sma(series, period)

def indicator_ema(df, params):
    series = get_series(df, 'Close')
    period = int(params.get('period', 20))
    return calc_ema(series, period)

def indicator_wma(df, params):
    series = get_series(df, 'Close')
    period = int(params.get('period', 20))
    return calc_wma(series, period)

def indicator_hma(df, params):
    series = get_series(df, 'Close')
    period = int(params.get('period', 20))
    
    half_length = int(period / 2)
    sqrt_length = int(np.sqrt(period))
    
    wma_half = calc_wma(series, half_length)
    wma_full = calc_wma(series, period)
    
    raw_hma = 2 * wma_half - wma_full
    return calc_wma(raw_hma, sqrt_length)

def indicator_vwma(df, params):
    close = df['Close']
    volume = df['Volume']
    period = int(params.get('period', 20))
    
    pv = close * volume
    
    # Rolling sum
    sum_pv = pv.rolling(window=period).sum()
    sum_v = volume.rolling(window=period).sum()
    
    return sum_pv / sum_v

def indicator_dema(df, params):
    series = get_series(df, 'Close')
    period = int(params.get('period', 20))
    
    ema1 = calc_ema(series, period)
    ema2 = calc_ema(ema1, period)
    return 2 * ema1 - ema2

def indicator_tema(df, params):
    series = get_series(df, 'Close')
    period = int(params.get('period', 20))
    
    ema1 = calc_ema(series, period)
    ema2 = calc_ema(ema1, period)
    ema3 = calc_ema(ema2, period)
    
    return 3 * ema1 - 3 * ema2 + ema3

def indicator_zlema(df, params):
    series = get_series(df, 'Close')
    period = int(params.get('period', 20))
    
    lag = int((period - 1) / 2)
    
    # Formula: EMA of (Close + (Close - Close(lag)))
    # De-lagged data
    lagged_series = series.shift(lag)
    # Fill NaN at start to avoid propogation issues
    lagged_series = lagged_series.fillna(series) 
    
    de_lagged = series + (series - lagged_series)
    return calc_ema(de_lagged, period)

def indicator_kama(df, params):
    # Kaufman Adaptive Moving Average
    # Difficile à vectoriser proprement à cause de la récursivité
    close = df['Close'].values
    period = int(params.get('period', 10))
    fast_end = 2
    slow_end = 30
    
    n = len(close)
    kama = np.full(n, np.nan)
    
    # Init first value
    if n > period:
        kama[period-1] = close[period-1]
        
        for i in range(period, n):
            # Efficiency Ratio
            change = abs(close[i] - close[i - period])
            volatility = np.sum(np.abs(close[i-period+1:i+1] - close[i-period:i]))
            
            er = change / volatility if volatility != 0 else 0
            
            # Smoothing Constant
            sc = (er * (2/(fast_end+1) - 2/(slow_end+1)) + 2/(slow_end+1)) ** 2
            
            kama[i] = kama[i-1] + sc * (close[i] - kama[i-1])
            
    return pd.Series(kama, index=df.index)

def indicator_mcg(df, params):
    # McGinley Dynamic
    close = df['Close'].values
    period = int(params.get('period', 14))
    n = len(close)
    mcg = np.full(n, np.nan)
    
    # Init
    mcg[0] = close[0]
    
    for i in range(1, n):
        prev = mcg[i-1]
        price = close[i]
        
        # Avoid division by zero
        if prev == 0: 
            mcg[i] = price
            continue
            
        ratio = price / prev
        denom = period * (ratio ** 4)
        
        # McGinley Formula: prev + (Price - prev) / (k * (P/prev)^4)
        mcg[i] = prev + (price - prev) / max(denom, 0.1) # Max 0.1 safety
        
    return pd.Series(mcg, index=df.index)