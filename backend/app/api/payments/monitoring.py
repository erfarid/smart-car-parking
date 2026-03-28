from fastapi import APIRouter

from app.database import get_connection
from app.services.session_service import SessionService

router = APIRouter()


@router.get("/admin-records")
def admin_payment_records():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            ps.session_id,
            ps.plate_number,
            ps.zone_id,
            ps.entry_timestamp,
            ps.final_fee,
            ps.status,
            u.user_id,
            COALESCE(u.name, v.owner_name, 'Unknown owner') AS owner_name,
            COALESCE(u.email, '') AS email,
            p.payment_id,
            p.amount AS payment_amount,
            p.payment_timestamp,
            p.status AS payment_status
        FROM parking_sessions ps
        LEFT JOIN users u ON ps.user_id = u.user_id
        LEFT JOIN vehicles v ON ps.plate_number = v.plate_number
        LEFT JOIN payments p ON p.session_id = ps.session_id
        WHERE ps.user_id IS NOT NULL
        ORDER BY
            CASE
                WHEN ps.status = 'active' THEN 0
                WHEN ps.status IN ('unpaid', 'overdue') THEN 1
                WHEN ps.status = 'paid' THEN 2
                ELSE 3
            END,
            COALESCE(p.payment_timestamp, ps.entry_timestamp) DESC
    """
    )
    rows = cur.fetchall()
    conn.close()

    records = []
    for row in rows:
        item = dict(row)
        amount = int(item.get("payment_amount") or item.get("final_fee") or 0)
        record_date = item.get("payment_timestamp") or item.get("entry_timestamp")

        if item.get("status") == "active":
            try:
                quote = SessionService._calculate_quote(item)
                amount = int(quote.get("estimated_final_fee") or 0)
                record_date = quote.get("quote_timestamp") or record_date
            except Exception:
                pass

        records.append(
            {
                "payment_id": item.get("payment_id") or item["session_id"],
                "session_id": item["session_id"],
                "plate_number": item.get("plate_number"),
                "zone_id": item.get("zone_id"),
                "owner_name": item.get("owner_name") or "Unknown owner",
                "email": item.get("email") or "-",
                "amount": amount,
                "status": item.get("status") or item.get("payment_status") or "unknown",
                "date": record_date,
            }
        )

    return records


@router.get("/congestion")
def get_congestion():
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

    result = []
    for row in rows:
        count = row["active_count"]
        if count <= 3:
            level = "low"
        elif count <= 7:
            level = "medium"
        else:
            level = "high"
        result.append(
            {
                "zone_id": row["zone_id"],
                "active_vehicles": count,
                "congestion_level": level,
            }
        )
    return result
