import sqlite3

DB_NAME = "parking.db"

def main():
    conn = sqlite3.connect(DB_NAME)
    cur = conn.cursor()

    cur.execute("""
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
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS vehicles (
        plate_number TEXT PRIMARY KEY,
        owner_name TEXT NOT NULL,
        vehicle_type TEXT NOT NULL,
        registration_status TEXT NOT NULL
    )
    """)

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
        user_id TEXT,
        FOREIGN KEY (plate_number) REFERENCES vehicles(plate_number),
        FOREIGN KEY (zone_id) REFERENCES zones(zone_id),
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL
    )
    """)

    cur.execute("""
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
    """)

    conn.commit()
    conn.close()

    print("✅ Database and tables created successfully!")

if __name__ == "__main__":
    main()
