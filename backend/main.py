from fastapi import FastAPI, HTTPException, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yfinance as yf
import sqlite3
import asyncio
import json
import pandas as pd
from datetime import datetime, timedelta  # <--- INDISPENSABLE
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

class SmartSMARequest(BaseModel):
    ticker: str
    target_up_percent: float = 0.5
    lookback_days: int = 365

class SmartEMARequest(BaseModel):
    ticker: str
    target_up_percent: float = 0.5
    lookback_days: int = 365

class SmartBandRequest(BaseModel):
    ticker: str
    target_inside_percent: float = 0.8 # Cible : 80% des prix DANS les bandes
    lookback_days: int = 365

class PortfolioRequest(BaseModel):
    name: str

class PortfolioItemRequest(BaseModel):
    ticker: str

# --- ROUTES INDICATORS (CORRIGÉ) ---

@app.post("/api/indicators/smart/sma")
def calculate_smart_sma(req: SmartSMARequest):
    """
    Détermine la période 'n' optimale.
    CORRECTION : Utilise des dates fixes pour éviter l'erreur de format de période yfinance.
    """
    try:
        # 1. Définition des dates avec une marge de sécurité (Buffer)
        # On ajoute 300 jours au lookback pour permettre le calcul de grandes SMA (ex: SMA200)
        # avant le début de la période d'analyse.
        end_date = datetime.now()
        buffer_days = req.lookback_days + 300
        start_date = end_date - timedelta(days=buffer_days)
        
        # 2. Récupération des données via start/end
        df = yf.Ticker(req.ticker).history(start=start_date, end=end_date, interval="1d")
        
        if df.empty or len(df) < 50:
             raise HTTPException(status_code=400, detail="Données insuffisantes pour le calcul Smart")

        # 3. Nettoyage des Timezones (Important pour éviter erreurs de comparaison)
        df.index = df.index.tz_localize(None)
        
        # Date à partir de laquelle on commence à compter le % de réussite
        cutoff_date = df.index[-1] - timedelta(days=req.lookback_days)
        
        # Variables pour l'optimisation
        best_n = 20
        min_error = 1.0
        best_actual_pct = 0.0

        # Données Close
        closes = df['Close']
        
        # 4. Boucle d'optimisation (Test des SMA de 10 à 200)
        possible_periods = range(10, 201, 1) 

        for n in possible_periods:
            # Calcul de la SMA sur tout l'historique chargé
            sma = closes.rolling(window=n).mean()
            
            # On découpe : on ne garde que la période demandée par l'utilisateur pour l'évaluation
            mask_period = df.index >= cutoff_date
            valid_closes = closes[mask_period]
            valid_sma = sma[mask_period]
            
            if len(valid_closes) == 0: continue

            # Combien de fois le prix est au-dessus de la SMA ?
            above_count = (valid_closes > valid_sma).sum()
            total_count = len(valid_closes)
            
            if total_count == 0: continue

            ratio = above_count / total_count
            
            # On cherche le ratio le plus proche de la cible (ex: 50%)
            error = abs(ratio - req.target_up_percent)
            
            if error < min_error:
                min_error = error
                best_n = n
                best_actual_pct = ratio
                
                # Si on est très précis (0.5% d'erreur), on arrête
                if min_error < 0.005:
                    break

        return {
            "optimal_n": best_n,
            "target_pct": req.target_up_percent,
            "actual_pct": round(best_actual_pct, 4),
            "analyzed_days": req.lookback_days
        }

    except Exception as e:
        print(f"Error Smart SMA: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/indicators/smart/ema")
def calculate_smart_ema(req: SmartEMARequest):
    """ Optimise la période N pour une cible % de prix > EMA """
    try:
        df = get_clean_history(req.ticker, req.lookback_days) # (Refacto possible)
        if df is None: raise HTTPException(400, "Data error")
        
        closes = df['Close']
        cutoff_date = df.index[-1] - timedelta(days=req.lookback_days)
        
        best_n = 20
        min_error = 1.0
        best_actual = 0.0

        for n in range(5, 201):
            ema = closes.ewm(span=n, adjust=False).mean()
            
            mask = df.index >= cutoff_date
            valid_c = closes[mask]
            valid_ema = ema[mask]
            
            if len(valid_c) == 0: continue
            
            ratio = (valid_c > valid_ema).sum() / len(valid_c)
            error = abs(ratio - req.target_up_percent)
            
            if error < min_error:
                min_error = error
                best_n = n
                best_actual = ratio
                if min_error < 0.005: break

        return { "optimal_n": best_n, "actual_pct": round(best_actual, 4) }
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/indicators/smart/envelope")
def calculate_smart_envelope(req: SmartBandRequest):
    """ Optimise le % d'écart pour contenir P% des prix (Période fixée à 20 par défaut pour l'enveloppe) """
    try:
        df = get_clean_history(req.ticker, req.lookback_days)
        if df is None: raise HTTPException(400, "Data error")
        
        closes = df['Close']
        cutoff_date = df.index[-1] - timedelta(days=req.lookback_days)
        
        # On fixe la SMA de base (ex: 20 jours) et on fait varier l'épaisseur %
        base_sma = closes.rolling(window=20).mean()
        
        best_k = 2.0 # Pourcentage (ex: 2%)
        min_error = 1.0
        best_actual = 0.0
        
        # Test de 0.1% à 15% par pas de 0.1
        # range(1, 150) -> divisé par 1000 pour avoir 0.001 à 0.15
        possible_k = [x / 1000.0 for x in range(1, 151)] 

        mask = df.index >= cutoff_date
        valid_c = closes[mask]
        valid_sma = base_sma[mask]

        if len(valid_c) == 0: raise HTTPException(400, "Not enough data")

        for k in possible_k:
            upper = valid_sma * (1 + k)
            lower = valid_sma * (1 - k)
            
            # Count inside
            inside_count = ((valid_c <= upper) & (valid_c >= lower)).sum()
            ratio = inside_count / len(valid_c)
            
            error = abs(ratio - req.target_inside_percent)
            
            if error < min_error:
                min_error = error
                best_k = k
                best_actual = ratio
                if min_error < 0.005: break
        
        return { "optimal_k": round(best_k * 100, 2), "actual_pct": round(best_actual, 4) } # Retourne en % entier (ex: 2.5)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/indicators/smart/bollinger")
def calculate_smart_bollinger(req: SmartBandRequest):
    """ Optimise le multiplicateur K (StdDev) pour contenir P% des prix """
    try:
        df = get_clean_history(req.ticker, req.lookback_days)
        if df is None: raise HTTPException(400, "Data error")
        
        closes = df['Close']
        cutoff_date = df.index[-1] - timedelta(days=req.lookback_days)
        
        # Base Bollinger standard (20 jours)
        period = 20
        sma = closes.rolling(window=period).mean()
        std = closes.rolling(window=period).std()
        
        mask = df.index >= cutoff_date
        valid_c = closes[mask]
        valid_sma = sma[mask]
        valid_std = std[mask]
        
        best_k = 2.0
        min_error = 1.0
        best_actual = 0.0
        
        # Test K de 0.1 à 4.0 par pas de 0.1
        possible_k = [x / 10.0 for x in range(1, 41)]
        
        for k in possible_k:
            upper = valid_sma + (valid_std * k)
            lower = valid_sma - (valid_std * k)
            
            inside_count = ((valid_c <= upper) & (valid_c >= lower)).sum()
            ratio = inside_count / len(valid_c)
            
            error = abs(ratio - req.target_inside_percent)
            
            if error < min_error:
                min_error = error
                best_k = k
                best_actual = ratio
        
        return { "optimal_k": best_k, "actual_pct": round(best_actual, 4) }
    except Exception as e:
        raise HTTPException(500, str(e))

# Helper pour éviter la duplication de code récupération yfinance
def get_clean_history(ticker, lookback):
    end = datetime.now()
    start = end - timedelta(days=lookback + 300)
    df = yf.Ticker(ticker).history(start=start, end=end, interval="1d")
    if df.empty or len(df) < 50: return None
    df.index = df.index.tz_localize(None)
    return df

# --- ROUTES DATA & HISTORY (CORRIGÉ) ---

@app.get("/api/history/{ticker}")
def get_history(ticker: str, period: str = "1mo"):
    """
    Renvoie DEUX sets de données :
    1. 'data': Les bougies pour le graphique.
       - Si period <= 7d : Intraday (5m/15m) sur période courte.
       - Si period > 7d  : Daily (1d) sur TOUT l'historique (max).
    2. 'daily_data': Toujours 2 ans de données journalières pour caler les indicateurs.
    """
    valid_periods = ["1d", "5d", "7d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max", "ytd"]
    if period not in valid_periods: period = "1mo"
    
    stock = yf.Ticker(ticker)

    # 1. Configuration Chart Data (Affichage)
    chart_fetch_period = "max" # Par défaut on prend tout
    chart_interval = "1d"
    
    # Gestion Intraday (On ne peut pas demander "max" en 5 minutes, c'est trop lourd/interdit)
    if period == "1d": 
        chart_fetch_period = "5d" # Buffer pour scroll un peu
        chart_interval = "5m"
    elif period in ["5d", "7d"]: 
        chart_fetch_period = "1mo" # Buffer
        chart_interval = "15m"
    else:
        # Pour 1mo, 6mo, 1y, YTD... on charge TOUT l'historique disponible en journalier
        chart_fetch_period = "max"
        chart_interval = "1d"

    hist_chart = stock.history(period=chart_fetch_period, interval=chart_interval)
    
    # 2. Configuration Indicator Data 
    # (Reste inchangé ou peut être optimisé, mais on garde la sécu 2y pour les calculs)
    hist_daily = stock.history(period="2y", interval="1d")

    def format_data(df, interval):
        if df.empty: return []
        # ... (reste de la fonction format_data identique)
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
            "period": period,   # ex: "1mo"
            "interval": chart_interval
        }
    }

# --- AUTRES ROUTES (PORTFOLIO / SIDEBAR) ---

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
                
                tickers_data.append({
                    "ticker": ticker,
                    "change_pct": round(change_pct, 2)
                })
            
            result.append({
                "id": p['id'],
                "name": p['name'],
                "items": tickers_data
            })
            
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
            # Note: fast_info est synchrone, dans un vrai projet high-perf on ferait autrement
            # mais ici c'est suffisant.
            try:
                price = stock.fast_info.last_price
                if price:
                    await websocket.send_json({
                        "symbol": ticker.upper(),
                        "price": round(price, 2)
                    })
            except:
                pass # Ignorer les erreurs temporaires de Yahoo
            await asyncio.sleep(sleep_time)
    except:
        pass
    finally:
        try:
            await websocket.close()
        except:
            pass

# --- INFO SOCIÉTÉ ---

@app.get("/api/company/{ticker}")
def get_company_info(ticker: str):
    try:
        # Récupération des infos brutes
        raw = yf.Ticker(ticker).info
        
        # Helper pour éviter les KeyErrors
        def g(key, default="N/A"):
            return raw.get(key, default)

        # Structuration selon tes 5 catégories
        data = {
            "identity": {
                "symbol": g("symbol"),
                "longName": g("longName"),
                "city": g("city"),
                "country": g("country"),
                "website": g("website"),
                "exchange": g("exchange"),
                "fullExchangeName": g("fullExchangeName"),
                "currency": g("currency"),
                "quoteType": g("quoteType"),
                "sector": g("sector"),
                "industry": g("industry")
            },
            "valuation": {
                "marketCap": g("marketCap", 0),
                "enterpriseValue": g("enterpriseValue", 0),
                "trailingPE": g("trailingPE", 0),
                "forwardPE": g("forwardPE", 0),
                "priceToBook": g("priceToBook", 0),
                "trailingPegRatio": g("trailingPegRatio", 0),
            },
            "performance": {
                "currentPrice": g("currentPrice", 0),
                "fiftyTwoWeekHigh": g("fiftyTwoWeekHigh", 0),
                "fiftyTwoWeekLow": g("fiftyTwoWeekLow", 0),
                "fiftyDayAverage": g("fiftyDayAverage", 0),
                "twoHundredDayAverage": g("twoHundredDayAverage", 0),
                "dividendYield": g("dividendYield", 0),
                "payoutRatio": g("payoutRatio", 0),
                "beta": g("beta", 0),
            },
            "financials": {
                "totalCash": g("totalCash", 0),
                "totalDebt": g("totalDebt", 0),
                "quickRatio": g("quickRatio", 0),
                "currentRatio": g("currentRatio", 0),
                "returnOnEquity": g("returnOnEquity", 0),
                "revenueGrowth": g("revenueGrowth", 0),
                "freeCashflow": g("freeCashflow", 0),
            },
            "profile": {
                "longBusinessSummary": g("longBusinessSummary", "Aucune description disponible."),
                "fullTimeEmployees": g("fullTimeEmployees", 0),
                "auditRisk": g("auditRisk", 0),
                "boardRisk": g("boardRisk", 0),
            }
        }
        return data
    
    

    except Exception as e:
        print(f"Error fetching company info: {e}")
        raise HTTPException(status_code=500, detail="Impossible de récupérer les infos société")
    

def get_exchange_from_ticker(ticker: str):
    """Devine le code calendrier selon le suffixe Yahoo"""
    if ticker.endswith(".PA"): return "XPAR" # Euronext Paris
    if ticker.endswith(".L"): return "XLON"  # Londres
    if ticker.endswith(".DE"): return "XETR" # Francfort
    if ticker.endswith(".TO"): return "XTSE" # Toronto
    return "XNYS" # Par défaut : NYSE (US)

# --- DATE CALENDAR ---
@app.get("/api/market-status/{ticker}")
def get_market_status(ticker: str):
    try:
        # 1. Identifier la place boursière
        cal_name = get_exchange_from_ticker(ticker)
        cal = ecals.get_calendar(cal_name)
        
        # 2. Date actuelle (UTC pour comparaison fiable)
        # On utilise floor('min') pour s'assurer qu'on compare des minutes pleines
        now = pd.Timestamp.now(tz='UTC').floor('min')
        
        # 3. Est-ce ouvert ?
        # CORRECTION MAJEURE: 'is_open_now' n'existe pas -> 'is_trading_minute'
        is_open = cal.is_trading_minute(now)
        
        # 4. Prochain événement
        next_event = None
        if is_open:
            # Si ouvert, on cherche la prochaine fermeture
            next_event = cal.next_close(now).isoformat()
            state = "OPEN"
        else:
            # Si fermé, on cherche la prochaine ouverture
            next_event = cal.next_open(now).isoformat()
            state = "CLOSED"

        return {
            "ticker": ticker,
            "exchange": cal_name,
            "state": state, # OPEN ou CLOSED
            "next_event": next_event, # Timestamp ISO
            "server_time": now.isoformat()
        }
    except Exception as e:
        print(f"Calendar Error: {e}")
        # Fallback pour éviter le crash Frontend si erreur
        return {"state": "UNKNOWN", "next_event": None}