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
    def get_by_plate_any(plate_number: str):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM vehicles WHERE plate_number=?", (plate_number,))
        row = cur.fetchone()
        conn.close()
        return row

    @staticmethod
    def get_by_plate(plate_number: str, owner_user_id: str | None = None):
        conn = get_connection()
        cur = conn.cursor()
        if owner_user_id:
            cur.execute(
                "SELECT * FROM vehicles WHERE plate_number=? AND owner_user_id=?",
                (plate_number, owner_user_id),
            )
        else:
            cur.execute("SELECT * FROM vehicles WHERE plate_number=?", (plate_number,))
        row = cur.fetchone()
        conn.close()
        return row

    @staticmethod
    def list_all(owner_user_id: str | None = None):
        conn = get_connection()
        cur = conn.cursor()
        if owner_user_id:
            cur.execute(
                "SELECT * FROM vehicles WHERE owner_user_id=? ORDER BY plate_number",
                (owner_user_id,),
            )
        else:
            cur.execute("SELECT * FROM vehicles ORDER BY plate_number")
        rows = cur.fetchall()
        conn.close()
        return rows

    @staticmethod
    def create_or_assign(
        plate_number: str,
        owner_name: str,
        vehicle_type: str,
        registration_status: str,
        owner_user_id: str | None = None,
    ):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM vehicles WHERE plate_number=?", (plate_number,))
        existing = cur.fetchone()

        if existing:
            existing_owner = existing["owner_user_id"] if "owner_user_id" in existing.keys() else None
            if not owner_user_id:
                conn.close()
                return {"ok": False, "reason": "already_exists"}
            if existing_owner not in (None, "", owner_user_id):
                conn.close()
                return {"ok": False, "reason": "owned_by_another_user"}

            cur.execute(
                """
                UPDATE vehicles
                SET owner_name=?, vehicle_type=?, registration_status=?, owner_user_id=?
                WHERE plate_number=?
            """,
                (owner_name, vehicle_type, registration_status, owner_user_id, plate_number),
            )
            conn.commit()
            conn.close()
            return {"ok": True, "action": "assigned", "plate_number": plate_number}

        cur.execute(
            """
            INSERT INTO vehicles
            (plate_number, owner_name, vehicle_type, registration_status, owner_user_id)
            VALUES (?, ?, ?, ?, ?)
        """,
            (plate_number, owner_name, vehicle_type, registration_status, owner_user_id),
        )
        conn.commit()
        conn.close()
        return {"ok": True, "action": "created", "plate_number": plate_number}

    @staticmethod
    def delete(plate_number: str):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM vehicles WHERE plate_number=?", (plate_number,))
        conn.commit()
        deleted = cur.rowcount == 1
        conn.close()
        return deleted
