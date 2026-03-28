import uuid
from datetime import datetime

from fastapi import APIRouter

from app.database import get_connection
from app.services.session_service import SessionService

from .common import CheckoutActiveRequest, PayAllRequest, PaySessionRequest, ensure_session_access, normalize_plate

router = APIRouter()


@router.post("/pay")
def pay_sessions(data: PaySessionRequest):
    if not data.session_ids:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail="No session IDs provided")

    user_role = (data.user_role or "user").strip().lower()
    conn = get_connection()
    cur = conn.cursor()

    receipts = []
    now = datetime.now().isoformat()

    for sid in data.session_ids:
        cur.execute(
            "SELECT * FROM parking_sessions WHERE session_id=? AND status IN ('unpaid','overdue')",
            (sid,),
        )
        session = cur.fetchone()
        if not session:
            continue

        ensure_session_access(session, data.user_id, user_role)

        cur.execute("UPDATE parking_sessions SET status='paid' WHERE session_id=?", (sid,))

        payment_id = str(uuid.uuid4())
        payment_user_id = data.user_id or session["user_id"] or ""
        cur.execute(
            """
            INSERT INTO payments (payment_id, user_id, session_id, amount, cardholder_name, card_last_four, payment_timestamp, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'success')
        """,
            (
                payment_id,
                payment_user_id,
                sid,
                session["final_fee"],
                data.cardholder_name or "",
                data.card_last_four or "",
                now,
            ),
        )

        receipts.append(
            {
                "payment_id": payment_id,
                "session_id": sid,
                "plate_number": session["plate_number"],
                "zone_id": session["zone_id"],
                "amount": session["final_fee"],
                "payment_timestamp": now,
                "status": "success",
            }
        )

    conn.commit()
    conn.close()

    total_paid = sum(r["amount"] for r in receipts)
    return {
        "message": f"{len(receipts)} session(s) paid successfully",
        "total_paid": total_paid,
        "receipts": receipts,
    }


@router.post("/checkout-active")
def checkout_active_session(data: CheckoutActiveRequest):
    from fastapi import HTTPException

    user_role = (data.user_role or "user").strip().lower()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM parking_sessions WHERE session_id=? AND status='active'", (data.session_id,))
    session = cur.fetchone()
    conn.close()

    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")

    ensure_session_access(session, data.user_id, user_role)

    closed = SessionService.finalize_session(data.session_id, final_status="paid")

    now = datetime.now().isoformat()
    payment_id = str(uuid.uuid4())
    payment_user_id = data.user_id or closed["user_id"] or ""

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO payments (payment_id, user_id, session_id, amount, cardholder_name, card_last_four, payment_timestamp, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'success')
    """,
        (
            payment_id,
            payment_user_id,
            data.session_id,
            closed["final_fee"],
            data.cardholder_name or "",
            data.card_last_four or "",
            now,
        ),
    )
    conn.commit()
    conn.close()

    return {
        "message": "Payment submitted and session ended",
        "total_paid": closed["final_fee"],
        "receipts": [
            {
                "payment_id": payment_id,
                "session_id": data.session_id,
                "plate_number": closed["plate_number"],
                "zone_id": closed["zone_id"],
                "amount": closed["final_fee"],
                "payment_timestamp": now,
                "status": "success",
            }
        ],
        "closed_session": closed,
    }


@router.post("/pay-all")
def pay_all_by_plate(data: PayAllRequest):
    plate = normalize_plate(data.plate_number)
    user_role = (data.user_role or "user").strip().lower()
    conn = get_connection()
    cur = conn.cursor()

    if user_role == "admin":
        cur.execute(
            """
            SELECT * FROM parking_sessions
            WHERE plate_number=? AND status IN ('unpaid','overdue')
        """,
            (plate,),
        )
    else:
        cur.execute(
            """
            SELECT * FROM parking_sessions
            WHERE plate_number=? AND status IN ('unpaid','overdue') AND user_id=?
        """,
            (plate, data.user_id or ""),
        )
    sessions = cur.fetchall()

    if not sessions:
        conn.close()
        return {"message": "No unpaid sessions found", "updated": 0, "total_paid": 0, "receipts": []}

    receipts = []
    now = datetime.now().isoformat()

    for session in sessions:
        ensure_session_access(session, data.user_id, user_role)
        sid = session["session_id"]
        cur.execute("UPDATE parking_sessions SET status='paid' WHERE session_id=?", (sid,))

        payment_id = str(uuid.uuid4())
        payment_user_id = data.user_id or session["user_id"] or ""
        cur.execute(
            """
            INSERT INTO payments (payment_id, user_id, session_id, amount, cardholder_name, card_last_four, payment_timestamp, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'success')
        """,
            (
                payment_id,
                payment_user_id,
                sid,
                session["final_fee"],
                data.cardholder_name or "",
                data.card_last_four or "",
                now,
            ),
        )

        receipts.append(
            {
                "payment_id": payment_id,
                "session_id": sid,
                "plate_number": plate,
                "amount": session["final_fee"],
                "payment_timestamp": now,
                "status": "success",
            }
        )

    conn.commit()
    conn.close()

    total_paid = sum(r["amount"] for r in receipts)
    return {
        "message": f"{len(receipts)} session(s) paid for {plate}",
        "updated": len(receipts),
        "total_paid": total_paid,
        "receipts": receipts,
    }


@router.get("/history/{user_id}")
def payment_history(user_id: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT p.*, ps.plate_number, ps.zone_id, ps.duration_minutes
        FROM payments p
        JOIN parking_sessions ps ON p.session_id = ps.session_id
        WHERE p.user_id=?
        ORDER BY p.payment_timestamp DESC
    """,
        (user_id,),
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows
