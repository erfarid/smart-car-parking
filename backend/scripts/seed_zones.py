import sqlite3

conn = sqlite3.connect("parking.db")
cur = conn.cursor()

zones = [
    ("Z_001", "District_I_Downtown", 2000, "08:00", "18:00", 1.5, 240, 2.0),
    ("Z_002", "District_II_Center", 1800, "08:00", "18:00", 1.4, 240, 2.0),
    ("Z_003", "District_III", 1500, "08:00", "18:00", 1.3, 240, 2.0),
    ("Z_004", "District_IV", 1300, "08:00", "18:00", 1.2, 240, 2.0),
    ("Z_005", "District_V", 2200, "08:00", "18:00", 1.6, 240, 2.5),
    ("Z_006", "District_VI", 1600, "08:00", "18:00", 1.3, 240, 2.0),
    ("Z_007", "District_VII", 1700, "08:00", "18:00", 1.4, 240, 2.0)
]

cur.executemany("""
INSERT INTO zones 
(zone_id, zone_name, base_hourly_rate, peak_start, peak_end, peak_multiplier, max_duration_minutes, overstay_multiplier)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
""", zones)

conn.commit()
conn.close()

print("✅ Zones inserted successfully")