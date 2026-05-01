from datetime import datetime, timedelta

import pytest

from app.models.schemas import SessionClose, SessionCreate
from app.services.session_service import SessionService


def test_session_service_quote_create_finalize_close_and_enrich(seed_data):
    user = seed_data["user"](email="driver1@example.com")
    other = seed_data["user"](email="other1@example.com")
    worker = seed_data["user"](email="worker1@example.com", role="worker")
    seed_data["vehicle"]("AAA-111", owner_user_id=user["user_id"])
    seed_data["vehicle"]("BBB-222", owner_user_id=other["user_id"])

    with pytest.raises(ValueError, match="linked to your account"):
        SessionService._get_vehicle_for_session("BBB-222", user["user_id"], "user")
    assert SessionService._get_vehicle_for_session("AAA-111", None, "worker")["plate_number"] == "AAA-111"
    with pytest.raises(ValueError, match="Vehicle not found"):
        SessionService._get_vehicle_for_session("MISSING", user["user_id"], "user")

    active = seed_data["session"](
        session_id="svc-active",
        plate_number="AAA-111",
        zone_id="D01",
        entry_timestamp=(datetime.now() - timedelta(minutes=75)).isoformat(),
        status="active",
        user_id=user["user_id"],
    )

    quote = SessionService.quote_active_session("svc-active", user["user_id"], "user")
    assert quote["session_id"] == "svc-active"
    assert quote["estimated_final_fee"] >= 50

    with pytest.raises(ValueError, match="own sessions"):
        SessionService.quote_active_session("svc-active", other["user_id"], "user")

    closed_existing = seed_data["session"](
        session_id="svc-closed",
        plate_number="AAA-111",
        zone_id="D01",
        entry_timestamp=datetime(2026, 1, 1, 8, 0).isoformat(),
        exit_timestamp=datetime(2026, 1, 1, 9, 0).isoformat(),
        duration_minutes=60,
        base_fee=600,
        overstay_penalty=0,
        repeat_count=0,
        repeat_penalty=0,
        final_fee=600,
        status="paid",
        user_id=user["user_id"],
    )
    with pytest.raises(ValueError, match="Only active sessions"):
        SessionService.quote_active_session("svc-closed", user["user_id"], "user")
    with pytest.raises(ValueError, match="Session not found"):
        SessionService.quote_active_session("missing")

    enriched = SessionService.enrich_session_for_display(active)
    assert enriched["estimated_final_fee"] >= 50
    closed_enriched = SessionService.enrich_session_for_display(closed_existing)
    assert "estimated_final_fee" not in closed_enriched

    with pytest.raises(ValueError, match="Admin cannot start"):
        SessionService.create_session(SessionCreate(plate_number="AAA-111", zone_id="D01", user_id=user["user_id"], user_role="admin"))
    with pytest.raises(ValueError, match="Zone not found"):
        SessionService.create_session(SessionCreate(plate_number="AAA-111", zone_id="ZZZ", user_id=user["user_id"], user_role="user"))
    with pytest.raises(ValueError, match="linked to your account"):
        SessionService.create_session(SessionCreate(plate_number="BBB-222", zone_id="D01", user_id=user["user_id"], user_role="user"))
    with pytest.raises(ValueError, match="already has an active"):
        SessionService.create_session(SessionCreate(plate_number="AAA-111", zone_id="D01", user_id=user["user_id"], user_role="user"))

    seed_data["vehicle"]("CCC-333", owner_user_id=user["user_id"])
    created = SessionService.create_session(SessionCreate(plate_number="CCC-333", zone_id="D01", user_id=user["user_id"], user_role="user"))
    assert created["status"] == "active"
    worker_created = SessionService.create_session(SessionCreate(plate_number="BBB-222", zone_id="D02", user_id=worker["user_id"], user_role="worker"))
    assert worker_created["user_id"] == other["user_id"]

    finalized = SessionService.finalize_session("svc-active", final_status="paid")
    assert finalized["status"] == "paid"
    assert finalized["final_fee"] >= 50
    with pytest.raises(ValueError, match="Active session not found"):
        SessionService.finalize_session("svc-active")

    seed_data["session"](
        session_id="svc-close",
        plate_number="CCC-333",
        zone_id="D01",
        entry_timestamp=(datetime.now() - timedelta(minutes=30)).isoformat(),
        status="active",
        user_id=user["user_id"],
    )
    with pytest.raises(ValueError, match="Only admin"):
        SessionService.close_session("svc-close", SessionClose(user_role="user"))
    closed = SessionService.close_session("svc-close", SessionClose(user_role="admin", exit_timestamp=datetime.now().isoformat()))
    assert closed["status"] == "unpaid"

    with pytest.raises(ValueError, match="Exit time is before"):
        SessionService._calculate_quote(active, exit_timestamp=(datetime.now() - timedelta(days=5)).isoformat())
