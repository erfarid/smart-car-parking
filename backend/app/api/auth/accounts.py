import uuid
from datetime import datetime

from fastapi import HTTPException

from app.database import get_connection
from app.services.session_service import SessionService

from .common import ADMIN_SECRET_CODE, WORKER_SECRET_CODE, LoginRequest, RegisterRequest, ensure_worker_capacity, hash_password, normalize_role
from .router import router


@router.post("/register")
def register(data: RegisterRequest):
    requested_role = normalize_role(getattr(data, "role", "user"), "user")
    auth_code = (getattr(data, "authorization_code", "") or getattr(data, "admin_code", "") or "").strip()

    if requested_role == "admin":
        if auth_code != ADMIN_SECRET_CODE:
            raise HTTPException(status_code=403, detail="Invalid admin code")
    elif requested_role == "worker":
        if auth_code != WORKER_SECRET_CODE:
            raise HTTPException(status_code=403, detail="Invalid worker code")

    pw_hash = hash_password(data.password)
    user_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    email = data.email.strip().lower()

    conn = get_connection()
    cur = conn.cursor()
    try:
        if requested_role == "worker":
            ensure_worker_capacity(cur, additional_workers=1)

        cur.execute(
            """
            INSERT INTO users (user_id, name, email, password, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (user_id, data.name.strip(), email, pw_hash, requested_role, now),
        )
        conn.commit()
    except HTTPException:
        conn.close()
        raise
    except Exception:
        conn.close()
        raise HTTPException(status_code=409, detail="Email already registered")
    conn.close()

    return {
        "user_id": user_id,
        "name": data.name.strip(),
        "email": email,
        "role": requested_role,
    }


@router.post("/login")
def login(data: LoginRequest):
    pw_hash = hash_password(data.password)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email=? AND password=?", (data.email.strip().lower(), pw_hash))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "user_id": row["user_id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
    }


@router.get("/users")
def list_users():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT user_id, name, email, role, created_at
        FROM users
        WHERE role = 'user'
        ORDER BY created_at DESC
    """
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/users/{user_id}")
def get_user(user_id: str):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_id, name, email, role, created_at FROM users WHERE user_id=?", (user_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    cur.execute(
        """
        SELECT * FROM vehicles WHERE owner_user_id=? ORDER BY plate_number
    """,
        (user_id,),
    )
    vehicles = [dict(r) for r in cur.fetchall()]

    cur.execute(
        """
        SELECT * FROM parking_sessions WHERE user_id=? ORDER BY entry_timestamp DESC
    """,
        (user_id,),
    )
    sessions = [SessionService.enrich_session_for_display(r) for r in cur.fetchall()]

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
    payments = [dict(r) for r in cur.fetchall()]

    cur.execute(
        """
        SELECT
            COUNT(*) as total_sessions,
            COALESCE(SUM(CASE WHEN status='paid' THEN final_fee ELSE 0 END), 0) as total_paid,
            COALESCE(SUM(CASE WHEN status IN ('unpaid','overdue') THEN final_fee ELSE 0 END), 0) as total_unpaid,
            COALESCE(SUM(CASE WHEN status='active' THEN 1 ELSE 0 END), 0) as active_sessions
        FROM parking_sessions WHERE user_id=?
    """,
        (user_id,),
    )
    stats = dict(cur.fetchone())

    cur.execute(
        """
        SELECT message_id, recipient_email, sender_name, title, message, created_at
        FROM user_messages
        WHERE recipient_user_id=?
        ORDER BY created_at DESC
        LIMIT 20
    """,
        (user_id,),
    )
    received_messages = [dict(r) for r in cur.fetchall()]

    cur.execute(
        """
        SELECT um.message_id, um.title, um.message, um.created_at, um.recipient_email,
               u.name AS recipient_name
        FROM user_messages um
        LEFT JOIN users u ON um.recipient_user_id = u.user_id
        WHERE um.sender_user_id=?
        ORDER BY um.created_at DESC
        LIMIT 20
    """,
        (user_id,),
    )
    sent_messages = [dict(r) for r in cur.fetchall()]

    cur.execute(
        """
        SELECT fine_id, plate_number, amount, reason, note, issued_at, status, worker_name, recipient_email
        FROM worker_fines
        WHERE recipient_user_id=?
        ORDER BY issued_at DESC
        LIMIT 20
    """,
        (user_id,),
    )
    fines = [dict(r) for r in cur.fetchall()]

    cur.execute(
        """
        SELECT COALESCE(SUM(amount), 0) AS total_worker_fines,
               COALESCE(SUM(CASE WHEN status='unpaid' THEN amount ELSE 0 END), 0) AS unpaid_worker_fines
        FROM worker_fines
        WHERE recipient_user_id=?
    """,
        (user_id,),
    )
    fine_stats = dict(cur.fetchone())

    conn.close()

    return {
        **dict(row),
        "vehicles": vehicles,
        "sessions": sessions,
        "payments": payments,
        "stats": {**stats, **fine_stats},
        "received_messages": received_messages,
        "sent_messages": sent_messages,
        "fines": fines,
    }


@router.get("/users-summary")
def users_summary():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            u.user_id, u.name, u.email, u.role, u.created_at,
            COUNT(ps.session_id) as total_sessions,
            COALESCE(SUM(CASE WHEN ps.status='paid' THEN ps.final_fee ELSE 0 END), 0) as total_paid,
            COALESCE(SUM(CASE WHEN ps.status IN ('unpaid','overdue') THEN ps.final_fee ELSE 0 END), 0) as total_unpaid,
            COALESCE(SUM(CASE WHEN ps.status='active' THEN 1 ELSE 0 END), 0) as active_sessions,
            COALESCE((
                SELECT SUM(wf.amount) FROM worker_fines wf WHERE wf.recipient_user_id = u.user_id AND wf.status='unpaid'
            ), 0) as unpaid_worker_fines
        FROM users u
        LEFT JOIN parking_sessions ps ON u.user_id = ps.user_id
        WHERE u.role = 'user'
        GROUP BY u.user_id
        ORDER BY total_unpaid DESC, unpaid_worker_fines DESC
    """
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows
