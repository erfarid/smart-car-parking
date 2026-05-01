from datetime import datetime

from app.repositories.session_repository import SessionRepository


def test_session_repository_full_lifecycle_and_queries(seed_data):
    user = seed_data["user"](email="driver@example.com")
    seed_data["vehicle"]("ABC-222", owner_user_id=user["user_id"])
    seed_data["vehicle"]("XYZ-333", owner_user_id=user["user_id"])

    SessionRepository.create("active-1", "ABC-222", "D01", datetime(2026, 1, 2, 9, 0).isoformat(), user["user_id"])
    active = SessionRepository.get_active("active-1")
    assert active["status"] == "active"
    assert SessionRepository.get_active_by_plate("ABC-222")["session_id"] == "active-1"

    seed_data["session"](
        session_id="unpaid-1",
        plate_number="ABC-222",
        zone_id="D01",
        entry_timestamp=datetime(2026, 1, 1, 9, 0).isoformat(),
        exit_timestamp=datetime(2026, 1, 1, 10, 0).isoformat(),
        duration_minutes=60,
        base_fee=500,
        overstay_penalty=0,
        repeat_count=0,
        repeat_penalty=0,
        final_fee=500,
        status="unpaid",
        user_id=user["user_id"],
    )
    seed_data["session"](
        session_id="overdue-1",
        plate_number="ABC-222",
        zone_id="D02",
        entry_timestamp=datetime(2025, 12, 31, 9, 0).isoformat(),
        exit_timestamp=datetime(2025, 12, 31, 11, 0).isoformat(),
        duration_minutes=120,
        base_fee=1000,
        overstay_penalty=0,
        repeat_count=1,
        repeat_penalty=200,
        final_fee=1200,
        status="overdue",
        user_id=user["user_id"],
    )
    seed_data["session"](
        session_id="paid-1",
        plate_number="XYZ-333",
        zone_id="D01",
        entry_timestamp=datetime(2025, 12, 30, 9, 0).isoformat(),
        exit_timestamp=datetime(2025, 12, 30, 10, 0).isoformat(),
        duration_minutes=60,
        base_fee=500,
        overstay_penalty=0,
        repeat_count=0,
        repeat_penalty=0,
        final_fee=500,
        status="paid",
        user_id=user["user_id"],
    )

    assert SessionRepository.count_previous_sessions("ABC-222") == 2
    unpaid_rows = SessionRepository.get_unpaid_by_plate("ABC-222")
    assert [row["session_id"] for row in unpaid_rows] == ["unpaid-1"]
    assert SessionRepository.get_total_unpaid_by_plate("ABC-222") == 1700

    assert SessionRepository.mark_paid(["unpaid-1"]) == 1
    assert SessionRepository.mark_paid(["missing-id"]) == 0
    assert SessionRepository.mark_all_paid_by_plate("ABC-222") == 1

    seed_data["session"](
        session_id="unpaid-2",
        plate_number="ABC-222",
        zone_id="D03",
        entry_timestamp=datetime(2025, 12, 29, 9, 0).isoformat(),
        exit_timestamp=datetime(2025, 12, 29, 11, 0).isoformat(),
        duration_minutes=120,
        base_fee=1000,
        overstay_penalty=0,
        repeat_count=1,
        repeat_penalty=200,
        final_fee=1200,
        status="unpaid",
        user_id=user["user_id"],
    )
    assert SessionRepository.apply_penalty_doubling("ABC-222") == 1
    assert SessionRepository.get_total_unpaid_by_plate("ABC-222") == 2400

    congestion = SessionRepository.get_congestion_by_zone()
    assert any(row["zone_id"] == "D01" and row["active_count"] >= 1 for row in congestion)

    SessionRepository.close_session(
        "active-1",
        exit_timestamp=datetime(2026, 1, 2, 10, 30).isoformat(),
        duration_minutes=90,
        base_fee=700,
        overstay_penalty=100,
        repeat_count=2,
        repeat_penalty=280,
        final_fee=1080,
        status="paid",
    )
    assert SessionRepository.get_active("active-1") is None
