import sqlite3
import random
from datetime import datetime, timedelta
import uuid

conn = sqlite3.connect("parking.db")
cur = conn.cursor()

# Fetch vehicles and zones from DB
cur.execute("SELECT plate_number FROM vehicles")
plates = [row[0] for row in cur.fetchall()]

cur.execute("SELECT zone_id, base_hourly_rate, peak_multiplier, max_duration_minutes, overstay_multiplier FROM zones")
zones = cur.fetchall()

sessions = []

for _ in range(2000):
    session_id = str(uuid.uuid4())
    plate = random.choice(plates)
    zone = random.choice(zones)

    zone_id = zone[0]
    base_rate = zone[1]
    peak_multiplier = zone[2]
    max_duration = zone[3]
    overstay_multiplier = zone[4]

    entry_time = datetime.now() - timedelta(days=random.randint(0, 365))
    duration = random.randint(30, 480)  # 30 min to 8 hours
    exit_time = entry_time + timedelta(minutes=duration)

    hours = duration / 60
    base_fee = int(base_rate * hours)

    overstay_penalty = 0
    if duration > max_duration:
        overstay_penalty = int(base_fee * (overstay_multiplier - 1))

    # Count repeat sessions for same plate
    cur.execute("SELECT COUNT(*) FROM parking_sessions WHERE plate_number=?", (plate,))
    repeat_count = cur.fetchone()[0]

    repeat_penalty = int(base_fee * 0.2 * repeat_count)

    final_fee = base_fee + overstay_penalty + repeat_penalty

    sessions.append((
        session_id,
        plate,
        zone_id,
        entry_time.isoformat(),
        exit_time.isoformat(),
        duration,
        base_fee,
        overstay_penalty,
        repeat_count,
        repeat_penalty,
        final_fee,
        random.choice(["paid", "unpaid"])
    ))

cur.executemany("""
INSERT INTO parking_sessions
(session_id, plate_number, zone_id, entry_timestamp, exit_timestamp,
 duration_minutes, base_fee, overstay_penalty, repeat_count,
 repeat_penalty, final_fee, status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", sessions)

conn.commit()
conn.close()

print("✅ 2000 parking sessions generated successfully!")