import sqlite3

DB_NAME = "market.db"

def get_db():
    conn = sqlite3.connect(DB_NAME, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        # --- EXISTING WATCHLIST TABLES ---
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

        # --- FINANCIAL TABLES ---
        conn.execute("""
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                balance REAL NOT NULL DEFAULT 0.0,
                currency TEXT DEFAULT 'USD',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS positions (
                ticker TEXT PRIMARY KEY,
                quantity REAL NOT NULL,
                avg_price REAL NOT NULL, 
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT,
                type TEXT NOT NULL, 
                quantity REAL,
                price REAL,
                total_amount REAL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # --- SHADOW BACK COMPUTE (SBC) TABLES ---
        # MISE À JOUR DU SCHÉMA : Ajout de 'resolution'
        conn.execute("""
            CREATE TABLE IF NOT EXISTS saved_indicators (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                type TEXT NOT NULL,
                name TEXT,
                params TEXT NOT NULL,
                style TEXT NOT NULL,
                granularity TEXT DEFAULT 'days',
                resolution TEXT DEFAULT '1d', 
                period TEXT DEFAULT '1mo',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # MIGRATION AUTO SIMPLE (POUR DEV)
        # Si la colonne n'existe pas (ancienne DB), on l'ajoute
        try:
            conn.execute("ALTER TABLE saved_indicators ADD COLUMN resolution TEXT DEFAULT '1d'")
        except sqlite3.OperationalError:
            pass # La colonne existe déjà

        conn.execute("CREATE INDEX IF NOT EXISTS idx_indicators_ticker ON saved_indicators(ticker)")
        
        # --- SEEDS ---
        try:
            conn.execute("INSERT OR IGNORE INTO portfolios (name) VALUES (?)", ("Favoris",))
        except: pass

        cur = conn.execute("SELECT count(*) as cnt FROM accounts")
        if cur.fetchone()['cnt'] == 0:
            print("[DB] Initialisation du compte Paper Trading (100k$)")
            conn.execute("INSERT INTO accounts (balance) VALUES (?)", (100000.0,))
            conn.execute("""
                INSERT INTO transactions (type, total_amount, timestamp) 
                VALUES ('DEPOSIT', 100000.0, CURRENT_TIMESTAMP)
            """)
        conn.commit()