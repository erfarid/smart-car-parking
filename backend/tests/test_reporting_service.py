from app.services.reporting_service import ReportingService


def test_reporting_service_filters_and_summaries(seed_data):
    user = seed_data["user"](email="report-user@example.com")
    other = seed_data["user"](email="report-other@example.com")
    seed_data["vehicle"]("REP-111", owner_user_id=user["user_id"])
    seed_data["vehicle"]("REP-222", owner_user_id=other["user_id"])

    seed_data["session"](
        session_id="report-paid",
        plate_number="REP-111",
        zone_id="D01",
        entry_timestamp="2026-01-01T09:00:00",
        exit_timestamp="2026-01-01T10:00:00",
        duration_minutes=60,
        base_fee=500,
        overstay_penalty=0,
        repeat_count=0,
        repeat_penalty=0,
        final_fee=500,
        status="paid",
        user_id=user["user_id"],
    )
    seed_data["session"](
        session_id="report-unpaid",
        plate_number="REP-111",
        zone_id="D02",
        entry_timestamp="2026-01-02T09:00:00",
        exit_timestamp="2026-01-02T11:00:00",
        duration_minutes=120,
        base_fee=1000,
        overstay_penalty=0,
        repeat_count=0,
        repeat_penalty=0,
        final_fee=1000,
        status="unpaid",
        user_id=user["user_id"],
    )
    seed_data["session"](
        session_id="report-overdue",
        plate_number="REP-222",
        zone_id="D02",
        entry_timestamp="2026-01-03T09:00:00",
        exit_timestamp="2026-01-03T11:00:00",
        duration_minutes=120,
        base_fee=1200,
        overstay_penalty=200,
        repeat_count=1,
        repeat_penalty=240,
        final_fee=1440,
        status="overdue",
        user_id=other["user_id"],
    )

    by_zone = ReportingService.revenue_by_zone()
    assert by_zone[0]["revenue"] >= by_zone[-1]["revenue"]

    summary = ReportingService.revenue_summary()
    assert summary == {
        "total_revenue": 2940,
        "paid_count": 1,
        "unpaid_count": 1,
        "overdue_count": 1,
    }

    user_rows = ReportingService.sessions_by_date_range("2026-01-01", "2026-01-03T23:59:59", user["user_id"], "user")
    assert len(user_rows) == 2
    admin_rows = ReportingService.sessions_by_date_range(None, None, None, "admin", "REP-222")
    assert len(admin_rows) == 1
    no_user_rows = ReportingService.sessions_by_date_range(None, None, None, "user")
    assert no_user_rows == []
