import numpy as np
import pandas as pd

def get_series(df, source='Close'):
    """Helper pour récupérer la série source insensible à la casse"""
    if source in df.columns: return df[source]
    if source.lower() in df.columns: return df[source.lower()]
    if source.capitalize() in df.columns: return df[source.capitalize()]
    return df.iloc[:, 3] # Fallback sur la 4ème colonne (souvent Close)

def calc_sma(series, period):
    return series.rolling(window=period).mean()

def calc_ema(series, period):
    # adjust=False correspond à la formule classique recursive: 
    # EMA_t = Price * alpha + EMA_{t-1} * (1-alpha)
    return series.ewm(span=period, adjust=False).mean()

def calc_wma(series, period):
    weights = np.arange(1, period + 1)
    w_sum = weights.sum()
    
    # On utilise rolling().apply() avec raw=True pour la perf (Numpy sous-jacent)
    # Note: construct_1d_array_from_args est plus rapide mais rolling apply est plus sûr pour l'alignement index
    def weighted_mean(x):
        return np.dot(x, weights) / w_sum
        
    return series.rolling(window=period).apply(weighted_mean, raw=True)

def calc_tr(df):
    """True Range Vectorisé"""
    high = df['High']
    low = df['Low']
    prev_close = df['Close'].shift(1)
    
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    
    # Max des 3
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr

def calc_atr(df, period):
    tr = calc_tr(df)
    # L'ATR standard est souvent une RMA (Running Moving Average) ou une EMA du TR
    # TradingView utilise RMA. Ici on utilise EMA pour matcher le front 'core.js' calc_atr_array (alpha = 1/period)
    # alpha = 1/period correspond à com = period - 1
    return tr.ewm(alpha=1/period, adjust=False).mean()

def calc_std(series, period):
    return series.rolling(window=period).std(ddof=0) # ddof=0 pour population std (comme le JS souvent) ou 1 pour sample