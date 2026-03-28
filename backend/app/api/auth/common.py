import hashlib

from fastapi import HTTPException
from pydantic import BaseModel

ADMIN_SECRET_CODE = "ADMIN-HU-2026"
WORKER_SECRET_CODE = "WORKER-HU-2026"
WORKER_FINE_AMOUNT = 10000
ALLOWED_REGISTER_ROLES = {"user", "admin", "worker"}
MESSAGE_ENABLED_ROLES = {"admin", "worker"}


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "user"
    authorization_code: str = ""
    admin_code: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class StaffSendMessageRequest(BaseModel):
    sender_user_id: str
    sender_role: str = "admin"
    recipient_email: str
    title: str = "System message"
    message: str


class WorkerScanFineRequest(BaseModel):
    worker_user_id: str
    worker_role: str = "worker"
    plate_number: str
    recipient_email: str = ""
    note: str = ""


class WorkerFineNotifyRequest(BaseModel):
    worker_user_id: str
    worker_role: str = "worker"
    fine_id: str
    custom_message: str = ""


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def normalize_role(value: str | None, default: str = "user") -> str:
    role = (value or default).strip().lower()
    if role not in ALLOWED_REGISTER_ROLES:
        raise HTTPException(status_code=400, detail="Role must be user, admin, or worker")
    return role


def count_active_sessions(cur) -> int:
    cur.execute("SELECT COUNT(*) FROM parking_sessions WHERE status='active'")
    return int(cur.fetchone()[0])


def count_workers(cur) -> int:
    cur.execute("SELECT COUNT(*) FROM users WHERE role='worker'")
    return int(cur.fetchone()[0])


def ensure_worker_capacity(cur, additional_workers: int = 1):
    active_sessions = count_active_sessions(cur)
    current_workers = count_workers(cur)
    projected_workers = current_workers + additional_workers
    if projected_workers > active_sessions:
        raise HTTPException(
            status_code=400,
            detail=(
                "Worker registration limit reached. "
                f"Workers ({projected_workers}) cannot exceed active sessions ({active_sessions})."
            ),
        )


def require_message_sender(cur, sender_user_id: str, sender_role: str):
    normalized_role = (sender_role or "").strip().lower()
    if normalized_role not in MESSAGE_ENABLED_ROLES:
        raise HTTPException(status_code=403, detail="Only admins and workers can send messages")

    cur.execute(
        "SELECT user_id, name, email, role FROM users WHERE user_id=?",
        (sender_user_id,),
    )
    sender = cur.fetchone()
    if not sender or sender["role"] != normalized_role:
        raise HTTPException(status_code=403, detail="Sender account not found for this role")
    return sender
