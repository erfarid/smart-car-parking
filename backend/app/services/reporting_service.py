from typing import Optional
from app.database import get_connection


class ReportingService:

    @staticmethod
    def revenue_by_zone():
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT zone_id, SUM(final_fee) AS revenue
            FROM parking_sessions
            WHERE final_fee IS NOT NULL
            GROUP BY zone_id
            ORDER BY revenue DESC
        """)
        rows = cur.fetchall()
        conn.close()
        return rows

    @staticmethod
    def revenue_summary():
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                COALESCE(SUM(final_fee), 0) AS total_revenue,
                COALESCE(SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END), 0) AS paid_count,
                COALESCE(SUM(CASE WHEN status='unpaid' THEN 1 ELSE 0 END), 0) AS unpaid_count,
                COALESCE(SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END), 0) AS overdue_count
            FROM parking_sessions
        """)
        row = cur.fetchone()
        conn.close()

        return {
            "total_revenue": int(row["total_revenue"]),
            "paid_count": int(row["paid_count"]),
            "unpaid_count": int(row["unpaid_count"]),
            "overdue_count": int(row["overdue_count"]),
        }

    @staticmethod
    def sessions_by_date_range(date_from: Optional[str], date_to: Optional[str]):
        conn = get_connection()
        cur = conn.cursor()

        query = "SELECT * FROM parking_sessions WHERE 1=1"
        params = []

        if date_from:
            query += " AND entry_timestamp >= ?"
            params.append(date_from)

        if date_to:
            query += " AND entry_timestamp <= ?"
            params.append(date_to)

        query += " ORDER BY entry_timestamp DESC"

        cur.execute(query, params)
        rows = cur.fetchall()
        conn.close()

        return rows