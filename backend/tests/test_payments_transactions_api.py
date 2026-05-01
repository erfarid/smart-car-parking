from datetime import datetime, timedelta


def test_payment_transaction_endpoints(client, seed_data):
    user = seed_data["user"](name="Pay User", email="pay-user@example.com")
    other = seed_data["user"](name="Other User", email="pay-other@example.com")
    admin = seed_data["user"](name="Pay Admin", email="pay-admin@example.com", role="admin")
    seed_data["vehicle"]("PAY-111", owner_name="Pay User", owner_user_id=user["user_id"])
    seed_data["vehicle"]("PAY-222", owner_name="Other User", owner_user_id=other["user_id"])

    seed_data["session"](
        session_id="pay-unpaid-1",
        plate_number="PAY-111",
        zone_id="D01",
        entry_timestamp="2026-01-01T08:00:00",
        exit_timestamp="2026-01-01T09:00:00",
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
        session_id="pay-other",
        plate_number="PAY-222",
        zone_id="D01",
        entry_timestamp="2026-01-03T08:00:00",
        exit_timestamp="2026-01-03T09:00:00",
        duration_minutes=60,
        base_fee=500,
        overstay_penalty=0,
        repeat_count=0,
        repeat_penalty=0,
        final_fee=500,
        status="unpaid",
        user_id=other["user_id"],
    )
    seed_data["session"](
        session_id="pay-active",
        plate_number="PAY-111",
        zone_id="D03",
        entry_timestamp=(datetime.now() - timedelta(minutes=45)).isoformat(),
        status="active",
        user_id=user["user_id"],
    )

    assert client.post("/payments/pay", json={"session_ids": []}).status_code == 400

    unauthorized_pay = client.post(
        "/payments/pay",
        json={"session_ids": ["pay-other"], "user_id": user["user_id"], "user_role": "user"},
    )
    assert unauthorized_pay.status_code == 403

    pay = client.post(
        "/payments/pay",
        json={
            "session_ids": ["pay-unpaid-1", "missing-id"],
            "user_id": user["user_id"],
            "user_role": "user",
            "cardholder_name": "Pay User",
            "card_last_four": "4242",
        },
    )
    assert pay.status_code == 200
    assert pay.json()["total_paid"] == 500
    assert len(pay.json()["receipts"]) == 1

    checkout_forbidden = client.post(
        "/payments/checkout-active",
        json={"session_id": "pay-active", "user_id": other["user_id"], "user_role": "user"},
    )
    assert checkout_forbidden.status_code == 403

    checkout = client.post(
        "/payments/checkout-active",
        json={
            "session_id": "pay-active",
            "user_id": user["user_id"],
            "user_role": "user",
            "cardholder_name": "Pay User",
            "card_last_four": "1234",
        },
    )
    assert checkout.status_code == 200
    assert checkout.json()["closed_session"]["status"] == "paid"
    assert client.post("/payments/checkout-active", json={"session_id": "missing"}).status_code == 404

    history = client.get(f"/payments/history/{user['user_id']}")
    assert history.status_code == 200
    assert len(history.json()) >= 2

    unpaid_user = client.get(f"/payments/unpaid/PAY-111?user_id={user['user_id']}&role=user")
    assert unpaid_user.status_code == 200
    assert unpaid_user.json()["total_unpaid"] == 60000
    assert unpaid_user.json()["legal_warning"] is True

    unpaid_admin = client.get("/payments/unpaid/PAY-111?role=admin")
    assert unpaid_admin.status_code == 200
    assert unpaid_admin.json()["total_unpaid"] == 60000

    no_penalty = client.get(f"/payments/check-penalty/PAY-111?user_id={user['user_id']}&role=user")
    assert no_penalty.status_code == 200
    assert no_penalty.json()["penalty_applied"] is False

    no_unpaid = client.post(
        "/payments/pay-all",
        json={"plate_number": "PAY-999", "user_id": user["user_id"], "user_role": "user"},
    )
    assert no_unpaid.status_code == 200
    assert no_unpaid.json()["updated"] == 0

    pay_all = client.post(
        "/payments/pay-all",
        json={
            "plate_number": "PAY-111",
            "user_id": user["user_id"],
            "user_role": "user",
            "cardholder_name": "Pay User",
            "card_last_four": "9999",
        },
    )
    assert pay_all.status_code == 200
    assert pay_all.json()["updated"] == 1

    admin_pay_all = client.post(
        "/payments/pay-all",
        json={"plate_number": "PAY-222", "user_id": admin["user_id"], "user_role": "admin"},
    )
    assert admin_pay_all.status_code == 200
    assert admin_pay_all.json()["updated"] == 1
