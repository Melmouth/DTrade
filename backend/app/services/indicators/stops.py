import numpy as np
import pandas as pd
from .core import calc_atr

def indicator_supert(df, params):
    high = df['High'].values
    low = df['Low'].values
    close = df['Close'].values
    period = int(params.get('period', 10))
    factor = float(params.get('factor', 3.0))
    
    # ATR
    # Note: On doit réutiliser la fonction calc_atr qui retourne une Series, et prendre les values
    atr_series = calc_atr(df, period)
    atr = atr_series.values
    
    n = len(close)
    
    # Init arrays
    upper_band = np.full(n, np.nan)
    lower_band = np.full(n, np.nan)
    super_trend = np.full(n, np.nan)
    
    # Trend state: 1 (Up), -1 (Down)
    trend = 1 
    
    # Iteration
    # Need ATR to be valid
    for i in range(period, n):
        hl2 = (high[i] + low[i]) / 2
        basic_upper = hl2 + factor * atr[i]
        basic_lower = hl2 - factor * atr[i]
        
        prev_upper = upper_band[i-1] if not np.isnan(upper_band[i-1]) else basic_upper
        prev_lower = lower_band[i-1] if not np.isnan(lower_band[i-1]) else basic_lower
        prev_close = close[i-1]
        
        # Calculate Bands
        if basic_upper < prev_upper or prev_close > prev_upper:
            curr_upper = basic_upper
        else:
            curr_upper = prev_upper
            
        if basic_lower > prev_lower or prev_close < prev_lower:
            curr_lower = basic_lower
        else:
            curr_lower = prev_lower
            
        upper_band[i] = curr_upper
        lower_band[i] = curr_lower
        
        # Logic Trend Switch
        if trend == 1:
            if close[i] < curr_lower:
                trend = -1
        else: # trend == -1
            if close[i] > curr_upper:
                trend = 1
                
        # Result
        if trend == 1:
            super_trend[i] = curr_lower
        else:
            super_trend[i] = curr_upper
            
    return pd.Series(super_trend, index=df.index)

def indicator_psar(df, params):
    high = df['High'].values
    low = df['Low'].values
    
    step = float(params.get('step', 0.02))
    max_step = float(params.get('max', 0.2)) # Parfois 'max' ou 'maxAf'
    
    n = len(high)
    sar = np.full(n, np.nan)
    
    # Init
    is_long = True
    af = step
    ep = high[0] # Extreme Point
    sar[0] = low[0]
    
    for i in range(1, n):
        prev_sar = sar[i-1]
        
        # Calculate next SAR based on PREVIOUS values
        next_sar = prev_sar + af * (ep - prev_sar)
        
        # Bounds check
        if is_long:
            # SAR cannot be higher than previous Lows
            if i >= 1: next_sar = min(next_sar, low[i-1])
            if i >= 2: next_sar = min(next_sar, low[i-2])
        else:
            # SAR cannot be lower than previous Highs
            if i >= 1: next_sar = max(next_sar, high[i-1])
            if i >= 2: next_sar = max(next_sar, high[i-2])
            
        # Reversal check with CURRENT candle
        reversed_ = False
        if is_long:
            if low[i] < next_sar:
                is_long = False
                reversed_ = True
                next_sar = ep
                ep = low[i]
                af = step
        else:
            if high[i] > next_sar:
                is_long = True
                reversed_ = True
                next_sar = ep
                ep = high[i]
                af = step
                
        if not reversed_:
            # Update AF
            if is_long:
                if high[i] > ep:
                    ep = high[i]
                    af = min(af + step, max_step)
            else:
                if low[i] < ep:
                    ep = low[i]
                    af = min(af + step, max_step)
                    
        sar[i] = next_sar
        
    return pd.Series(sar, index=df.index)

def indicator_chand(df, params):
    high = df['High']
    # low = df['Low']
    # close = df['Close']
    
    period = int(params.get('period', 22))
    mult = float(params.get('multiplier', 3.0))
    
    highest_high = high.rolling(window=period).max()
    atr = calc_atr(df, period)
    
    # Chandelier Exit Long = Highest High - (ATR * Mult)
    return highest_high - (atr * mult)