import sqlite3
import random
import string

def random_plate():
    letters = ''.join(random.choices(string.ascii_uppercase, k=3))
    numbers = ''.join(random.choices(string.digits, k=4))
    return f"{letters}-{numbers}"

def random_name():
    first_names = [
        "Adam", "Peter", "Anna", "Eva", "David", "Mark", "Julia", "Tamas",
        "Balazs", "Gabor", "Zoltan", "Levente", "Bence", "Daniel", "Robert",
        "Istvan", "Laszlo", "Csaba", "Norbert", "Viktor",
        "Eszter", "Katalin", "Monika", "Agnes", "Dora", "Lili", "Nora",
        "Zsofia", "Hanna", "Bianka", "Reka", "Timea", "Adrienn"
    ]

    last_names = [
        "Kovacs", "Nagy", "Szabo", "Toth", "Varga", "Molnar",
        "Horvath", "Balogh", "Farkas", "Lakatos", "Papp",
        "Kiss", "Simon", "Boros", "Szalai", "Juhasz",
        "Miklos", "Fodor", "Kertesz", "Gulyas",
        "Barta", "Sipos", "Hegedus", "Vadasz", "Bognar"
    ]

    return random.choice(first_names) + " " + random.choice(last_names)

conn = sqlite3.connect("parking.db")
cur = conn.cursor()

vehicles = []

for _ in range(500):
    vehicles.append((
        random_plate(),
        random_name(),
        random.choice(["car", "van", "truck", "electric", "hybrid"]),
        "active"
    ))

cur.executemany("""
INSERT OR IGNORE INTO vehicles
(plate_number, owner_name, vehicle_type, registration_status)
VALUES (?, ?, ?, ?)
""", vehicles)

conn.commit()
conn.close()

print("✅ 500 vehicles inserted successfully!")