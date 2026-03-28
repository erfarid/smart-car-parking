from app.database import get_connection


class SessionRepository:

    @staticmethod
    def create(session_id: str, plate_number: str, zone_id: str, entry_timestamp: str, user_id: str | None = None):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO parking_sessions
            (session_id, plate_number, zone_id, entry_timestamp, status, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (session_id, plate_number, zone_id, entry_timestamp, "active", user_id),
        )
        conn.commit()
        conn.close()

    @staticmethod
    def get_active(session_id: str):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT * FROM parking_sessions
            WHERE session_id=? AND status='active'
        """,
            (session_id,),
        )
        row = cur.fetchone()
        conn.close()
        return row

    @staticmethod
    def get_active_by_plate(plate_number: str):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT * FROM parking_sessions
            WHERE plate_number=? AND status='active'
            ORDER BY entry_timestamp DESC
            LIMIT 1
        """,
            (plate_number,),
        )
        row = cur.fetchone()
        conn.close()
        return row

    @staticmethod
    def count_previous_sessions(plate_number: str) -> int:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT COUNT(*) FROM parking_sessions
            WHERE plate_number=? AND status IN ('paid','unpaid','overdue','completed')
        """,
            (plate_number,),
        )
        count = int(cur.fetchone()[0])
        conn.close()
        return count

    @staticmethod
    def get_unpaid_by_plate(plate_number: str):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT * FROM parking_sessions
            WHERE plate_number=? AND status='unpaid'
            ORDER BY entry_timestamp DESC
        """,
            (plate_number,),
        )
        rows = cur.fetchall()
        conn.close()
        return rows

    @staticmethod
    def get_total_unpaid_by_plate(plate_number: str) -> int:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT COALESCE(SUM(final_fee), 0) FROM parking_sessions
            WHERE plate_number=? AND status IN ('unpaid', 'overdue')
        """,
            (plate_number,),
        )
        total = int(cur.fetchone()[0])
        conn.close()
        return total

    @staticmethod
    def mark_paid(session_ids: list):
        conn = get_connection()
        cur = conn.cursor()
        placeholders = ",".join(["?"] * len(session_ids))
        cur.execute(
            f"""
            UPDATE parking_sessions SET status='paid'
            WHERE session_id IN ({placeholders}) AND status IN ('unpaid', 'overdue')
        """,
            session_ids,
        )
        conn.commit()
        updated = cur.rowcount
        conn.close()
        return updated

    @staticmethod
    def mark_all_paid_by_plate(plate_number: str):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE parking_sessions SET status='paid'
            WHERE plate_number=? AND status IN ('unpaid', 'overdue')
        """,
            (plate_number,),
        )
        conn.commit()
        updated = cur.rowcount
        conn.close()
        return updated

    @staticmethod
    def apply_penalty_doubling(plate_number: str):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE parking_sessions
            SET final_fee = final_fee * 2, status = 'overdue'
            WHERE plate_number=? AND status IN ('unpaid', 'overdue')
        """,
            (plate_number,),
        )
        conn.commit()
        updated = cur.rowcount
        conn.close()
        return updated

    @staticmethod
    def get_congestion_by_zone():
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT zone_id, COUNT(*) AS active_count
            FROM parking_sessions
            WHERE status='active'
            GROUP BY zone_id
        """
        )
        rows = cur.fetchall()
        conn.close()
        return rows

    @staticmethod
    def close_session(
        session_id: str,
        exit_timestamp: str,
        duration_minutes: int,
        base_fee: int,
        overstay_penalty: int,
        repeat_count: int,
        repeat_penalty: int,
        final_fee: int,
        status: str = "unpaid",
    ):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE parking_sessions
            SET exit_timestamp=?,
                duration_minutes=?,
                base_fee=?,
                overstay_penalty=?,
                repeat_count=?,
                repeat_penalty=?,
                final_fee=?,
                status=?
            WHERE session_id=?
        """,
            (
                exit_timestamp,
                duration_minutes,
                base_fee,
                overstay_penalty,
                repeat_count,
                repeat_penalty,
                final_fee,
                status,
                session_id,
            ),
        )
        conn.commit()
        conn.close()
