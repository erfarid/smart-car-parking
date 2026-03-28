import uuid
from datetime import datetime

from app.database import get_connection
from app.repositories.session_repository import SessionRepository
from app.repositories.vehicle_repository import VehicleRepository
from app.repositories.zone_repository import ZoneRepository
from app.services.fee_calculation_service import FeeCalculationService


class SessionService:

    @staticmethod
    def _get_vehicle_for_session(plate_number: str, user_id: str | None, user_role: str):
        vehicle = VehicleRepository.get_by_plate_any(plate_number)
        if not vehicle:
            raise ValueError("Vehicle not found (add it first)")

        if user_role not in {"admin", "worker"} and vehicle["owner_user_id"] != user_id:
            raise ValueError("You can only use vehicles linked to your account")

        return vehicle

    @staticmethod
    def _calculate_quote(session, exit_timestamp: str | None = None):
        entry_dt = datetime.fromisoformat(session["entry_timestamp"])
        exit_ts = exit_timestamp or datetime.now().isoformat()
        exit_dt = datetime.fromisoformat(exit_ts)

        duration = int((exit_dt - entry_dt).total_seconds() / 60)
        if duration < 0:
            raise ValueError("Exit time is before entry time")

        zone = ZoneRepository.get_by_id(session["zone_id"])
        if not zone:
            raise ValueError("Zone not found for this session")

        repeat_count = SessionRepository.count_previous_sessions(session["plate_number"])
        fees = FeeCalculationService.calculate(zone, duration, repeat_count, session["entry_timestamp"])
        return {
            "duration_minutes": duration,
            "base_fee": fees["base_fee"],
            "overstay_penalty": fees["overstay_penalty"],
            "repeat_count": repeat_count,
            "repeat_penalty": fees["repeat_penalty"],
            "estimated_final_fee": fees["final_fee"],
            "quote_timestamp": exit_ts,
        }

    @staticmethod
    def quote_active_session(session_id: str, user_id: str | None = None, user_role: str = "user"):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM parking_sessions WHERE session_id=?", (session_id,))
        session = cur.fetchone()
        conn.close()

        if not session:
            raise ValueError("Session not found")
        if session["status"] != "active":
            raise ValueError("Only active sessions can be quoted")
        if user_role not in {"admin", "worker"} and session["user_id"] != user_id:
            raise ValueError("You can only access your own sessions")

        quote = SessionService._calculate_quote(session)
        return {
            "session_id": session["session_id"],
            "plate_number": session["plate_number"],
            "zone_id": session["zone_id"],
            **quote,
        }

    @staticmethod
    def enrich_session_for_display(session):
        item = dict(session)
        if item.get("status") == "active":
            item.update(SessionService._calculate_quote(item))
        return item

    @staticmethod
    def create_session(data):
        session_id = str(uuid.uuid4())
        entry_ts = data.entry_timestamp or datetime.now().isoformat()
        plate_number = data.plate_number.strip().upper()
        user_id = getattr(data, "user_id", None) or None
        user_role = (getattr(data, "user_role", "user") or "user").strip().lower()

        if user_role == "admin":
            raise ValueError("Admin cannot start parking sessions directly")

        zone = ZoneRepository.get_by_id(data.zone_id)
        if not zone:
            raise ValueError("Zone not found")

        vehicle = SessionService._get_vehicle_for_session(plate_number, user_id, user_role)
        existing_active = SessionRepository.get_active_by_plate(plate_number)
        if existing_active:
            raise ValueError("This vehicle already has an active parking session")

        session_user_id = user_id if user_role not in {"admin", "worker"} else (vehicle["owner_user_id"] or None)

        SessionRepository.create(
            session_id=session_id,
            plate_number=plate_number,
            zone_id=data.zone_id,
            entry_timestamp=entry_ts,
            user_id=session_user_id,
        )

        return {
            "session_id": session_id,
            "plate_number": plate_number,
            "status": "active",
            "entry_timestamp": entry_ts,
            "user_id": session_user_id,
        }

    @staticmethod
    def finalize_session(session_id: str, exit_timestamp: str | None = None, final_status: str = "unpaid"):
        session = SessionRepository.get_active(session_id)
        if not session:
            raise ValueError("Active session not found")

        quote = SessionService._calculate_quote(session, exit_timestamp)
        exit_ts = quote["quote_timestamp"]

        SessionRepository.close_session(
            session_id=session_id,
            exit_timestamp=exit_ts,
            duration_minutes=quote["duration_minutes"],
            base_fee=quote["base_fee"],
            overstay_penalty=quote["overstay_penalty"],
            repeat_count=quote["repeat_count"],
            repeat_penalty=quote["repeat_penalty"],
            final_fee=quote["estimated_final_fee"],
            status=final_status,
        )

        return {
            "session_id": session_id,
            "user_id": session["user_id"],
            "plate_number": session["plate_number"],
            "zone_id": session["zone_id"],
            "duration_minutes": quote["duration_minutes"],
            "base_fee": quote["base_fee"],
            "overstay_penalty": quote["overstay_penalty"],
            "repeat_count": quote["repeat_count"],
            "repeat_penalty": quote["repeat_penalty"],
            "final_fee": quote["estimated_final_fee"],
            "status": final_status,
            "exit_timestamp": exit_ts,
        }

    @staticmethod
    def close_session(session_id: str, data):
        user_role = (getattr(data, "user_role", "user") or "user").strip().lower()
        if user_role != "admin":
            raise ValueError("Only admin can end a session directly")
        return SessionService.finalize_session(session_id, getattr(data, "exit_timestamp", None), "unpaid")
