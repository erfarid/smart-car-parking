from typing import List, Optional

from fastapi import HTTPException
from pydantic import BaseModel

PENALTY_THRESHOLD = 200000
LEGAL_NOTICE_THRESHOLD = 50000


def normalize_plate(plate_number: str) -> str:
    return plate_number.strip().upper()


def ensure_session_access(session, user_id: Optional[str], user_role: str):
    if user_role == "admin":
        return
    if not user_id or session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only access your own sessions")


class PaySessionRequest(BaseModel):
    session_ids: List[str]
    user_id: Optional[str] = None
    cardholder_name: Optional[str] = None
    card_last_four: Optional[str] = None
    user_role: str = "user"


class PayAllRequest(BaseModel):
    plate_number: str
    user_id: Optional[str] = None
    cardholder_name: Optional[str] = None
    card_last_four: Optional[str] = None
    user_role: str = "user"


class CheckoutActiveRequest(BaseModel):
    session_id: str
    user_id: Optional[str] = None
    cardholder_name: Optional[str] = None
    card_last_four: Optional[str] = None
    user_role: str = "user"
