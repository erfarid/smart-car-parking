import hashlib
import os
import random
import sqlite3
import string
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from app.services.fee_calculation_service import FeeCalculationService

# On Vercel, use /tmp (only writable dir). Locally, use backend/parking.db
if os.environ.get("VERCEL"):
    DB_PATH = Path("/tmp/parking.db")
else:
    BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
    DB_PATH = BASE_DIR / "parking.db"

_initialized = False

BUDAPEST_DISTRICT_ZONES = [
    ("D01", "District I - Várkerület", 620, "08:00", "18:00", 1.25, 1440, 1.5),
    ("D02", "District II - Rózsadomb", 580, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D03", "District III - Óbuda-Békásmegyer", 520, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D04", "District IV - Újpest", 500, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D05", "District V - Belváros-Lipótváros", 700, "08:00", "18:00", 1.3, 1440, 1.6),
    ("D06", "District VI - Terézváros", 680, "08:00", "18:00", 1.3, 1440, 1.6),
    ("D07", "District VII - Erzsébetváros", 660, "08:00", "18:00", 1.3, 1440, 1.6),
    ("D08", "District VIII - Józsefváros", 620, "08:00", "18:00", 1.25, 1440, 1.5),
    ("D09", "District IX - Ferencváros", 600, "08:00", "18:00", 1.25, 1440, 1.5),
    ("D10", "District X - Kőbánya", 500, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D11", "District XI - Újbuda", 620, "08:00", "18:00", 1.25, 1440, 1.5),
    ("D12", "District XII - Hegyvidék", 560, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D13", "District XIII - Angyalföld", 620, "08:00", "18:00", 1.25, 1440, 1.5),
    ("D14", "District XIV - Zugló", 560, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D15", "District XV - Rákospalota-Pestújhely", 480, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D16", "District XVI - Mátyásföld", 460, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D17", "District XVII - Rákosmente", 450, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D18", "District XVIII - Pestszentlőrinc-Pestszentimre", 470, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D19", "District XIX - Kispest", 500, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D20", "District XX - Pesterzsébet", 480, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D21", "District XXI - Csepel", 470, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D22", "District XXII - Budafok-Tétény", 500, "08:00", "18:00", 1.2, 1440, 1.5),
    ("D23", "District XXIII - Soroksár", 450, "08:00", "18:00", 1.2, 1440, 1.5),
]


def _seed_budapest_zones_if_empty(conn: sqlite3.Connection):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM zones")
    zone_count = cur.fetchone()[0]
    if zone_count == 0:
        cur.executemany("INSERT INTO zones VALUES (?, ?, ?, ?, ?, ?, ?, ?)", BUDAPEST_DISTRICT_ZONES)
        conn.commit()


def _ensure_schema(conn: sqlite3.Connection):
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TEXT NOT NULL
        )
    """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS zones (
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

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS vehicles (
            plate_number TEXT PRIMARY KEY,
            owner_name TEXT NOT NULL,
            vehicle_type TEXT NOT NULL,
            registration_status TEXT NOT NULL,
            owner_user_id TEXT,
            FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
        )
    """
    )

    cur.execute(
        """
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
            user_id TEXT,
            FOREIGN KEY (plate_number) REFERENCES vehicles(plate_number),
            FOREIGN KEY (zone_id) REFERENCES zones(zone_id),
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS payments (
            payment_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            amount INTEGER NOT NULL,
            cardholder_name TEXT,
            card_last_four TEXT,
            payment_timestamp TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'success',
            FOREIGN KEY (user_id) REFERENCES users(user_id),
            FOREIGN KEY (session_id) REFERENCES parking_sessions(session_id)
        )
    """
    )

    cur.execute("PRAGMA table_info(vehicles)")
    vehicle_columns = {row[1] for row in cur.fetchall()}
    if "owner_user_id" not in vehicle_columns:
        cur.execute("ALTER TABLE vehicles ADD COLUMN owner_user_id TEXT")

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS user_messages (
            message_id TEXT PRIMARY KEY,
            recipient_user_id TEXT NOT NULL,
            recipient_email TEXT NOT NULL,
            sender_user_id TEXT,
            sender_name TEXT,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (recipient_user_id) REFERENCES users(user_id),
            FOREIGN KEY (sender_user_id) REFERENCES users(user_id)
        )
    """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS worker_fines (
            fine_id TEXT PRIMARY KEY,
            plate_number TEXT NOT NULL,
            recipient_user_id TEXT NOT NULL,
            recipient_email TEXT NOT NULL,
            worker_user_id TEXT NOT NULL,
            worker_name TEXT NOT NULL,
            amount INTEGER NOT NULL DEFAULT 10000,
            reason TEXT NOT NULL,
            note TEXT,
            issued_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'unpaid',
            related_message_id TEXT,
            FOREIGN KEY (recipient_user_id) REFERENCES users(user_id),
            FOREIGN KEY (worker_user_id) REFERENCES users(user_id),
            FOREIGN KEY (related_message_id) REFERENCES user_messages(message_id)
        )
    """
    )

    admin_pw = hashlib.sha256("admin123".encode()).hexdigest()
    cur.execute(
        """
        INSERT OR IGNORE INTO users (user_id, name, email, password, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """,
        ("admin-001", "Admin", "admin@smartparking.hu", admin_pw, "admin", datetime.now().isoformat()),
    )
    _seed_budapest_zones_if_empty(conn)
    conn.commit()


def get_connection():
    global _initialized

    if not _initialized and os.environ.get("VERCEL"):
        _init_db()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    if not _initialized:
        _ensure_schema(conn)
        _initialized = True

    return conn


def _init_db():
    """Create tables and seed demo data on Vercel cold start."""
    if DB_PATH.exists():
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(
        """
    CREATE TABLE IF NOT EXISTS zones (
        zone_id TEXT PRIMARY KEY,
        zone_name TEXT NOT NULL,
        base_hourly_rate INTEGER NOT NULL,
        peak_start TEXT NOT NULL,
        peak_end TEXT NOT NULL,
        peak_multiplier REAL NOT NULL,
        max_duration_minutes INTEGER NOT NULL DEFAULT 1440,
        overstay_multiplier REAL NOT NULL DEFAULT 1.5
    )"""
    )

    cur.execute(
        """
    CREATE TABLE IF NOT EXISTS vehicles (
        plate_number TEXT PRIMARY KEY,
        owner_name TEXT NOT NULL,
        vehicle_type TEXT NOT NULL,
        registration_status TEXT NOT NULL,
        owner_user_id TEXT,
        FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
    )"""
    )

    cur.execute(
        """
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
        user_id TEXT,
        FOREIGN KEY (plate_number) REFERENCES vehicles(plate_number),
        FOREIGN KEY (zone_id) REFERENCES zones(zone_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    )"""
    )

    cur.execute(
        """
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL
    )"""
    )

    cur.execute(
        """
    CREATE TABLE IF NOT EXISTS payments (
        payment_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        cardholder_name TEXT,
        card_last_four TEXT,
        payment_timestamp TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'success',
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (session_id) REFERENCES parking_sessions(session_id)
    )"""
    )

    cur.execute(
        """
    CREATE TABLE IF NOT EXISTS user_messages (
        message_id TEXT PRIMARY KEY,
        recipient_user_id TEXT NOT NULL,
        recipient_email TEXT NOT NULL,
        sender_user_id TEXT,
        sender_name TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (recipient_user_id) REFERENCES users(user_id),
        FOREIGN KEY (sender_user_id) REFERENCES users(user_id)
    )"""
    )

    cur.execute(
        """
    CREATE TABLE IF NOT EXISTS worker_fines (
        fine_id TEXT PRIMARY KEY,
        plate_number TEXT NOT NULL,
        recipient_user_id TEXT NOT NULL,
        recipient_email TEXT NOT NULL,
        worker_user_id TEXT NOT NULL,
        worker_name TEXT NOT NULL,
        amount INTEGER NOT NULL DEFAULT 10000,
        reason TEXT NOT NULL,
        note TEXT,
        issued_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unpaid',
        related_message_id TEXT,
        FOREIGN KEY (recipient_user_id) REFERENCES users(user_id),
        FOREIGN KEY (worker_user_id) REFERENCES users(user_id),
        FOREIGN KEY (related_message_id) REFERENCES user_messages(message_id)
    )"""
    )

    admin_pw = hashlib.sha256("admin123".encode()).hexdigest()
    cur.execute(
        """
        INSERT OR IGNORE INTO users (user_id, name, email, password, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """,
        ("admin-001", "Admin", "admin@smartparking.hu", admin_pw, "admin", datetime.now().isoformat()),
    )

    cur.executemany("INSERT OR IGNORE INTO zones VALUES (?, ?, ?, ?, ?, ?, ?, ?)", BUDAPEST_DISTRICT_ZONES)

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
        plate = "".join(random.choices(string.ascii_uppercase, k=3)) + "-" + "".join(random.choices(string.digits, k=4))
        name = random.choice(first_names) + " " + random.choice(last_names)
        vtype = random.choice(["car", "van", "truck", "electric", "hybrid"])
        vehicles.append((plate, name, vtype, "active", None))
    cur.executemany("INSERT OR IGNORE INTO vehicles VALUES (?, ?, ?, ?, ?)", vehicles)

    plates = [v[0] for v in vehicles]
    sessions = []
    for _ in range(500):
        zone = random.choice(BUDAPEST_DISTRICT_ZONES)
        zone_id = zone[0]

        entry = datetime.now() - timedelta(days=random.randint(0, 365), minutes=random.randint(0, 1439))
        duration = random.randint(5, 1800)
        exit_time = entry + timedelta(minutes=duration)

        repeat_count = random.randint(0, 5)
        fee_quote = FeeCalculationService.calculate(
            {
                "base_hourly_rate": zone[2],
                "peak_start": zone[3],
                "peak_end": zone[4],
                "peak_multiplier": zone[5],
                "max_duration_minutes": zone[6],
                "overstay_multiplier": zone[7],
            },
            duration,
            repeat_count=repeat_count,
            entry_timestamp=entry.isoformat(),
        )

        sessions.append(
            (
                str(uuid.uuid4()),
                random.choice(plates),
                zone_id,
                entry.isoformat(),
                exit_time.isoformat(),
                duration,
                fee_quote["base_fee"],
                fee_quote["overstay_penalty"],
                repeat_count,
                fee_quote["repeat_penalty"],
                fee_quote["final_fee"],
                random.choice(["paid", "unpaid"]),
                None,
            )
        )
    cur.executemany(
        """
        INSERT INTO parking_sessions (
            session_id, plate_number, zone_id, entry_timestamp, exit_timestamp,
            duration_minutes, base_fee, overstay_penalty, repeat_count,
            repeat_penalty, final_fee, status, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        sessions,
    )

    conn.commit()
    conn.close()
