from app.database import get_connection


class VehicleRepository:

    @staticmethod
    def exists(plate_number: str) -> bool:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM vehicles WHERE plate_number=?", (plate_number,))
        found = cur.fetchone() is not None
        conn.close()
        return found

    @staticmethod
    def get_by_plate(plate_number: str):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM vehicles WHERE plate_number=?", (plate_number,))
        row = cur.fetchone()
        conn.close()
        return row

    @staticmethod
    def list_all():
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM vehicles ORDER BY plate_number")
        rows = cur.fetchall()
        conn.close()
        return rows

    @staticmethod
    def create(plate_number: str, owner_name: str, vehicle_type: str, registration_status: str):
        """
        Insert vehicle. If plate already exists, it will not crash.
        Returns True if inserted, False if ignored.
        """
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT OR IGNORE INTO vehicles
            (plate_number, owner_name, vehicle_type, registration_status)
            VALUES (?, ?, ?, ?)
        """, (plate_number, owner_name, vehicle_type, registration_status))
        conn.commit()
        inserted = (cur.rowcount == 1)
        conn.close()
        return inserted

    @staticmethod
    def delete(plate_number: str):
        """
        Delete vehicle by plate.
        Returns True if deleted, False if not found.
        """
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM vehicles WHERE plate_number=?", (plate_number,))
        conn.commit()
        deleted = (cur.rowcount == 1)
        conn.close()
        return deleted