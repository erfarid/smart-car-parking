from app.repositories.vehicle_repository import VehicleRepository


def test_vehicle_repository_create_assign_list_exists_and_delete(seed_data):
    owner = seed_data["user"](email="owner@example.com")

    created = VehicleRepository.create_or_assign("ABC-111", "Owner One", "car", "active", owner["user_id"])
    assert created == {"ok": True, "action": "created", "plate_number": "ABC-111"}
    assert VehicleRepository.exists("ABC-111") is True

    fetched_any = VehicleRepository.get_by_plate_any("ABC-111")
    assert fetched_any["owner_user_id"] == owner["user_id"]

    fetched_owned = VehicleRepository.get_by_plate("ABC-111", owner["user_id"])
    assert fetched_owned["plate_number"] == "ABC-111"
    assert VehicleRepository.get_by_plate("ABC-111", "wrong-user") is None

    owner_vehicles = VehicleRepository.list_all(owner["user_id"])
    assert len(owner_vehicles) == 1
    all_vehicles = VehicleRepository.list_all()
    assert any(v["plate_number"] == "ABC-111" for v in all_vehicles)

    reassigned = VehicleRepository.create_or_assign("ABC-111", "Owner One", "truck", "inactive", owner["user_id"])
    assert reassigned == {"ok": True, "action": "assigned", "plate_number": "ABC-111"}
    changed = VehicleRepository.get_by_plate_any("ABC-111")
    assert changed["vehicle_type"] == "truck"
    assert changed["registration_status"] == "inactive"

    assert VehicleRepository.create_or_assign("ABC-111", "X", "car", "active", None)["reason"] == "already_exists"

    another = seed_data["user"](email="other@example.com")
    conflict = VehicleRepository.create_or_assign("ABC-111", "X", "car", "active", another["user_id"])
    assert conflict == {"ok": False, "reason": "owned_by_another_user"}

    assert VehicleRepository.delete("ABC-111") is True
    assert VehicleRepository.delete("ABC-111") is False
