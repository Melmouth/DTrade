import os
import sqlite3
from pathlib import Path
from contextlib import contextmanager

DB_NAME = None

def configure_database(directory: Path):
    global DB_NAME
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    if directory.is_symlink() or directory.stat().st_uid != os.getuid():
        raise ValueError("Unsafe data directory")
    directory.chmod(0o700)
    path = directory / "market.db"
    if path.is_symlink():
        raise ValueError("Database symlinks are not allowed")
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    os.close(fd)
    path.chmod(0o600)
    DB_NAME = path

@contextmanager
def get_db():
    if DB_NAME is None:
        raise RuntimeError("Database is not initialized")
    conn = sqlite3.connect(DB_NAME, timeout=5.0)
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=FULL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA max_page_count=16384")
        conn.execute("PRAGMA journal_size_limit=4194304")
        conn.execute("PRAGMA secure_delete=ON")
        conn.row_factory = sqlite3.Row
        # Serialize read-modify-write operations (cash and positions).
        conn.execute("BEGIN IMMEDIATE")
        with conn:
            yield conn
    finally:
        conn.close()

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
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(saved_indicators)")}
        if "resolution" not in columns:
            conn.execute("ALTER TABLE saved_indicators ADD COLUMN resolution TEXT DEFAULT '1d'")

        conn.execute("CREATE INDEX IF NOT EXISTS idx_indicators_ticker ON saved_indicators(ticker)")
        
        # --- SEEDS ---
        conn.execute("INSERT OR IGNORE INTO portfolios (name) VALUES (?)", ("Favoris",))

        cur = conn.execute("SELECT count(*) as cnt FROM accounts")
        if cur.fetchone()['cnt'] == 0:
            print("[DB] Initialisation du compte Paper Trading (100k$)")
            conn.execute("INSERT INTO accounts (balance) VALUES (?)", (100000.0,))
            conn.execute("""
                INSERT INTO transactions (type, total_amount, timestamp) 
                VALUES ('DEPOSIT', 100000.0, CURRENT_TIMESTAMP)
            """)
        # Tables are fixed internal identifiers, never supplied by a request.
        for table, limit in (("portfolios", 100), ("portfolio_items", 500),
                             ("saved_indicators", 500), ("positions", 100), ("transactions", 10000)):
            conn.execute(f"""CREATE TRIGGER IF NOT EXISTS quota_{table}
                BEFORE INSERT ON {table}
                WHEN (SELECT COUNT(*) FROM {table}) >= {limit}
                BEGIN SELECT RAISE(ABORT, 'Storage quota reached'); END""")  # nosec B608
        conn.commit()