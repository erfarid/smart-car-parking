import sqlite3

from app import database


def test_get_connection_initializes_schema_and_seeds_admin_and_zones(db_path):
    conn = database.get_connection()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM zones")
    assert cur.fetchone()[0] >= 23

    cur.execute("SELECT email, role FROM users WHERE user_id='admin-001'")
    admin = cur.fetchone()
    assert admin[0] == "admin@smartparking.hu"
    assert admin[1] == "admin"

    cur.execute("PRAGMA table_info(vehicles)")
    columns = {row[1] for row in cur.fetchall()}
    assert "owner_user_id" in columns
    conn.close()


def test_seed_budapest_zones_if_empty_only_inserts_once(tmp_path, monkeypatch):
    path = tmp_path / "zones.db"
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE zones (
            zone_id TEXT PRIMARY KEY,
            zone_name TEXT NOT NULL,
            base_hourly_rate INTEGER NOT NULL,
            peak_start TEXT NOT NULL,
            peak_end TEXT NOT NULL,
            peak_multiplier REAL NOT NULL,
            max_duration_minutes INTEGER NOT NULL DEFAULT 1440,
            overstay_multiplier REAL NOT NULL DEFAULT 1.5
        )
        """
    )

    database._seed_budapest_zones_if_empty(conn)
    cur.execute("SELECT COUNT(*) FROM zones")
    first_count = cur.fetchone()[0]
    database._seed_budapest_zones_if_empty(conn)
    cur.execute("SELECT COUNT(*) FROM zones")
    second_count = cur.fetchone()[0]

    assert first_count == len(database.BUDAPEST_DISTRICT_ZONES)
    assert second_count == first_count
    conn.close()


def test_init_db_creates_demo_database_and_is_noop_when_file_exists(tmp_path, monkeypatch):
    demo_path = tmp_path / "vercel.db"
    monkeypatch.setattr(database, "DB_PATH", demo_path)
    database._init_db()

    conn = sqlite3.connect(demo_path)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM users")
    assert cur.fetchone()[0] >= 1
    cur.execute("SELECT COUNT(*) FROM zones")
    assert cur.fetchone()[0] == len(database.BUDAPEST_DISTRICT_ZONES)
    cur.execute("SELECT COUNT(*) FROM vehicles")
    assert cur.fetchone()[0] > 0
    cur.execute("SELECT COUNT(*) FROM parking_sessions")
    assert cur.fetchone()[0] > 0
    conn.close()

    original_size = demo_path.stat().st_size
    database._init_db()
    assert demo_path.stat().st_size == original_size
