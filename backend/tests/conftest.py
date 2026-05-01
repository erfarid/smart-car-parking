import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app import database  # noqa: E402
from app.api.auth.common import hash_password  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "test.db"
    monkeypatch.setattr(database, "DB_PATH", path)
    monkeypatch.setattr(database, "_initialized", False)
    monkeypatch.delenv("VERCEL", raising=False)
    yield path
    database._initialized = False


@pytest.fixture()
def conn(db_path):
    connection = database.get_connection()
    yield connection
    connection.close()
    database._initialized = False


@pytest.fixture()
def client(db_path):
    with TestClient(app) as test_client:
        yield test_client
    database._initialized = False


@pytest.fixture()
def seed_data(conn):
    def _create_user(name="User One", email=None, password="secret", role="user", user_id=None, created_at=None):
        user_id = user_id or str(uuid.uuid4())
        email = email or f"{user_id[:8]}@example.com"
        created_at = created_at or datetime(2026, 1, 1, 10, 0, 0).isoformat()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO users (user_id, name, email, password, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, name, email, hash_password(password), role, created_at),
        )
        conn.commit()
        return {
            "user_id": user_id,
            "name": name,
            "email": email,
            "password": password,
            "role": role,
            "created_at": created_at,
        }

    def _create_vehicle(plate_number="ABC-123", owner_name="Owner", vehicle_type="car", registration_status="active", owner_user_id=None):
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO vehicles (plate_number, owner_name, vehicle_type, registration_status, owner_user_id)
            VALUES (?, ?, ?, ?, ?)
            """,
            (plate_number, owner_name, vehicle_type, registration_status, owner_user_id),
        )
        conn.commit()
        return {
            "plate_number": plate_number,
            "owner_name": owner_name,
            "vehicle_type": vehicle_type,
            "registration_status": registration_status,
            "owner_user_id": owner_user_id,
        }

    def _create_zone(
        zone_id="T01",
        zone_name="Test Zone",
        base_hourly_rate=600,
        peak_start="08:00",
        peak_end="18:00",
        peak_multiplier=1.2,
        max_duration_minutes=1440,
        overstay_multiplier=1.5,
    ):
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO zones (zone_id, zone_name, base_hourly_rate, peak_start, peak_end, peak_multiplier, max_duration_minutes, overstay_multiplier)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (zone_id, zone_name, base_hourly_rate, peak_start, peak_end, peak_multiplier, max_duration_minutes, overstay_multiplier),
        )
        conn.commit()
        return {
            "zone_id": zone_id,
            "zone_name": zone_name,
            "base_hourly_rate": base_hourly_rate,
            "peak_start": peak_start,
            "peak_end": peak_end,
            "peak_multiplier": peak_multiplier,
            "max_duration_minutes": max_duration_minutes,
            "overstay_multiplier": overstay_multiplier,
        }

    def _create_session(
        session_id=None,
        plate_number="ABC-123",
        zone_id="D01",
        entry_timestamp=None,
        exit_timestamp=None,
        duration_minutes=None,
        base_fee=None,
        overstay_penalty=None,
        repeat_count=None,
        repeat_penalty=None,
        final_fee=None,
        status="active",
        user_id=None,
    ):
        session_id = session_id or str(uuid.uuid4())
        entry_timestamp = entry_timestamp or datetime(2026, 1, 2, 9, 0, 0).isoformat()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO parking_sessions (
                session_id, plate_number, zone_id, entry_timestamp, exit_timestamp,
                duration_minutes, base_fee, overstay_penalty, repeat_count,
                repeat_penalty, final_fee, status, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                plate_number,
                zone_id,
                entry_timestamp,
                exit_timestamp,
                duration_minutes,
                base_fee,
                overstay_penalty,
                repeat_count,
                repeat_penalty,
                final_fee,
                status,
                user_id,
            ),
        )
        conn.commit()
        return {
            "session_id": session_id,
            "plate_number": plate_number,
            "zone_id": zone_id,
            "entry_timestamp": entry_timestamp,
            "exit_timestamp": exit_timestamp,
            "duration_minutes": duration_minutes,
            "base_fee": base_fee,
            "overstay_penalty": overstay_penalty,
            "repeat_count": repeat_count,
            "repeat_penalty": repeat_penalty,
            "final_fee": final_fee,
            "status": status,
            "user_id": user_id,
        }

    def _create_payment(payment_id=None, user_id="", session_id="", amount=1000, cardholder_name="Tester", card_last_four="1234", payment_timestamp=None, status="success"):
        payment_id = payment_id or str(uuid.uuid4())
        payment_timestamp = payment_timestamp or datetime(2026, 1, 2, 12, 0, 0).isoformat()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO payments (payment_id, user_id, session_id, amount, cardholder_name, card_last_four, payment_timestamp, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (payment_id, user_id, session_id, amount, cardholder_name, card_last_four, payment_timestamp, status),
        )
        conn.commit()
        return {
            "payment_id": payment_id,
            "user_id": user_id,
            "session_id": session_id,
            "amount": amount,
            "cardholder_name": cardholder_name,
            "card_last_four": card_last_four,
            "payment_timestamp": payment_timestamp,
            "status": status,
        }

    def _create_message(message_id=None, recipient_user_id="", recipient_email="", sender_user_id=None, sender_name="Admin", title="System message", message="Hello", created_at=None, is_read=0):
        message_id = message_id or str(uuid.uuid4())
        created_at = created_at or datetime(2026, 1, 2, 14, 0, 0).isoformat()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO user_messages (message_id, recipient_user_id, recipient_email, sender_user_id, sender_name, title, message, created_at, is_read)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (message_id, recipient_user_id, recipient_email, sender_user_id, sender_name, title, message, created_at, is_read),
        )
        conn.commit()
        return {
            "message_id": message_id,
            "recipient_user_id": recipient_user_id,
            "recipient_email": recipient_email,
            "sender_user_id": sender_user_id,
            "sender_name": sender_name,
            "title": title,
            "message": message,
            "created_at": created_at,
            "is_read": is_read,
        }

    def _create_worker_fine(
        fine_id=None,
        plate_number="ABC-123",
        recipient_user_id="",
        recipient_email="",
        worker_user_id="",
        worker_name="Worker",
        amount=10000,
        reason="No active session",
        note="",
        issued_at=None,
        status="unpaid",
        related_message_id=None,
    ):
        fine_id = fine_id or str(uuid.uuid4())
        issued_at = issued_at or datetime(2026, 1, 2, 15, 0, 0).isoformat()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO worker_fines (
                fine_id, plate_number, recipient_user_id, recipient_email,
                worker_user_id, worker_name, amount, reason, note, issued_at,
                status, related_message_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                fine_id,
                plate_number,
                recipient_user_id,
                recipient_email,
                worker_user_id,
                worker_name,
                amount,
                reason,
                note,
                issued_at,
                status,
                related_message_id,
            ),
        )
        conn.commit()
        return {
            "fine_id": fine_id,
            "plate_number": plate_number,
            "recipient_user_id": recipient_user_id,
            "recipient_email": recipient_email,
            "worker_user_id": worker_user_id,
            "worker_name": worker_name,
            "amount": amount,
            "reason": reason,
            "note": note,
            "issued_at": issued_at,
            "status": status,
            "related_message_id": related_message_id,
        }

    def _past_iso(minutes=0, hours=0, days=0):
        return (datetime.now() - timedelta(days=days, hours=hours, minutes=minutes)).isoformat()

    return {
        "user": _create_user,
        "vehicle": _create_vehicle,
        "zone": _create_zone,
        "session": _create_session,
        "payment": _create_payment,
        "message": _create_message,
        "fine": _create_worker_fine,
        "past_iso": _past_iso,
    }
