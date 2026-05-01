from datetime import datetime, timedelta

from app.repositories.session_repository import SessionRepository


def test_staff_messages_worker_fines_and_listing(client, seed_data):
    admin = seed_data["user"](name="Admin", email="admin-msg@example.com", role="admin")
    worker = seed_data["user"](name="Worker", email="worker-msg@example.com", role="worker")
    user = seed_data["user"](name="User", email="user-msg@example.com", role="user")
    seed_data["vehicle"]("MSG-111", owner_name="User", owner_user_id=user["user_id"])

    invalid_sender = client.post(
        "/auth/messages/send",
        json={
            "sender_user_id": user["user_id"],
            "sender_role": "user",
            "recipient_email": user["email"],
            "message": "Hello",
        },
    )
    assert invalid_sender.status_code == 403

    sent = client.post(
        "/auth/messages/send",
        json={
            "sender_user_id": admin["user_id"],
            "sender_role": "admin",
            "recipient_email": user["email"],
            "title": "Reminder",
            "message": "Please pay soon",
        },
    )
    assert sent.status_code == 200
    assert sent.json()["recipient_email"] == user["email"]

    sent_messages = client.get(f"/auth/messages/sent?sender_user_id={admin['user_id']}&sender_role=admin")
    assert sent_messages.status_code == 200
    assert sent_messages.json()[0]["recipient_email"] == user["email"]
    forbidden_sent = client.get(f"/auth/messages/sent?sender_user_id={user['user_id']}&sender_role=user")
    assert forbidden_sent.status_code == 403

    no_worker_account = client.post(
        "/auth/worker/scan-fine",
        json={"worker_user_id": admin["user_id"], "worker_role": "worker", "plate_number": "MSG-111"},
    )
    assert no_worker_account.status_code == 403

    seed_data["session"](
        session_id="msg-active",
        plate_number="MSG-111",
        zone_id="D01",
        entry_timestamp=(datetime.now() - timedelta(minutes=10)).isoformat(),
        status="active",
        user_id=user["user_id"],
    )
    active_result = client.post(
        "/auth/worker/scan-fine",
        json={"worker_user_id": worker["user_id"], "worker_role": "worker", "plate_number": "MSG-111"},
    )
    assert active_result.status_code == 200
    assert active_result.json()["status"] == "active_session_found"

    seed_data["session"](
        session_id="msg-old",
        plate_number="MSG-111",
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
    SessionRepository.close_session(
        "msg-active",
        exit_timestamp=datetime.now().isoformat(),
        duration_minutes=10,
        base_fee=50,
        overstay_penalty=0,
        repeat_count=0,
        repeat_penalty=0,
        final_fee=50,
        status="paid",
    )

    bad_email = client.post(
        "/auth/worker/scan-fine",
        json={
            "worker_user_id": worker["user_id"],
            "worker_role": "worker",
            "plate_number": "MSG-111",
            "recipient_email": "wrong@example.com",
        },
    )
    assert bad_email.status_code == 400

    fine_result = client.post(
        "/auth/worker/scan-fine",
        json={
            "worker_user_id": worker["user_id"],
            "worker_role": "worker",
            "plate_number": "MSG-111",
            "recipient_email": user["email"],
            "note": "Parked without payment",
        },
    )
    assert fine_result.status_code == 200
    fine_id = fine_result.json()["fine"]["fine_id"]
    assert fine_result.json()["fine_issued"] is True

    duplicate_fine = client.post(
        "/auth/worker/scan-fine",
        json={"worker_user_id": worker["user_id"], "worker_role": "worker", "plate_number": "MSG-111"},
    )
    assert duplicate_fine.status_code == 200
    assert duplicate_fine.json()["status"] == "existing_unpaid_fine"

    notify_forbidden_role = client.post(
        "/auth/worker/fines/notify",
        json={"worker_user_id": worker["user_id"], "worker_role": "admin", "fine_id": fine_id},
    )
    assert notify_forbidden_role.status_code == 403

    notified = client.post(
        "/auth/worker/fines/notify",
        json={
            "worker_user_id": worker["user_id"],
            "worker_role": "worker",
            "fine_id": fine_id,
            "custom_message": "This is your final warning.",
        },
    )
    assert notified.status_code == 200
    assert notified.json()["fine_id"] == fine_id

    duplicate_notice = client.post(
        "/auth/worker/fines/notify",
        json={"worker_user_id": worker["user_id"], "worker_role": "worker", "fine_id": fine_id},
    )
    assert duplicate_notice.status_code == 400

    worker_fines = client.get(f"/auth/worker/fines?user_id={worker['user_id']}&role=worker")
    assert worker_fines.status_code == 200
    assert worker_fines.json()[0]["plate_number"] == "MSG-111"

    user_fines = client.get(f"/auth/worker/fines?user_id={user['user_id']}&role=user")
    assert user_fines.status_code == 200
    assert user_fines.json()[0]["recipient_email"] == user["email"]

    assert client.get("/auth/worker/fines?user_id=missing&role=user").status_code == 404
    assert client.get(f"/auth/worker/fines?user_id={admin['user_id']}&role=admin").status_code == 403
