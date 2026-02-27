from app.database import get_connection


class SessionRepository:

    @staticmethod
    def create(session_id: str, plate_number: str, zone_id: str, entry_timestamp: str):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO parking_sessions
            (session_id, plate_number, zone_id, entry_timestamp, status)
            VALUES (?, ?, ?, ?, ?)
        """, (session_id, plate_number, zone_id, entry_timestamp, "active"))
        conn.commit()
        conn.close()

    @staticmethod
    def get_active(session_id: str):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM parking_sessions
            WHERE session_id=? AND status='active'
        """, (session_id,))
        row = cur.fetchone()
        conn.close()
        return row

    @staticmethod
    def count_previous_sessions(plate_number: str) -> int:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT COUNT(*) FROM parking_sessions
            WHERE plate_number=? AND status IN ('paid','unpaid','overdue','completed')
        """, (plate_number,))
        count = int(cur.fetchone()[0])
        conn.close()
        return count

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
        cur.execute("""
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
        """, (
            exit_timestamp,
            duration_minutes,
            base_fee,
            overstay_penalty,
            repeat_count,
            repeat_penalty,
            final_fee,
            status,
            session_id
        ))
        conn.commit()
        conn.close()