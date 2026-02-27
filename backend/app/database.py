import sqlite3
from pathlib import Path

# Always point to backend/parking.db
BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
DB_PATH = BASE_DIR / "parking.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
