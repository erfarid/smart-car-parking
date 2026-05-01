from datetime import datetime, timedelta


def test_payment_notices_and_monitoring_endpoints(client, seed_data):
    user = seed_data["user"](name="Pay User", email="pay-user@example.com")
    worker = seed_data["user"](name="Pay Worker", email="pay-worker@example.com", role="worker")
    admin = seed_data["user"](name="Pay Admin", email="pay-admin@example.com", role="admin")
    seed_data["vehicle"]("PAY-111", owner_name="Pay User", owner_user_id=user["user_id"])

    seed_data["session"](
        session_id="pay-overdue-1",
        plate_number="PAY-111",
        zone_id="D02",
        entry_timestamp="2026-01-02T08:00:00",
        exit_timestamp="2026-01-02T10:00:00",
        duration_minutes=120,
        base_fee=1000,
        overstay_penalty=0,
        repeat_count=0,
        repeat_penalty=0,
        final_fee=60000,
        status="overdue",
        user_id=user["user_id"],
    )
    seed_data["session"](
        session_id="pay-active",
        plate_number="PAY-111",
        zone_id="D03",
        entry_timestamp=(datetime.now() - timedelta(minutes=45)).isoformat(),
        status="active",
        user_id=user["user_id"],
    )
    seed_data["message"](
        recipient_user_id=user["user_id"],
        recipient_email=user["email"],
        sender_user_id=admin["user_id"],
        sender_name=admin["name"],
        title="Billing reminder",
        message="Please check your balance",
    )
    seed_data["fine"](
        plate_number="PAY-111",
        recipient_user_id=user["user_id"],
        recipient_email=user["email"],
        worker_user_id=worker["user_id"],
        worker_name=worker["name"],
        amount=10000,
        reason="No session",
        note="Zone patrol",
    )
    seed_data["session"](
        session_id="pay-unpaid-big",
        plate_number="PAY-111",
        zone_id="D04",
        entry_timestamp="2026-01-04T08:00:00",
        exit_timestamp="2026-01-04T12:00:00",
        duration_minutes=240,
        base_fee=1000,
        overstay_penalty=0,
        repeat_count=0,
        repeat_penalty=0,
        final_fee=250000,
        status="unpaid",
        user_id=user["user_id"],
    )

    apply_penalty = client.get(f"/payments/check-penalty/PAY-111?user_id={user['user_id']}&role=user")
    assert apply_penalty.status_code == 200
    assert apply_penalty.json()["penalty_applied"] is True
    assert apply_penalty.json()["total_unpaid"] >= 300000

    notices_user = client.get(f"/payments/notices?user_id={user['user_id']}&role=user")
    assert notices_user.status_code == 200
    notice_ids = {item["notice_id"] for item in notices_user.json()}
    assert any(n.startswith("msg-") for n in notice_ids)
    assert any(n.startswith("worker-fine-") for n in notice_ids)
    assert any(n.startswith("due-") for n in notice_ids)

    notices_admin = client.get("/payments/notices?role=admin")
    assert notices_admin.status_code == 200
    assert len(notices_admin.json()) >= 1

    admin_records = client.get("/payments/admin-records")
    assert admin_records.status_code == 200
    assert any(record["plate_number"] == "PAY-111" for record in admin_records.json())

    congestion = client.get("/payments/congestion")
    assert congestion.status_code == 200
    assert any(row["zone_id"] == "D03" and row["congestion_level"] == "low" for row in congestion.json())
