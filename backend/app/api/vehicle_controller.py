from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.database import get_connection
from app.repositories.vehicle_repository import VehicleRepository
from app.services.session_service import SessionService

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def _normalize_plate(plate_number: str) -> str:
    return plate_number.strip().upper()


class VehicleCreate(BaseModel):
    plate_number: str
    owner_name: str
    vehicle_type: str = "car"
    registration_status: str = "active"
    owner_user_id: str = ""
    requestor_role: str = "user"


@router.get("/")
def list_vehicles(
    user_id: Optional[str] = Query(default=None),
    role: str = Query(default="user"),
):
    rows = VehicleRepository.list_all(None if role in {"admin", "worker"} else user_id)
    return [dict(r) for r in rows]


@router.get("/{plate_number}")
def get_vehicle(
    plate_number: str,
    user_id: Optional[str] = Query(default=None),
    role: str = Query(default="user"),
):
    normalized_plate = _normalize_plate(plate_number)
    row = VehicleRepository.get_by_plate_any(normalized_plate)
    if not row:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    vehicle = dict(row)
    if role not in {"admin", "worker"} and vehicle.get("owner_user_id") != user_id:
        raise HTTPException(status_code=404, detail="Vehicle not found for this account")
    return vehicle




@router.get("/{plate_number}/details")
def get_vehicle_details(
    plate_number: str,
    user_id: Optional[str] = Query(default=None),
    role: str = Query(default="user"),
):
    normalized_plate = _normalize_plate(plate_number)
    row = VehicleRepository.get_by_plate_any(normalized_plate)
    if not row:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    vehicle = dict(row)
    if role not in {"admin", "worker"} and vehicle.get("owner_user_id") != user_id:
        raise HTTPException(status_code=404, detail="Vehicle not found for this account")

    conn = get_connection()
    cur = conn.cursor()

    owner = None
    owner_user_id = vehicle.get("owner_user_id")
    if owner_user_id:
        cur.execute(
            "SELECT user_id, name, email, role, created_at FROM users WHERE user_id=?",
            (owner_user_id,),
        )
        owner_row = cur.fetchone()
        if owner_row:
            owner = dict(owner_row)

    cur.execute(
        "SELECT * FROM parking_sessions WHERE plate_number=? ORDER BY entry_timestamp DESC",
        (normalized_plate,),
    )
    sessions = [SessionService.enrich_session_for_display(r) for r in cur.fetchall()]

    cur.execute(
        """
        SELECT p.*, ps.plate_number, ps.zone_id, ps.duration_minutes
        FROM payments p
        JOIN parking_sessions ps ON p.session_id = ps.session_id
        WHERE ps.plate_number=?
        ORDER BY p.payment_timestamp DESC
        """,
        (normalized_plate,),
    )
    payments = [dict(r) for r in cur.fetchall()]
    conn.close()

    summary = {
        "total_sessions": len(sessions),
        "active_sessions": sum(1 for s in sessions if s.get("status") == "active"),
        "paid_sessions": sum(1 for s in sessions if s.get("status") == "paid"),
        "unpaid_sessions": sum(1 for s in sessions if s.get("status") == "unpaid"),
        "overdue_sessions": sum(1 for s in sessions if s.get("status") == "overdue"),
        "total_paid_amount": int(sum((s.get("final_fee") or 0) for s in sessions if s.get("status") == "paid")),
        "total_unpaid_amount": int(sum((s.get("final_fee") or 0) for s in sessions if s.get("status") in ("unpaid", "overdue"))),
        "active_estimated_amount": int(sum((s.get("estimated_final_fee") or 0) for s in sessions if s.get("status") == "active")),
        "payment_count": len(payments),
    }

    return {
        "vehicle": vehicle,
        "owner": owner,
        "summary": summary,
        "sessions": sessions,
        "payments": payments[:10],
    }

@router.post("/")
def create_vehicle(data: VehicleCreate):
    plate_number = _normalize_plate(data.plate_number)
    owner_user_id = data.owner_user_id.strip() or None
    requestor_role = (data.requestor_role or "user").strip().lower()

    if requestor_role != "admin" and not owner_user_id:
        raise HTTPException(status_code=400, detail="User ownership is required for self-registration")

    result = VehicleRepository.create_or_assign(
        plate_number=plate_number,
        owner_name=data.owner_name.strip(),
        vehicle_type=data.vehicle_type,
        registration_status=data.registration_status,
        owner_user_id=owner_user_id,
    )

    if not result["ok"]:
        if result["reason"] == "owned_by_another_user":
            raise HTTPException(status_code=409, detail="This vehicle is already linked to another user")
        raise HTTPException(status_code=409, detail="Vehicle already exists")

    message = "Vehicle registered" if result["action"] == "created" else "Vehicle linked to your account"
    return {"message": message, "plate_number": plate_number}


@router.delete("/{plate_number}")
def delete_vehicle(plate_number: str):
    deleted = VehicleRepository.delete(_normalize_plate(plate_number))
    if not deleted:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted"}
