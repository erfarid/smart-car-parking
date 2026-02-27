import uuid
from datetime import datetime

from app.repositories.session_repository import SessionRepository
from app.repositories.zone_repository import ZoneRepository
from app.repositories.vehicle_repository import VehicleRepository
from app.services.fee_calculation_service import FeeCalculationService


class SessionService:

    @staticmethod
    def create_session(data):
        session_id = str(uuid.uuid4())
        entry_ts = data.entry_timestamp or datetime.now().isoformat()

        zone = ZoneRepository.get_by_id(data.zone_id)
        if not zone:
            raise ValueError("Zone not found")

        if not VehicleRepository.exists(data.plate_number):
            raise ValueError("Vehicle not found (add it first)")

        SessionRepository.create(
            session_id=session_id,
            plate_number=data.plate_number,
            zone_id=data.zone_id,
            entry_timestamp=entry_ts
        )

        return {
            "session_id": session_id,
            "status": "active",
            "entry_timestamp": entry_ts
        }

    @staticmethod
    def close_session(session_id: str, data):
        session = SessionRepository.get_active(session_id)
        if not session:
            raise ValueError("Active session not found")

        entry_dt = datetime.fromisoformat(session["entry_timestamp"])
        exit_ts = data.exit_timestamp or datetime.now().isoformat()
        exit_dt = datetime.fromisoformat(exit_ts)

        duration = int((exit_dt - entry_dt).total_seconds() / 60)
        if duration < 0:
            raise ValueError("Exit time is before entry time")

        zone = ZoneRepository.get_by_id(session["zone_id"])
        if not zone:
            raise ValueError("Zone not found for this session")

        repeat_count = SessionRepository.count_previous_sessions(session["plate_number"])

        fees = FeeCalculationService.calculate(zone, duration, repeat_count)

        # ✅ Use close_session() repository method (recommended)
        SessionRepository.close_session(
            session_id=session_id,
            exit_timestamp=exit_ts,
            duration_minutes=duration,
            base_fee=fees["base_fee"],
            overstay_penalty=fees["overstay_penalty"],
            repeat_count=repeat_count,
            repeat_penalty=fees["repeat_penalty"],
            final_fee=fees["final_fee"],
            status="unpaid",
        )

        return {
            "session_id": session_id,
            "plate_number": session["plate_number"],
            "zone_id": session["zone_id"],
            "duration_minutes": duration,
            "base_fee": fees["base_fee"],
            "overstay_penalty": fees["overstay_penalty"],
            "repeat_count": repeat_count,
            "repeat_penalty": fees["repeat_penalty"],
            "final_fee": fees["final_fee"],
            "status": "unpaid",
        }