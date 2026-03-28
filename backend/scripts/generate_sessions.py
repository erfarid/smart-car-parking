import os
import sys
import random
import sqlite3
import uuid
from datetime import datetime, timedelta

# Make sure "app" can be imported when running:
# python scripts/generate_sessions.py
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.fee_calculation_service import FeeCalculationService


DB_PATH = os.path.join(BACKEND_DIR, "parking.db")


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT plate_number FROM vehicles")
    plates = [row[0] for row in cur.fetchall()]

    if not plates:
        conn.close()
        print("❌ No vehicles found. Run generate_vehicles.py first.")
        return

    cur.execute("""
        SELECT
            zone_id,
            base_hourly_rate,
            peak_start,
            peak_end,
            peak_multiplier,
            max_duration_minutes,
            overstay_multiplier
        FROM zones
    """)
    zones = cur.fetchall()

    if not zones:
        conn.close()
        print("❌ No zones found. Run seed_zones.py first.")
        return

    sessions = []

    for _ in range(2000):
        session_id = str(uuid.uuid4())
        plate = random.choice(plates)
        zone = random.choice(zones)

        zone_payload = {
            "base_hourly_rate": zone[1],
            "peak_start": zone[2],
            "peak_end": zone[3],
            "peak_multiplier": zone[4],
            "max_duration_minutes": zone[5],
            "overstay_multiplier": zone[6],
        }

        entry_time = datetime.now() - timedelta(
            days=random.randint(0, 365),
            minutes=random.randint(0, 1439),
        )
        duration = random.randint(5, 1800)  # up to 30 hours for testing overstay
        exit_time = entry_time + timedelta(minutes=duration)

        cur.execute("SELECT COUNT(*) FROM parking_sessions WHERE plate_number = ?", (plate,))
        repeat_count = cur.fetchone()[0]

        fee = FeeCalculationService.calculate(
            zone_payload,
            duration,
            repeat_count=repeat_count,
            entry_timestamp=entry_time.isoformat(),
        )

        sessions.append((
            session_id,
            plate,
            zone[0],
            entry_time.isoformat(),
            exit_time.isoformat(),
            duration,
            fee["base_fee"],
            fee["overstay_penalty"],
            repeat_count,
            fee["repeat_penalty"],
            fee["final_fee"],
            random.choice(["paid", "unpaid"])
        ))

    cur.executemany("""
        INSERT INTO parking_sessions
        (
            session_id,
            plate_number,
            zone_id,
            entry_timestamp,
            exit_timestamp,
            duration_minutes,
            base_fee,
            overstay_penalty,
            repeat_count,
            repeat_penalty,
            final_fee,
            status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, sessions)

    conn.commit()
    conn.close()

    print("✅ 2000 parking sessions generated successfully!")


if __name__ == "__main__":
    main()