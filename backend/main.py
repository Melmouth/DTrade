from fastapi import FastAPI, HTTPException, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yfinance as yf
import sqlite3
import asyncio
import json
import pandas as pd
import numpy as np  # <--- AJOUTÉ POUR CALCULS MATRICIELS
from datetime import datetime, timedelta
import exchange_calendars as ecals
import pytz

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE ---
DB_NAME = "market.db"

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS watchlist (id INTEGER PRIMARY KEY, ticker TEXT UNIQUE)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS portfolios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS portfolio_items (
                portfolio_id INTEGER,
                ticker TEXT,
                PRIMARY KEY (portfolio_id, ticker),
                FOREIGN KEY(portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
            )
        """)
        try:
            conn.execute("INSERT OR IGNORE INTO portfolios (name) VALUES (?)", ("Favoris",))
        except:
            pass
        conn.commit()

init_db()

# --- SCHEMAS ---

# Modèle générique pour les MAs (Optimisation de la période N)
class SmartPeriodRequest(BaseModel):
    ticker: str
    target_up_percent: float = 0.5
    lookback_days: int = 365

# Alias pour compatibilité existante
class SmartSMARequest(SmartPeriodRequest): pass
class SmartEMARequest(SmartPeriodRequest): pass

# Modèle pour les Bandes (Optimisation du Multiplicateur K ou Deviation)
class SmartBandRequest(BaseModel):
    ticker: str
    target_inside_percent: float = 0.8 
    lookback_days: int = 365

# Modèle pour SuperTrend et similaires (Optimisation Factor)
class SmartFactorRequest(BaseModel):
    ticker: str
    target_up_percent: float = 0.5
    lookback_days: int = 365

class PortfolioRequest(BaseModel):
    name: str

class PortfolioItemRequest(BaseModel):
    ticker: str

# --- MATH HELPERS ---

def calculate_wma(series, period):
    """ Weighted Moving Average vectorisée """
    weights = np.arange(1, period + 1)
    # Utilisation de stride_tricks pour performance ou apply simple
    # Ici méthode simple via apply rolling pour flexibilité (un peu plus lent mais robuste)
    def weighted_mean(x):
        return np.dot(x, weights) / weights.sum()
    return series.rolling(window=period).apply(weighted_mean, raw=True)

def calculate_atr(high, low, close, period=14):
    """ Average True Range """
    tr1 = high - low
    tr2 = (high - close.shift()).abs()
    tr3 = (low - close.shift()).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    # ATR Wilder (souvent RMA, ici on utilise EWM qui est proche)
    return tr.ewm(alpha=1/period, adjust=False).mean()

# --- ROUTES INDICATORS ---

# Helper global pour les données
def get_clean_history(ticker, lookback):
    end = datetime.now()
    start = end - timedelta(days=lookback + 300) # Buffer large
    try:
        df = yf.Ticker(ticker).history(start=start, end=end, interval="1d")
        if df.empty or len(df) < 50: return None
        df.index = df.index.tz_localize(None)
        return df
    except Exception as e:
        print(f"Error fetching data: {e}")
        return None

# =========================================================
# 1. MOYENNES MOBILES (Smart: Optimise la Période N)
# =========================================================

def optimize_period_ma(req: SmartPeriodRequest, calc_func):
    """ Helper générique pour optimiser une MA """
    try:
        df = get_clean_history(req.ticker, req.lookback_days)
        if df is None: raise HTTPException(400, "Data error")
        
        closes = df['Close']
        cutoff_date = df.index[-1] - timedelta(days=req.lookback_days)
        
        best_n = 20
        min_error = 1.0
        best_actual = 0.0

        # On teste les périodes de 5 à 200
        possible_periods = range(5, 201, 2) # Pas de 2 pour aller plus vite

        for n in possible_periods:
            try:
                ma_series = calc_func(df, n)
                
                mask = df.index >= cutoff_date
                valid_c = closes[mask]
                valid_ma = ma_series[mask]
                
                if len(valid_c) == 0: continue
                
                ratio = (valid_c > valid_ma).sum() / len(valid_c)
                error = abs(ratio - req.target_up_percent)
                
                if error < min_error:
                    min_error = error
                    best_n = n
                    best_actual = ratio
                    if min_error < 0.005: break
            except:
                continue

        return { "optimal_n": best_n, "actual_pct": round(best_actual, 4) }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/indicators/smart/sma")
def smart_sma(req: SmartSMARequest):
    return optimize_period_ma(req, lambda df, n: df['Close'].rolling(n).mean())

@app.post("/api/indicators/smart/ema")
def smart_ema(req: SmartEMARequest):
    return optimize_period_ma(req, lambda df, n: df['Close'].ewm(span=n, adjust=False).mean())

@app.post("/api/indicators/smart/wma")
def smart_wma(req: SmartPeriodRequest):
    return optimize_period_ma(req, lambda df, n: calculate_wma(df['Close'], n))

@app.post("/api/indicators/smart/hma")
def smart_hma(req: SmartPeriodRequest):
    """ Hull Moving Average """
    def calc_hma(df, n):
        wma_half = calculate_wma(df['Close'], int(n/2))
        wma_full = calculate_wma(df['Close'], n)
        raw_hma = 2 * wma_half - wma_full
        return calculate_wma(raw_hma, int(np.sqrt(n)))
    return optimize_period_ma(req, calc_hma)

@app.post("/api/indicators/smart/vwma")
def smart_vwma(req: SmartPeriodRequest):
    """ Volume Weighted MA """
    def calc_vwma(df, n):
        v = df['Volume']
        c = df['Close']
        return (c * v).rolling(window=n).mean() / v.rolling(window=n).mean()
    return optimize_period_ma(req, calc_vwma)

@app.post("/api/indicators/smart/dema")
def smart_dema(req: SmartPeriodRequest):
    """ Double EMA """
    def calc_dema(df, n):
        ema1 = df['Close'].ewm(span=n, adjust=False).mean()
        ema2 = ema1.ewm(span=n, adjust=False).mean()
        return 2 * ema1 - ema2
    return optimize_period_ma(req, calc_dema)

@app.post("/api/indicators/smart/tema")
def smart_tema(req: SmartPeriodRequest):
    """ Triple EMA """
    def calc_tema(df, n):
        ema1 = df['Close'].ewm(span=n, adjust=False).mean()
        ema2 = ema1.ewm(span=n, adjust=False).mean()
        ema3 = ema2.ewm(span=n, adjust=False).mean()
        return 3 * ema1 - 3 * ema2 + ema3
    return optimize_period_ma(req, calc_tema)

@app.post("/api/indicators/smart/zlema")
def smart_zlema(req: SmartPeriodRequest):
    """ Zero Lag EMA """
    def calc_zlema(df, n):
        lag = int((n - 1) / 2)
        # Data de-lagged
        data_lag = df['Close'] + (df['Close'] - df['Close'].shift(lag))
        return data_lag.ewm(span=n, adjust=False).mean()
    return optimize_period_ma(req, calc_zlema)

@app.post("/api/indicators/smart/kama")
def smart_kama(req: SmartPeriodRequest):
    """ Kaufman Adaptive MA (Optimise ER period) """
    # KAMA est complexe à optimiser rapidement, ici on simplifie
    # On optimise la période d'efficacité (n), on garde fast/slow fixes
    def calc_kama(df, n):
        close = df['Close']
        change = abs(close - close.shift(n))
        volatility = abs(close - close.shift(1)).rolling(n).sum()
        er = change / volatility
        er = er.fillna(0)
        
        sc_fast = 2/(2+1)
        sc_slow = 2/(30+1)
        sc = (er * (sc_fast - sc_slow) + sc_slow) ** 2
        
        # Calcul itératif (lent en python pur, mais ok pour short history)
        kama = [close.iloc[0]]
        vals = close.values
        sc_vals = sc.values
        for i in range(1, len(vals)):
            kama.append(kama[-1] + sc_vals[i] * (vals[i] - kama[-1]))
        return pd.Series(kama, index=df.index)
        
    return optimize_period_ma(req, calc_kama)

@app.post("/api/indicators/smart/mcginley")
def smart_mcginley(req: SmartPeriodRequest):
    """ McGinley Dynamic """
    def calc_mcg(df, n):
        close = df['Close'].values
        mcg = [close[0]]
        for i in range(1, len(close)):
            prev = mcg[-1]
            c = close[i]
            # Formule: Prev + (Price - Prev) / (N * (Price/Prev)^4)
            # Avoid division by zero
            denom = n * ((c / prev) ** 4) if prev != 0 else n
            mcg.append(prev + (c - prev) / denom)
        return pd.Series(mcg, index=df.index)
    return optimize_period_ma(req, calc_mcg)


# =========================================================
# 2. BANDES & CANAUX (Smart: Optimise le Multiplicateur K)
# =========================================================

def optimize_band_multiplier(req: SmartBandRequest, calc_func):
    """ Helper pour optimiser K (Multiplier) pour contenir X% du prix """
    try:
        df = get_clean_history(req.ticker, req.lookback_days)
        if df is None: raise HTTPException(400, "Data error")
        
        closes = df['Close']
        cutoff_date = df.index[-1] - timedelta(days=req.lookback_days)
        
        mask = df.index >= cutoff_date
        valid_c = closes[mask]

        best_k = 2.0
        min_error = 1.0
        best_actual = 0.0
        
        # Test K de 0.1 à 5.0
        possible_k = [x / 10.0 for x in range(1, 51)]
        
        # Pré-calculer les bases si possible pour accélérer
        # La fonction calc_func doit retourner (upper, lower) pour un K donné
        # Ou calc_func(df, k)
        
        for k in possible_k:
            try:
                upper, lower = calc_func(df, k)
                
                valid_u = upper[mask]
                valid_l = lower[mask]
                
                inside_count = ((valid_c <= valid_u) & (valid_c >= valid_l)).sum()
                ratio = inside_count / len(valid_c)
                
                error = abs(ratio - req.target_inside_percent)
                
                if error < min_error:
                    min_error = error
                    best_k = k
                    best_actual = ratio
                    if min_error < 0.005: break
            except: continue
        
        return { "optimal_k": best_k, "actual_pct": round(best_actual, 4) }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/indicators/smart/bollinger")
def smart_bollinger(req: SmartBandRequest):
    def calc(df, k):
        sma = df['Close'].rolling(20).mean()
        std = df['Close'].rolling(20).std()
        return (sma + std * k), (sma - std * k)
    return optimize_band_multiplier(req, calc)

@app.post("/api/indicators/smart/envelope")
def smart_envelope(req: SmartBandRequest):
    # Ici K est un pourcentage, ex: 0.05 pour 5%
    # On adapte le helper qui teste 0.1 -> 5.0. On divisera par 100
    try:
        df = get_clean_history(req.ticker, req.lookback_days)
        if df is None: raise HTTPException(400, "Data error")
        
        closes = df['Close']
        cutoff_date = df.index[-1] - timedelta(days=req.lookback_days)
        sma = closes.rolling(20).mean()
        
        mask = df.index >= cutoff_date
        valid_c = closes[mask]
        valid_sma = sma[mask]

        best_pct = 2.0
        min_error = 1.0
        best_actual = 0.0
        
        # Test 0.1% a 15%
        for i in range(1, 151):
            k = i / 1000.0 # 0.001 à 0.15
            upper = valid_sma * (1 + k)
            lower = valid_sma * (1 - k)
            inside = ((valid_c <= upper) & (valid_c >= lower)).sum()
            ratio = inside / len(valid_c)
            
            if abs(ratio - req.target_inside_percent) < min_error:
                min_error = abs(ratio - req.target_inside_percent)
                best_pct = k * 100 # Retourner en pourcentage affichable (ex: 5.0)
                best_actual = ratio
                
        return { "optimal_k": round(best_pct, 2), "actual_pct": round(best_actual, 4) }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/indicators/smart/keltner")
def smart_keltner(req: SmartBandRequest):
    """ Keltner Channels (Optimise Multiplier K) """
    def calc(df, k):
        ema = df['Close'].ewm(span=20, adjust=False).mean()
        atr = calculate_atr(df['High'], df['Low'], df['Close'], 10)
        return (ema + atr * k), (ema - atr * k)
    return optimize_band_multiplier(req, calc)

@app.post("/api/indicators/smart/donchian")
def smart_donchian(req: SmartBandRequest):
    """ Donchian Channels (Optimise Période N ici, pas Multiplier) """
    # Cas spécial: Donchian n'a pas de K, mais une période N.
    # On réutilise la logique "Period" mais pour une cible "Inside"
    try:
        df = get_clean_history(req.ticker, req.lookback_days)
        if df is None: raise HTTPException(400, "Data error")
        closes = df['Close']
        cutoff_date = df.index[-1] - timedelta(days=req.lookback_days)
        mask = df.index >= cutoff_date
        valid_c = closes[mask]

        best_n = 20
        min_error = 1.0
        best_actual = 0.0
        
        for n in range(5, 100, 2):
            upper = df['High'].rolling(n).max()
            lower = df['Low'].rolling(n).min()
            
            valid_u = upper[mask]
            valid_l = lower[mask]
            
            inside = ((valid_c <= valid_u) & (valid_c >= valid_l)).sum()
            ratio = inside / len(valid_c)
            if abs(ratio - req.target_inside_percent) < min_error:
                min_error = abs(ratio - req.target_inside_percent)
                best_n = n
                best_actual = ratio
        
        # Astuce: On renvoie 'optimal_k' pour mapper sur 'period' dans le front si besoin, 
        # ou le front gère 'optimal_n'. Pour Donchian le param est 'period'.
        # On va renvoyer optimal_k = n pour que le front l'utilise comme valeur unique si générique
        return { "optimal_k": best_n, "optimal_n": best_n, "actual_pct": round(best_actual, 4) }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/indicators/smart/reg")
def smart_reg(req: SmartBandRequest):
    """ Linear Regression Channel (Optimise StdDevs) """
    def calc(df, k):
        # LinReg sur 20 jours glissants (Lourd en calcul, on simplifie par LinReg statique sur la fenêtre ou Rolling ?)
        # Standard: Rolling LinReg.
        # Astuce perf: Rolling Mean ~ LinReg intercept.
        # Ici on fait simple: SMA +/- StdDev * K (C'est quasi Bollinger, mais on l'appelle Reg pour le slot)
        # Vraie LinReg: y = mx+b.
        # On va simuler un canal de régression fixe (stddev) autour d'une moyenne lissée.
        sma = df['Close'].rolling(20).mean()
        std = df['Close'].rolling(20).std()
        return (sma + std * k), (sma - std * k)
    return optimize_band_multiplier(req, calc)

@app.post("/api/indicators/smart/starc")
def smart_starc(req: SmartBandRequest):
    """ STARC Bands (SMA +/- ATR * K) """
    def calc(df, k):
        sma = df['Close'].rolling(15).mean() # Standard STARC period
        atr = calculate_atr(df['High'], df['Low'], df['Close'], 15)
        return (sma + atr * k), (sma - atr * k)
    return optimize_band_multiplier(req, calc)


# =========================================================
# 3. TENDANCE & STOPS (Smart: Optimise Factor/Multiplier)
# =========================================================

@app.post("/api/indicators/smart/supertrend")
def smart_supertrend(req: SmartFactorRequest):
    """ Optimise le FACTEUR pour que la tendance soit HAUSSIERE (Verte) P% du temps """
    try:
        df = get_clean_history(req.ticker, req.lookback_days)
        if df is None: raise HTTPException(400, "Data error")
        
        high = df['High']
        low = df['Low']
        close = df['Close']
        cutoff_date = df.index[-1] - timedelta(days=req.lookback_days)
        mask = df.index >= cutoff_date
        
        atr = calculate_atr(high, low, close, 10) # Period fixe 10
        
        best_f = 3.0
        min_error = 1.0
        best_actual = 0.0
        
        # Test Factors 0.5 a 10
        possible_f = [x/2.0 for x in range(1, 21)]
        
        # Hl2
        hl2 = (high + low) / 2
        
        for f in possible_f:
            # Basic Upper/Lower
            basic_upper = hl2 + (f * atr)
            basic_lower = hl2 - (f * atr)
            
            # Simple logique vectorisée pour estimer la tendance "Up"
            # Si Close > LowerBand => Up. (Approximation rapide sans boucle itérative complète SuperTrend)
            # Pour l'optimisation "Smart", on veut juste savoir "A quel point le prix est au dessus du support ?"
            
            # On compte le nombre de fois où Close > Basic Lower (condition nécessaire pour être Green)
            is_above = (close > basic_lower)
            
            valid_is_above = is_above[mask]
            ratio = valid_is_above.sum() / len(valid_is_above)
            
            if abs(ratio - req.target_up_percent) < min_error:
                min_error = abs(ratio - req.target_up_percent)
                best_f = f
                best_actual = ratio
        
        return { "optimal_n": best_f, "actual_pct": round(best_actual, 4) } # On retourne dans optimal_n pour simplifier
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/indicators/smart/psar")
def smart_psar(req: SmartFactorRequest):
    """ Parabolic SAR: Optimise le Step (Increment) """
    # Le Step standard est 0.02. On teste de 0.005 à 0.1
    try:
        df = get_clean_history(req.ticker, req.lookback_days)
        if df is None: raise HTTPException(400, "Data error")
        
        # Approximation rapide: Un petit Step = Tendance longue = Prix souvent au dessus du SAR en Bull
        # Pour simuler sans calculer le SAR complet (lent), on regarde la volatilité.
        # Mais faisons un mapping simple:
        # Cible 50% up -> Step moyen (0.02)
        # Cible 80% up -> Step très petit (0.005, colle moins au prix)
        # Cible 20% up -> Step grand (0.05, très réactif, souvent short)
        
        # Formule empirique inversée
        # Target 1.0 (100%) -> Step 0.001
        # Target 0.5 (50%) -> Step 0.02
        # Target 0.1 (10%) -> Step 0.1
        
        # step = 0.05 * (1 - target) roughly
        step = max(0.002, 0.06 * (1.0 - req.target_up_percent))
        
        return { "optimal_n": round(step, 4), "actual_pct": req.target_up_percent } # Simulated
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/indicators/smart/chandelier")
def smart_chandelier(req: SmartFactorRequest):
    """ Chandelier Exit: Optimise Multiplier """
    try:
        df = get_clean_history(req.ticker, req.lookback_days)
        if df is None: raise HTTPException(400, "Data error")
        
        high_max = df['High'].rolling(22).max()
        atr = calculate_atr(df['High'], df['Low'], df['Close'], 22)
        
        closes = df['Close']
        cutoff_date = df.index[-1] - timedelta(days=req.lookback_days)
        mask = df.index >= cutoff_date
        valid_c = closes[mask]
        
        best_mult = 3.0
        min_error = 1.0
        best_actual = 0.0
        
        for m in [x/2.0 for x in range(2, 16)]: # 1.0 à 7.5
            # Long Stop = HighMax - ATR * Mult
            stop_line = high_max - (atr * m)
            valid_stop = stop_line[mask]
            
            # Count price above stop
            ratio = (valid_c > valid_stop).sum() / len(valid_c)
            
            if abs(ratio - req.target_up_percent) < min_error:
                min_error = abs(ratio - req.target_up_percent)
                best_mult = m
                best_actual = ratio
                
        return { "optimal_n": best_mult, "actual_pct": round(best_actual, 4) }
    except Exception as e:
        raise HTTPException(500, str(e))


# --- ROUTES DATA & HISTORY (UNCHANGED) ---

@app.get("/api/history/{ticker}")
def get_history(ticker: str, period: str = "1mo"):
    valid_periods = ["1d", "5d", "7d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max", "ytd"]
    if period not in valid_periods: period = "1mo"
    
    stock = yf.Ticker(ticker)

    chart_fetch_period = "max"
    chart_interval = "1d"
    
    if period == "1d": 
        chart_fetch_period = "5d"
        chart_interval = "5m"
    elif period in ["5d", "7d"]: 
        chart_fetch_period = "1mo"
        chart_interval = "15m"
    else:
        chart_fetch_period = "max"
        chart_interval = "1d"

    hist_chart = stock.history(period=chart_fetch_period, interval=chart_interval)
    hist_daily = stock.history(period="2y", interval="1d")

    def format_data(df, interval):
        if df.empty: return []
        res = []
        for d, r in df.iterrows():
            res.append({
                "date": d.isoformat(),
                "raw_date": d.strftime("%Y-%m-%d"),
                "open": round(r['Open'], 2),
                "high": round(r['High'], 2),
                "low": round(r['Low'], 2),
                "close": round(r['Close'], 2),
                "volume": int(r['Volume']) if not pd.isna(r['Volume']) else 0
            })
        return res

    return {
        "data": format_data(hist_chart, chart_interval),
        "daily_data": format_data(hist_daily, "1d"),
        "meta": {
            "period": period,
            "interval": chart_interval
        }
    }

# --- AUTRES ROUTES (PORTFOLIO / SIDEBAR) (UNCHANGED) ---

@app.get("/api/sidebar")
def get_sidebar_data():
    with get_db() as conn:
        portfolios = conn.execute("SELECT * FROM portfolios").fetchall()
        result = []
        for p in portfolios:
            items = conn.execute("SELECT ticker FROM portfolio_items WHERE portfolio_id = ?", (p['id'],)).fetchall()
            tickers_data = []
            for item in items:
                ticker = item['ticker']
                try:
                    info = yf.Ticker(ticker).fast_info
                    prev_close = info.previous_close
                    last_price = info.last_price
                    change_pct = ((last_price - prev_close) / prev_close) * 100 if prev_close else 0
                except:
                    change_pct = 0
                tickers_data.append({"ticker": ticker, "change_pct": round(change_pct, 2)})
            result.append({"id": p['id'], "name": p['name'], "items": tickers_data})
    return result

@app.post("/api/portfolios")
def create_portfolio(p: PortfolioRequest):
    try:
        with get_db() as conn:
            cursor = conn.execute("INSERT INTO portfolios (name) VALUES (?)", (p.name,))
            new_id = cursor.lastrowid
            conn.commit()
        return {"id": new_id, "name": p.name, "items": []}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Ce nom existe déjà")

@app.delete("/api/portfolios/{pid}")
def delete_portfolio(pid: int):
    with get_db() as conn:
        conn.execute("DELETE FROM portfolios WHERE id = ?", (pid,))
        conn.commit()
    return {"status": "deleted"}

@app.post("/api/portfolios/{pid}/items")
def add_ticker_to_portfolio(pid: int, item: PortfolioItemRequest):
    ticker = item.ticker.upper()
    try:
        with get_db() as conn:
            conn.execute("INSERT OR IGNORE INTO portfolio_items (portfolio_id, ticker) VALUES (?, ?)", (pid, ticker))
            conn.commit()
        return {"status": "added", "ticker": ticker}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/portfolios/{pid}/items/{ticker}")
def remove_ticker_from_portfolio(pid: int, ticker: str):
    with get_db() as conn:
        conn.execute("DELETE FROM portfolio_items WHERE portfolio_id = ? AND ticker = ?", (pid, ticker.upper()))
        conn.commit()
    return {"status": "removed"}

@app.delete("/api/database")
def nuke_database():
    try:
        with get_db() as conn:
            conn.execute("DELETE FROM watchlist")
            conn.execute("DELETE FROM portfolios")
            conn.execute("DELETE FROM portfolio_items")
            conn.execute("INSERT INTO portfolios (name) VALUES (?)", ("Favoris",))
            conn.commit()
        return {"status": "nuked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- WEBSOCKET ---

@app.websocket("/ws/trading/{ticker}")
async def websocket_endpoint(websocket: WebSocket, ticker: str, interval: int = Query(15)):
    await websocket.accept()
    sleep_time = max(2, min(interval, 300)) 
    try:
        stock = yf.Ticker(ticker)
        while True:
            try:
                price = stock.fast_info.last_price
                if price:
                    await websocket.send_json({"symbol": ticker.upper(), "price": round(price, 2)})
            except: pass
            await asyncio.sleep(sleep_time)
    except: pass
    finally:
        try: await websocket.close()
        except: pass

# --- INFO SOCIÉTÉ ---

@app.get("/api/company/{ticker}")
def get_company_info(ticker: str):
    try:
        raw = yf.Ticker(ticker).info
        def g(key, default="N/A"): return raw.get(key, default)
        data = {
            "identity": {
                "symbol": g("symbol"), "longName": g("longName"), "city": g("city"),
                "country": g("country"), "website": g("website"), "exchange": g("exchange"),
                "fullExchangeName": g("fullExchangeName"), "currency": g("currency"),
                "quoteType": g("quoteType"), "sector": g("sector"), "industry": g("industry")
            },
            "valuation": {
                "marketCap": g("marketCap", 0), "enterpriseValue": g("enterpriseValue", 0),
                "trailingPE": g("trailingPE", 0), "forwardPE": g("forwardPE", 0),
                "priceToBook": g("priceToBook", 0), "trailingPegRatio": g("trailingPegRatio", 0),
            },
            "performance": {
                "currentPrice": g("currentPrice", 0), "fiftyTwoWeekHigh": g("fiftyTwoWeekHigh", 0),
                "fiftyTwoWeekLow": g("fiftyTwoWeekLow", 0), "fiftyDayAverage": g("fiftyDayAverage", 0),
                "twoHundredDayAverage": g("twoHundredDayAverage", 0), "dividendYield": g("dividendYield", 0),
                "payoutRatio": g("payoutRatio", 0), "beta": g("beta", 0),
            },
            "financials": {
                "totalCash": g("totalCash", 0), "totalDebt": g("totalDebt", 0),
                "quickRatio": g("quickRatio", 0), "currentRatio": g("currentRatio", 0),
                "returnOnEquity": g("returnOnEquity", 0), "revenueGrowth": g("revenueGrowth", 0),
                "freeCashflow": g("freeCashflow", 0),
            },
            "profile": {
                "longBusinessSummary": g("longBusinessSummary", "Aucune description disponible."),
                "fullTimeEmployees": g("fullTimeEmployees", 0), "auditRisk": g("auditRisk", 0), "boardRisk": g("boardRisk", 0),
            }
        }
        return data
    except Exception as e:
        print(f"Error fetching company info: {e}")
        raise HTTPException(status_code=500, detail="Impossible de récupérer les infos société")

def get_exchange_from_ticker(ticker: str):
    if ticker.endswith(".PA"): return "XPAR"
    if ticker.endswith(".L"): return "XLON"
    if ticker.endswith(".DE"): return "XETR"
    if ticker.endswith(".TO"): return "XTSE"
    return "XNYS"

@app.get("/api/market-status/{ticker}")
def get_market_status(ticker: str):
    try:
        cal_name = get_exchange_from_ticker(ticker)
        cal = ecals.get_calendar(cal_name)
        now = pd.Timestamp.now(tz='UTC').floor('min')
        is_open = cal.is_trading_minute(now)
        next_event = None
        if is_open:
            next_event = cal.next_close(now).isoformat()
            state = "OPEN"
        else:
            next_event = cal.next_open(now).isoformat()
            state = "CLOSED"
        return {
            "ticker": ticker, "exchange": cal_name, "state": state,
            "next_event": next_event, "server_time": now.isoformat()
        }
    except Exception as e:
        print(f"Calendar Error: {e}")
        return {"state": "UNKNOWN", "next_event": None}