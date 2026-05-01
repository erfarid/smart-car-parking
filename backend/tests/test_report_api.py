def test_report_endpoints(client, seed_data):
    user = seed_data["user"](email="report-api@example.com")
    seed_data["vehicle"]("RPT-111", owner_user_id=user["user_id"])
    seed_data["session"](
        session_id="rpt-paid",
        plate_number="RPT-111",
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

    revenue_by_zone = client.get("/reports/revenue-by-zone")
    assert revenue_by_zone.status_code == 200
    revenue_summary = client.get("/reports/revenue-summary")
    assert revenue_summary.status_code == 200
    assert revenue_summary.json()["paid_count"] >= 1
