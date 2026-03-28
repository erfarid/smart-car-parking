import uuid
from datetime import datetime

from fastapi import HTTPException, Query

from app.database import get_connection
from app.repositories.session_repository import SessionRepository
from app.repositories.vehicle_repository import VehicleRepository
from app.services.session_service import SessionService

from .common import MESSAGE_ENABLED_ROLES, WORKER_FINE_AMOUNT, StaffSendMessageRequest, WorkerFineNotifyRequest, WorkerScanFineRequest, require_message_sender
from .router import router


@router.post("/messages/send")
def send_staff_message(data: StaffSendMessageRequest):
    title = (data.title or "System message").strip() or "System message"
    message = (data.message or "").strip()
    recipient_email = (data.recipient_email or "").strip().lower()

    if not recipient_email:
        raise HTTPException(status_code=400, detail="Recipient email is required")
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    conn = get_connection()
    cur = conn.cursor()

    try:
        sender = require_message_sender(cur, data.sender_user_id, data.sender_role)
        cur.execute(
            "SELECT user_id, name, email, role FROM users WHERE lower(email)=? AND role='user'",
            (recipient_email,),
        )
        recipient = cur.fetchone()
        if not recipient:
            raise HTTPException(status_code=404, detail="User with this email was not found")

        message_id = str(uuid.uuid4())
        created_at = datetime.now().isoformat()
        cur.execute(
            """
            INSERT INTO user_messages (
                message_id, recipient_user_id, recipient_email, sender_user_id,
                sender_name, title, message, created_at, is_read
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        """,
            (
                message_id,
                recipient["user_id"],
                recipient["email"],
                sender["user_id"],
                sender["name"],
                title,
                message,
                created_at,
            ),
        )
        conn.commit()
    except HTTPException:
        conn.close()
        raise

    conn.close()

    return {
        "message_id": message_id,
        "recipient_user_id": recipient["user_id"],
        "recipient_name": recipient["name"],
        "recipient_email": recipient["email"],
        "sender_name": sender["name"],
        "title": title,
        "message": message,
        "created_at": created_at,
    }


@router.get("/messages/sent")
def get_sent_messages(
    sender_user_id: str = Query(...),
    sender_role: str = Query(default="admin"),
    limit: int = Query(default=20, ge=1, le=100),
):
    normalized_role = (sender_role or "").strip().lower()
    if normalized_role not in MESSAGE_ENABLED_ROLES:
        raise HTTPException(status_code=403, detail="Only admins and workers can access sent messages")

    conn = get_connection()
    cur = conn.cursor()
    try:
        require_message_sender(cur, sender_user_id, normalized_role)
        cur.execute(
            """
            SELECT um.message_id, um.title, um.message, um.created_at, um.recipient_email,
                   u.name AS recipient_name
            FROM user_messages um
            LEFT JOIN users u ON um.recipient_user_id = u.user_id
            WHERE um.sender_user_id=?
            ORDER BY um.created_at DESC
            LIMIT ?
        """,
            (sender_user_id, limit),
        )
        rows = [dict(r) for r in cur.fetchall()]
    except HTTPException:
        conn.close()
        raise
    conn.close()
    return rows


@router.post("/worker/scan-fine")
def worker_scan_and_fine(data: WorkerScanFineRequest):
    worker_role = (data.worker_role or "worker").strip().lower()
    if worker_role != "worker":
        raise HTTPException(status_code=403, detail="Only workers can issue parking fines")

    plate_number = data.plate_number.strip().upper()
    if not plate_number:
        raise HTTPException(status_code=400, detail="Plate number is required")

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            "SELECT user_id, name, email, role FROM users WHERE user_id=? AND role='worker'",
            (data.worker_user_id,),
        )
        worker = cur.fetchone()
        if not worker:
            raise HTTPException(status_code=403, detail="Worker account not found")

        vehicle = VehicleRepository.get_by_plate_any(plate_number)
        if not vehicle:
            raise HTTPException(status_code=404, detail="Detected plate was not found in the registered vehicles list")

        vehicle_payload = dict(vehicle)
        owner_user_id = vehicle_payload.get("owner_user_id")
        if not owner_user_id:
            raise HTTPException(status_code=404, detail="This vehicle is not linked to a registered owner account")

        cur.execute(
            "SELECT user_id, name, email, role, created_at FROM users WHERE user_id=? AND role='user'",
            (owner_user_id,),
        )
        recipient = cur.fetchone()
        if not recipient:
            raise HTTPException(status_code=404, detail="The linked vehicle owner could not be found")

        requested_email = (data.recipient_email or "").strip().lower()
        if requested_email and recipient["email"].lower() != requested_email:
            raise HTTPException(status_code=400, detail="Recipient email does not match the detected vehicle owner")

        cur.execute(
            "SELECT * FROM parking_sessions WHERE plate_number=? ORDER BY entry_timestamp DESC",
            (plate_number,),
        )
        sessions = [SessionService.enrich_session_for_display(r) for r in cur.fetchall()]

        active_session = SessionRepository.get_active_by_plate(plate_number)
        owner_payload = {
            "user_id": recipient["user_id"],
            "name": recipient["name"],
            "email": recipient["email"],
            "role": recipient["role"],
            "created_at": recipient["created_at"],
        }

        if active_session:
            conn.close()
            return {
                "fine_issued": False,
                "status": "active_session_found",
                "message": f"Vehicle {plate_number} already has an active parking session. No fine was issued.",
                "plate_number": plate_number,
                "recipient_email": recipient["email"],
                "vehicle": vehicle_payload,
                "owner": owner_payload,
                "sessions": sessions[:10],
                "active_session": SessionService.enrich_session_for_display(active_session),
                "fine": None,
            }

        cur.execute(
            """
            SELECT fine_id, plate_number, recipient_user_id, recipient_email, worker_user_id,
                   worker_name, amount, reason, note, issued_at, status, related_message_id
            FROM worker_fines
            WHERE plate_number=? AND recipient_user_id=? AND status='unpaid'
            ORDER BY issued_at DESC
            LIMIT 1
        """,
            (plate_number, recipient["user_id"]),
        )
        existing_fine = cur.fetchone()
        if existing_fine:
            conn.close()
            return {
                "fine_issued": False,
                "status": "existing_unpaid_fine",
                "message": f"Vehicle {plate_number} already has an unpaid worker fine on record.",
                "plate_number": plate_number,
                "recipient_email": recipient["email"],
                "vehicle": vehicle_payload,
                "owner": owner_payload,
                "sessions": sessions[:10],
                "active_session": None,
                "fine": dict(existing_fine),
            }

        fine_id = str(uuid.uuid4())
        issued_at = datetime.now().isoformat()
        note = (data.note or "").strip()
        reason = "Vehicle was scanned by a parking worker without an active parking session"

        cur.execute(
            """
            INSERT INTO worker_fines (
                fine_id, plate_number, recipient_user_id, recipient_email,
                worker_user_id, worker_name, amount, reason, note, issued_at,
                status, related_message_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', NULL)
        """,
            (
                fine_id,
                plate_number,
                recipient["user_id"],
                recipient["email"],
                worker["user_id"],
                worker["name"],
                WORKER_FINE_AMOUNT,
                reason,
                note,
                issued_at,
            ),
        )
        conn.commit()
    except HTTPException:
        conn.close()
        raise

    conn.close()

    return {
        "fine_issued": True,
        "status": "fine_issued",
        "message": f"A {WORKER_FINE_AMOUNT:,} HUF fine was automatically assigned to {recipient['email']} for vehicle {plate_number}.",
        "fine": {
            "fine_id": fine_id,
            "plate_number": plate_number,
            "amount": WORKER_FINE_AMOUNT,
            "issued_at": issued_at,
            "status": "unpaid",
            "reason": reason,
            "note": note,
            "recipient_email": recipient["email"],
            "worker_name": worker["name"],
            "related_message_id": None,
        },
        "vehicle": vehicle_payload,
        "owner": owner_payload,
        "sessions": sessions[:10],
        "active_session": None,
    }


@router.post("/worker/fines/notify")
def notify_user_about_worker_fine(data: WorkerFineNotifyRequest):
    worker_role = (data.worker_role or "worker").strip().lower()
    if worker_role != "worker":
        raise HTTPException(status_code=403, detail="Only workers can notify users about parking fines")

    fine_id = (data.fine_id or "").strip()
    if not fine_id:
        raise HTTPException(status_code=400, detail="Fine ID is required")

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            "SELECT user_id, name, email, role FROM users WHERE user_id=? AND role='worker'",
            (data.worker_user_id,),
        )
        worker = cur.fetchone()
        if not worker:
            raise HTTPException(status_code=403, detail="Worker account not found")

        cur.execute(
            """
            SELECT fine_id, plate_number, recipient_user_id, recipient_email, worker_user_id,
                   worker_name, amount, reason, note, issued_at, status, related_message_id
            FROM worker_fines
            WHERE fine_id=?
        """,
            (fine_id,),
        )
        fine = cur.fetchone()
        if not fine:
            raise HTTPException(status_code=404, detail="Worker fine not found")
        if fine["worker_user_id"] != worker["user_id"]:
            raise HTTPException(status_code=403, detail="You can only notify users about fines you issued")
        if fine["related_message_id"]:
            raise HTTPException(status_code=400, detail="A fine notice has already been sent for this fine")

        cur.execute(
            "SELECT user_id, name, email, role FROM users WHERE user_id=? AND role='user'",
            (fine["recipient_user_id"],),
        )
        recipient = cur.fetchone()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient user not found")

        message_id = str(uuid.uuid4())
        created_at = datetime.now().isoformat()
        default_message = (
            f"A parking worker inspected vehicle {fine['plate_number']} and confirmed there was no active parking session. "
            f"A {int(fine['amount'] or 0):,} HUF fine was issued on {fine['issued_at']}."
        )
        if fine["note"]:
            default_message += f" Worker note: {fine['note']}"
        custom_message = (data.custom_message or "").strip()
        message_text = f"{default_message}\n\n{custom_message}" if custom_message else default_message

        cur.execute(
            """
            INSERT INTO user_messages (
                message_id, recipient_user_id, recipient_email, sender_user_id,
                sender_name, title, message, created_at, is_read
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        """,
            (
                message_id,
                recipient["user_id"],
                recipient["email"],
                worker["user_id"],
                worker["name"],
                "Parking fine notice",
                message_text,
                created_at,
            ),
        )
        cur.execute(
            "UPDATE worker_fines SET related_message_id=? WHERE fine_id=?",
            (message_id, fine_id),
        )
        conn.commit()
    except HTTPException:
        conn.close()
        raise

    conn.close()

    return {
        "message": f"Fine notice sent to {recipient['email']}",
        "fine_id": fine_id,
        "message_id": message_id,
        "recipient_email": recipient["email"],
        "title": "Parking fine notice",
        "sent_at": created_at,
    }


@router.get("/worker/fines")
def list_worker_fines(
    user_id: str = Query(...),
    role: str = Query(default="worker"),
    limit: int = Query(default=50, ge=1, le=200),
):
    normalized_role = (role or "worker").strip().lower()
    conn = get_connection()
    cur = conn.cursor()

    if normalized_role == "worker":
        cur.execute("SELECT user_id FROM users WHERE user_id=? AND role='worker'", (user_id,))
        sender = cur.fetchone()
        if not sender:
            conn.close()
            raise HTTPException(status_code=403, detail="Worker account not found")
        cur.execute(
            """
            SELECT fine_id, plate_number, recipient_email, worker_name, amount, reason, note, issued_at, status
            FROM worker_fines
            WHERE worker_user_id=?
            ORDER BY issued_at DESC
            LIMIT ?
        """,
            (user_id, limit),
        )
    elif normalized_role == "user":
        cur.execute("SELECT user_id FROM users WHERE user_id=?", (user_id,))
        recipient = cur.fetchone()
        if not recipient:
            conn.close()
            raise HTTPException(status_code=404, detail="User not found")
        cur.execute(
            """
            SELECT fine_id, plate_number, recipient_email, worker_name, amount, reason, note, issued_at, status
            FROM worker_fines
            WHERE recipient_user_id=?
            ORDER BY issued_at DESC
            LIMIT ?
        """,
            (user_id, limit),
        )
    else:
        conn.close()
        raise HTTPException(status_code=403, detail="Only workers or users can access worker fines")

    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows
