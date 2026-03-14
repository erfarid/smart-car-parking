import sqlite3
import os
import random
import string
import uuid
from pathlib import Path
from datetime import datetime, timedelta

# On Vercel, use /tmp (only writable dir). Locally, use backend/parking.db
if os.environ.get("VERCEL"):
    DB_PATH = Path("/tmp/parking.db")
else:
    BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
    DB_PATH = BASE_DIR / "parking.db"

_initialized = False


def get_connection():
    global _initialized
    if not _initialized and os.environ.get("VERCEL"):
        _init_db()
        _initialized = True
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    """Create tables and seed demo data on Vercel cold start."""
    if DB_PATH.exists():
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # ── Create tables ──
    cur.execute("""
    CREATE TABLE IF NOT EXISTS zones (
        zone_id TEXT PRIMARY KEY,
        zone_name TEXT NOT NULL,
        base_hourly_rate INTEGER NOT NULL,
        peak_start TEXT NOT NULL,
        peak_end TEXT NOT NULL,
        peak_multiplier REAL NOT NULL,
        max_duration_minutes INTEGER NOT NULL DEFAULT 240,
        overstay_multiplier REAL NOT NULL DEFAULT 2.0
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS vehicles (
        plate_number TEXT PRIMARY KEY,
        owner_name TEXT NOT NULL,
        vehicle_type TEXT NOT NULL,
        registration_status TEXT NOT NULL
    )""")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS parking_sessions (
        session_id TEXT PRIMARY KEY,
        plate_number TEXT NOT NULL,
        zone_id TEXT NOT NULL,
        entry_timestamp TEXT NOT NULL,
        exit_timestamp TEXT,
        duration_minutes INTEGER,
        base_fee INTEGER,
        overstay_penalty INTEGER,
        repeat_count INTEGER,
        repeat_penalty INTEGER,
        final_fee INTEGER,
        status TEXT NOT NULL,
        FOREIGN KEY (plate_number) REFERENCES vehicles(plate_number),
        FOREIGN KEY (zone_id) REFERENCES zones(zone_id)
    )""")

    # ── Seed zones ──
    zones = [
        ("Z_001", "District_I_Downtown", 2000, "08:00", "18:00", 1.5, 240, 2.0),
        ("Z_002", "District_II_Center", 1800, "08:00", "18:00", 1.4, 240, 2.0),
        ("Z_003", "District_III", 1500, "08:00", "18:00", 1.3, 240, 2.0),
        ("Z_004", "District_IV", 1300, "08:00", "18:00", 1.2, 240, 2.0),
        ("Z_005", "District_V", 2200, "08:00", "18:00", 1.6, 240, 2.5),
        ("Z_006", "District_VI", 1600, "08:00", "18:00", 1.3, 240, 2.0),
        ("Z_007", "District_VII", 1700, "08:00", "18:00", 1.4, 240, 2.0),
    ]
    cur.executemany(
        "INSERT OR IGNORE INTO zones VALUES (?, ?, ?, ?, ?, ?, ?, ?)", zones
    )

    # ── Seed vehicles ──
    first_names = [
        "Adam", "Peter", "Anna", "Eva", "David", "Mark", "Julia", "Tamas",
        "Balazs", "Gabor", "Zoltan", "Levente", "Bence", "Daniel", "Robert",
        "Istvan", "Laszlo", "Csaba", "Norbert", "Viktor",
        "Eszter", "Katalin", "Monika", "Agnes", "Dora", "Lili", "Nora",
        "Zsofia", "Hanna", "Bianka", "Reka", "Timea", "Adrienn",
    ]
    last_names = [
        "Kovacs", "Nagy", "Szabo", "Toth", "Varga", "Molnar",
        "Horvath", "Balogh", "Farkas", "Lakatos", "Papp",
        "Kiss", "Simon", "Boros", "Szalai", "Juhasz",
        "Miklos", "Fodor", "Kertesz", "Gulyas",
        "Barta", "Sipos", "Hegedus", "Vadasz", "Bognar",
    ]
    vehicles = []
    for _ in range(200):
        plate = (
            "".join(random.choices(string.ascii_uppercase, k=3))
            + "-"
            + "".join(random.choices(string.digits, k=4))
        )
        name = random.choice(first_names) + " " + random.choice(last_names)
        vtype = random.choice(["car", "van", "truck", "electric", "hybrid"])
        vehicles.append((plate, name, vtype, "active"))
    cur.executemany(
        "INSERT OR IGNORE INTO vehicles VALUES (?, ?, ?, ?)", vehicles
    )

    # ── Seed sessions ──
    plates = [v[0] for v in vehicles]
    sessions = []
    for _ in range(500):
        zone = random.choice(zones)
        zone_id, base_rate = zone[0], zone[1]
        max_dur, overstay_mult = zone[6], zone[7]

        entry = datetime.now() - timedelta(days=random.randint(0, 365))
        duration = random.randint(30, 480)
        exit_time = entry + timedelta(minutes=duration)

        base_fee = int(base_rate * duration / 60)
        overstay_penalty = (
            int(base_fee * (overstay_mult - 1)) if duration > max_dur else 0
        )
        repeat_count = random.randint(0, 5)
        repeat_penalty = int(base_fee * 0.2 * repeat_count)
        final_fee = base_fee + overstay_penalty + repeat_penalty

        sessions.append((
            str(uuid.uuid4()), random.choice(plates), zone_id,
            entry.isoformat(), exit_time.isoformat(), duration,
            base_fee, overstay_penalty, repeat_count, repeat_penalty,
            final_fee, random.choice(["paid", "unpaid"]),
        ))
    cur.executemany(
        "INSERT INTO parking_sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        sessions,
    )

    conn.commit()
    conn.close()
