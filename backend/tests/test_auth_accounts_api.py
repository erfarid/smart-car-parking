from datetime import datetime, timedelta

def test_auth_register_login_users_and_summary(client, seed_data):
    bad_admin = client.post(
        "/auth/register",
        json={
            "name": "Bad Admin",
            "email": "bad-admin@example.com",
            "password": "secret",
            "role": "admin",
            "authorization_code": "wrong",
        },
    )
    assert bad_admin.status_code == 403

    user_register = client.post(
        "/auth/register",
        json={
            "name": "Alice",
            "email": "alice@example.com",
            "password": "secret123",
            "role": "user",
        },
    )
    assert user_register.status_code == 200
    user_payload = user_register.json()
    assert user_payload["email"] == "alice@example.com"

    admin_register = client.post(
        "/auth/register",
        json={
            "name": "Chief",
            "email": "chief@example.com",
            "password": "adminpw",
            "role": "admin",
            "authorization_code": "ADMIN-HU-2026",
        },
    )
    assert admin_register.status_code == 200

    active_user = seed_data["user"](name="Active Owner", email="active-owner@example.com")
    seed_data["vehicle"]("CAP-100", owner_user_id=active_user["user_id"])
    seed_data["session"](
        session_id="active-cap",
        plate_number="CAP-100",
        zone_id="D01",
        entry_timestamp=(datetime.now() - timedelta(minutes=20)).isoformat(),
        status="active",
        user_id=active_user["user_id"],
    )

    worker_register = client.post(
        "/auth/register",
        json={
            "name": "Worker Bee",
            "email": "worker@example.com",
            "password": "workpw",
            "role": "worker",
            "authorization_code": "WORKER-HU-2026",
        },
    )
    assert worker_register.status_code == 200
    worker_payload = worker_register.json()

    over_capacity_worker = client.post(
        "/auth/register",
        json={
            "name": "Worker Bee 2",
            "email": "worker2@example.com",
            "password": "workpw",
            "role": "worker",
            "authorization_code": "WORKER-HU-2026",
        },
    )
    assert over_capacity_worker.status_code == 400

    login = client.post("/auth/login", json={"email": "alice@example.com", "password": "secret123"})
    assert login.status_code == 200
    assert client.post("/auth/login", json={"email": "alice@example.com", "password": "bad"}).status_code == 401

    duplicate = client.post(
        "/auth/register",
        json={
            "name": "Alice 2",
            "email": "alice@example.com",
            "password": "secret123",
            "role": "user",
        },
    )
    assert duplicate.status_code == 409

    users = client.get("/auth/users")
    assert users.status_code == 200
    assert all(row["role"] == "user" for row in users.json())

    seed_data["vehicle"]("ALI-123", owner_user_id=user_payload["user_id"], owner_name="Alice")
    seed_data["session"](
        session_id="alice-unpaid",
        plate_number="ALI-123",
        zone_id="D01",
        entry_timestamp="2026-01-01T09:00:00",
        exit_timestamp="2026-01-01T10:00:00",
        duration_minutes=60,
        base_fee=500,
        overstay_penalty=0,
        repeat_count=0,
        repeat_penalty=0,
        final_fee=500,
        status="unpaid",
        user_id=user_payload["user_id"],
    )
    seed_data["message"](recipient_user_id=user_payload["user_id"], recipient_email=user_payload["email"], 
                         sender_name="Chief", title="Hi", message="Welcome")
    seed_data["fine"](
        plate_number="ALI-123",
        recipient_user_id=user_payload["user_id"],
        recipient_email=user_payload["email"],
        worker_user_id=worker_payload["user_id"],
        worker_name="Worker Bee",
    )

    user_details = client.get(f"/auth/users/{user_payload['user_id']}")
    assert user_details.status_code == 200
    details_payload = user_details.json()
    assert details_payload["stats"]["total_unpaid"] == 500
    assert details_payload["stats"]["unpaid_worker_fines"] == 10000
    assert len(details_payload["received_messages"]) == 1
    assert client.get("/auth/users/missing-user").status_code == 404

    summary = client.get("/auth/users-summary")
    assert summary.status_code == 200
    assert any(item["user_id"] == user_payload["user_id"] for item in summary.json())
