import sqlite3

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

conn = sqlite3.connect("parking.db")
cur = conn.cursor()

cur.executemany("""
INSERT INTO zones
(zone_id, zone_name, base_hourly_rate, peak_start, peak_end, peak_multiplier, max_duration_minutes, overstay_multiplier)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
""", BUDAPEST_DISTRICT_ZONES)

conn.commit()
conn.close()

print("✅ 23 Budapest district zones inserted successfully")
