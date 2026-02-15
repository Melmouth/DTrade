import pandas as pd
from .core import calc_sma, calc_std, calc_ema, calc_atr

def indicator_bb(df, params):
    close = df['Close']
    period = int(params.get('period', 20))
    std_dev = float(params.get('stdDev', 2.0))
    
    basis = calc_sma(close, period)
    std = calc_std(close, period)
    
    upper = basis + std_dev * std
    lower = basis - std_dev * std
    
    return {"basis": basis, "upper": upper, "lower": lower}

def indicator_kelt(df, params):
    close = df['Close']
    period = int(params.get('period', 20))
    mult = float(params.get('multiplier', 1.5))
    
    basis = calc_ema(close, period)
    atr = calc_atr(df, 10) # Period ATR often fixed or same as EMA in some settings, here fixed 10 as per JS
    
    upper = basis + atr * mult
    lower = basis - atr * mult
    
    return {"basis": basis, "upper": upper, "lower": lower}

def indicator_donch(df, params):
    high = df['High']
    low = df['Low']
    period = int(params.get('period', 20))
    
    upper = high.rolling(window=period).max()
    lower = low.rolling(window=period).min()
    basis = (upper + lower) / 2
    
    return {"basis": basis, "upper": upper, "lower": lower}

def indicator_envelope(df, params):
    close = df['Close']
    period = int(params.get('period', 20))
    deviation = float(params.get('deviation', 5.0))
    k = deviation / 100.0
    
    basis = calc_sma(close, period)
    upper = basis * (1 + k)
    lower = basis * (1 - k)
    
    return {"basis": basis, "upper": upper, "lower": lower}

def indicator_starc(df, params):
    close = df['Close']
    period = int(params.get('period', 15))
    mult = float(params.get('multiplier', 2.0))
    
    basis = calc_sma(close, period)
    atr = calc_atr(df, period)
    
    upper = basis + atr * mult
    lower = basis - atr * mult
    
    return {"basis": basis, "upper": upper, "lower": lower}

def indicator_reg(df, params):
    # Linear Regression Channel
    # Basis = LinReg Forecast, Bands = +/- Deviation
    # Note: Dans le JS initial, c'était un alias vers Bollinger (bug frontend?). 
    # Ici on implémente un vrai Rolling LinReg si on veut, ou on garde l'alias pour compatibilité.
    # Pour le moment -> Alias Bollinger comme dans le fichier frontend original
    return indicator_bb(df, params)