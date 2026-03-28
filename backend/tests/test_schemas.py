import pytest
from pydantic import ValidationError

from app.models.schemas import (
    PaymentByPlateRequest,
    PaymentRequest,
    SessionClose,
    SessionCreate,
    ZoneCreate,
)


def test_zone_create_happy_path_normalizes_and_uses_defaults():
    zone = ZoneCreate(
        zone_id="  A1  ",
        zone_name="  Inner City  ",
        base_hourly_rate=450,
        peak_start="08:00",
        peak_end="18:00",
        peak_multiplier=1.3,
    )

    assert zone.zone_id == "A1"
    assert zone.zone_name == "Inner City"
    assert zone.max_duration_minutes == 1440
    assert zone.overstay_multiplier == 2.0


@pytest.mark.parametrize("bad_time", ["8:00", "24:00", "ab:cd", "12:60"])
def test_zone_create_rejects_invalid_time_format(bad_time):
    with pytest.raises(ValidationError) as exc:
        ZoneCreate(
            zone_id="A1",
            zone_name="Central",
            base_hourly_rate=300,
            peak_start=bad_time,
            peak_end="18:00",
            peak_multiplier=1.2,
        )

    assert "HH:MM" in str(exc.value)


def test_zone_create_rejects_invalid_peak_window_order():
    with pytest.raises(ValidationError) as exc:
        ZoneCreate(
            zone_id="A1",
            zone_name="Central",
            base_hourly_rate=300,
            peak_start="18:00",
            peak_end="08:00",
            peak_multiplier=1.2,
        )

    assert "peak_start must be earlier than peak_end" in str(exc.value)


@pytest.mark.parametrize(
    "field_name,payload",
    [
        ("base_hourly_rate", {"base_hourly_rate": 0}),
        ("peak_multiplier", {"peak_multiplier": 0.9}),
        ("peak_multiplier", {"peak_multiplier": 1.31}),
        ("max_duration_minutes", {"max_duration_minutes": 0}),
        ("overstay_multiplier", {"overstay_multiplier": 0.5}),
    ],
)
def test_zone_create_rejects_invalid_numeric_values(field_name, payload):
    base = {
        "zone_id": "A1",
        "zone_name": "Central",
        "base_hourly_rate": 300,
        "peak_start": "08:00",
        "peak_end": "18:00",
        "peak_multiplier": 1.2,
    }
    base.update(payload)

    with pytest.raises(ValidationError) as exc:
        ZoneCreate(**base)

    assert field_name in str(exc.value)


def test_zone_create_allows_edge_max_duration_of_one_day():
    zone = ZoneCreate(
        zone_id="A1",
        zone_name="Central",
        base_hourly_rate=300,
        peak_start="08:00",
        peak_end="18:00",
        peak_multiplier=1.2,
        max_duration_minutes=1440,
    )

    assert zone.max_duration_minutes == 1440


def test_session_create_happy_path_normalizes_plate_and_role():
    session = SessionCreate(
        plate_number="  abc-123  ",
        zone_id=" z1 ",
        user_role=" WORKER ",
        user_id=" user-1 ",
    )

    assert session.plate_number == "ABC-123"
    assert session.zone_id == "z1"
    assert session.user_role == "worker"
    assert session.user_id == "user-1"


def test_session_create_converts_blank_optional_fields_to_none_and_sets_default_role():
    session = SessionCreate(
        plate_number="xyz-999",
        zone_id="B2",
        entry_timestamp="   ",
        user_id="   ",
    )

    assert session.entry_timestamp is None
    assert session.user_id is None
    assert session.user_role == "user"


@pytest.mark.parametrize("role", ["manager", "", "superuser"])
def test_session_create_rejects_unknown_roles(role):
    with pytest.raises(ValidationError) as exc:
        SessionCreate(plate_number="ABC-123", zone_id="A1", user_role=role)

    assert "user_role" in str(exc.value)


def test_session_close_happy_path_and_blank_handling():
    close_request = SessionClose(exit_timestamp="  ", user_id="  ", user_role=" User ")

    assert close_request.exit_timestamp is None
    assert close_request.user_id is None
    assert close_request.user_role == "user"


@pytest.mark.parametrize("role", ["operator", "guest"])
def test_session_close_rejects_unknown_roles(role):
    with pytest.raises(ValidationError):
        SessionClose(user_role=role)


def test_payment_request_happy_path_trims_and_deduplicates_session_ids():
    request = PaymentRequest(session_ids=["  s1  ", "s2", "s1", "  s2  ", "s3"])

    assert request.session_ids == ["s1", "s2", "s3"]


@pytest.mark.parametrize("session_ids", [[], ["   "]])
def test_payment_request_rejects_empty_or_blank_values(session_ids):
    with pytest.raises(ValidationError) as exc:
        PaymentRequest(session_ids=session_ids)

    assert "session_ids" in str(exc.value)


def test_payment_by_plate_request_happy_path_normalizes_plate():
    request = PaymentByPlateRequest(plate_number="  xyz-777 ")

    assert request.plate_number == "XYZ-777"


def test_payment_by_plate_request_rejects_blank_plate():
    with pytest.raises(ValidationError) as exc:
        PaymentByPlateRequest(plate_number="   ")

    assert "plate_number" in str(exc.value)
