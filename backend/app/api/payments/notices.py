from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query

from app.database import get_connection
from app.services.session_service import SessionService

from .common import LEGAL_NOTICE_THRESHOLD, PENALTY_THRESHOLD, normalize_plate

router = APIRouter()


@router.get("/unpaid/{plate_number}")
def get_unpaid_sessions(
    plate_number: str,
    user_id: Optional[str] = Query(default=None),
    role: str = Query(default="user"),
):
    plate = normalize_plate(plate_number)
    conn = get_connection()
    cur = conn.cursor()

    if role == "admin":
        cur.execute(
            """
            SELECT * FROM parking_sessions
            WHERE plate_number=? AND status IN ('unpaid','overdue')
            ORDER BY entry_timestamp DESC
        """,
            (plate,),
        )
        rows = [dict(r) for r in cur.fetchall()]
        cur.execute(
            """
            SELECT COALESCE(SUM(final_fee), 0) FROM parking_sessions
            WHERE plate_number=? AND status IN ('unpaid','overdue')
        """,
            (plate,),
        )
    else:
        cur.execute(
            """
            SELECT * FROM parking_sessions
            WHERE plate_number=? AND status IN ('unpaid','overdue') AND user_id=?
            ORDER BY entry_timestamp DESC
        """,
            (plate, user_id or ""),
        )
        rows = [dict(r) for r in cur.fetchall()]
        cur.execute(
            """
            SELECT COALESCE(SUM(final_fee), 0) FROM parking_sessions
            WHERE plate_number=? AND status IN ('unpaid','overdue') AND user_id=?
        """,
            (plate, user_id or ""),
        )

    total = int(cur.fetchone()[0])
    conn.close()

    return {
        "sessions": rows,
        "total_unpaid": total,
        "penalty_warning": total >= PENALTY_THRESHOLD,
        "legal_warning": total >= LEGAL_NOTICE_THRESHOLD,
        "penalty_threshold": PENALTY_THRESHOLD,
    }


@router.get("/check-penalty/{plate_number}")
def check_penalty(
    plate_number: str,
    user_id: Optional[str] = Query(default=None),
    role: str = Query(default="user"),
):
    plate = normalize_plate(plate_number)
    conn = get_connection()
    cur = conn.cursor()

    if role == "admin":
        where_clause = "plate_number=? AND status IN ('unpaid','overdue')"
        params = [plate]
    else:
        where_clause = "plate_number=? AND status IN ('unpaid','overdue') AND user_id=?"
        params = [plate, user_id or ""]

    cur.execute(f"SELECT COALESCE(SUM(final_fee), 0) FROM parking_sessions WHERE {where_clause}", params)
    total = int(cur.fetchone()[0])

    penalty_applied = False
    if total >= PENALTY_THRESHOLD:
        cur.execute(
            f"UPDATE parking_sessions SET final_fee = final_fee * 2, status = 'overdue' WHERE {where_clause}",
            params,
        )
        conn.commit()
        penalty_applied = cur.rowcount > 0

        cur.execute(f"SELECT COALESCE(SUM(final_fee), 0) FROM parking_sessions WHERE {where_clause}", params)
        total = int(cur.fetchone()[0])

    conn.close()

    return {
        "plate_number": plate,
        "total_unpaid": total,
        "penalty_applied": penalty_applied,
        "message": (
            f"PENALTY APPLIED: Outstanding amount has been doubled to {total:,} HUF. Immediate payment is required."
            if penalty_applied
            else "No penalty applied."
        ),
    }


@router.get("/notices")
def get_notices(
    user_id: Optional[str] = Query(default=None),
    role: str = Query(default="user"),
):
    user_role = (role or "user").strip().lower()
    conn = get_connection()
    cur = conn.cursor()

    if user_role == "admin":
        cur.execute(
            """
            SELECT * FROM parking_sessions
            WHERE user_id IS NOT NULL
            ORDER BY entry_timestamp DESC
        """
        )
    else:
        cur.execute(
            """
            SELECT * FROM parking_sessions
            WHERE user_id=?
            ORDER BY entry_timestamp DESC
        """,
            (user_id or "",),
        )
    sessions = [dict(r) for r in cur.fetchall()]

    direct_messages = []
    worker_fines = []
    if user_role == "user" and user_id:
        cur.execute(
            """
            SELECT message_id, sender_name, title, message, created_at
            FROM user_messages
            WHERE recipient_user_id=?
            ORDER BY created_at DESC
        """,
            (user_id,),
        )
        direct_messages = [dict(r) for r in cur.fetchall()]

        cur.execute(
            """
            SELECT fine_id, plate_number, amount, reason, note, issued_at, status, worker_name
            FROM worker_fines
            WHERE recipient_user_id=?
            ORDER BY issued_at DESC
        """,
            (user_id,),
        )
        worker_fines = [dict(r) for r in cur.fetchall()]

    conn.close()

    notices = []
    latest_by_plate = {}
    active_sessions = []

    for direct in direct_messages:
        notices.append(
            {
                "notice_id": f"msg-{direct['message_id']}",
                "level": "info",
                "title": direct.get("title") or "System message",
                "plate_number": None,
                "amount": None,
                "created_at": direct.get("created_at") or datetime.now().isoformat(),
                "message": direct.get("message") or "",
                "source": "admin_message",
                "sender_name": direct.get("sender_name") or "System",
            }
        )

    for fine in worker_fines:
        notices.append(
            {
                "notice_id": f"worker-fine-{fine['fine_id']}",
                "level": "error",
                "title": "Worker parking fine",
                "plate_number": fine.get("plate_number"),
                "amount": int(fine.get("amount") or 0),
                "created_at": fine.get("issued_at") or datetime.now().isoformat(),
                "message": (
                    f"A parking worker issued a {int(fine.get('amount') or 0):,} HUF fine for {fine.get('plate_number')}. "
                    f"Reason: {fine.get('reason')}."
                    + (f" Note: {fine.get('note')}" if fine.get('note') else "")
                ),
                "source": "worker_fine",
                "sender_name": fine.get("worker_name") or "Worker",
            }
        )

    for session in sessions:
        plate = session["plate_number"]
        record = latest_by_plate.setdefault(
            plate,
            {
                "plate_number": plate,
                "total_unpaid": 0,
                "unpaid_count": 0,
                "overdue_count": 0,
                "latest_timestamp": session.get("entry_timestamp") or datetime.now().isoformat(),
            },
        )
        if session["status"] in ("unpaid", "overdue"):
            record["total_unpaid"] += int(session.get("final_fee") or 0)
            record["unpaid_count"] += 1
            if session["status"] == "overdue":
                record["overdue_count"] += 1
        if session["status"] == "active":
            active_sessions.append(session)

    for active in active_sessions:
        quote = SessionService._calculate_quote(active)
        notices.append(
            {
                "notice_id": f"active-{active['session_id']}",
                "level": "info",
                "title": "Active session is running",
                "plate_number": active["plate_number"],
                "amount": quote["estimated_final_fee"],
                "created_at": quote["quote_timestamp"],
                "message": (
                    f"Your session for {active['plate_number']} in zone {active['zone_id']} is still active. "
                    f"Current payable amount is {quote['estimated_final_fee']:,} HUF. Open Payment and submit the demo card form to end it."
                ),
                "source": "system",
            }
        )

    for plate, summary in latest_by_plate.items():
        total = summary["total_unpaid"]
        if total <= 0:
            continue

        notices.append(
            {
                "notice_id": f"due-{plate}",
                "level": "warning",
                "title": "Outstanding payment notice",
                "plate_number": plate,
                "amount": total,
                "created_at": summary["latest_timestamp"],
                "message": (
                    f"You currently have {summary['unpaid_count']} unpaid session(s) for {plate}. "
                    f"Outstanding amount: {total:,} HUF. Please pay to avoid additional surcharges."
                ),
                "source": "system",
            }
        )

        if total >= LEGAL_NOTICE_THRESHOLD:
            notices.append(
                {
                    "notice_id": f"legal-{plate}",
                    "level": "warning",
                    "title": "Legal notice reminder",
                    "plate_number": plate,
                    "amount": total,
                    "created_at": summary["latest_timestamp"],
                    "message": (
                        f"Your unpaid amount for {plate} has reached {total:,} HUF. "
                        "This account is now in the legal notice range and the amount may increase if it remains unpaid."
                    ),
                    "source": "system",
                }
            )

        if total >= PENALTY_THRESHOLD or summary["overdue_count"] > 0:
            notices.append(
                {
                    "notice_id": f"penalty-{plate}",
                    "level": "error",
                    "title": "Penalty / legal action warning",
                    "plate_number": plate,
                    "amount": total,
                    "created_at": summary["latest_timestamp"],
                    "message": (
                        f"Your balance for {plate} is {total:,} HUF and penalty rules may already apply. "
                        "Pay immediately to stop further increases and clear the notice."
                    ),
                    "source": "system",
                }
            )

    notices.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return notices
