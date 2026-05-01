from datetime import datetime

from app.services.fee_calculation_service import FeeCalculationService


def test_fee_calculation_helpers_and_paths():
    zone = {
        "base_hourly_rate": 600,
        "peak_start": "08:00",
        "peak_end": "10:00",
        "peak_multiplier": 1.5,
        "max_duration_minutes": 30,
        "overstay_multiplier": 2.0,
    }

    assert FeeCalculationService._parse_minutes("09:30") == 570
    assert FeeCalculationService._is_peak(zone, datetime(2026, 1, 1, 8, 30)) is True
    assert FeeCalculationService._is_peak(zone, datetime(2026, 1, 1, 10, 0)) is False

    grace = FeeCalculationService.calculate(zone, duration_minutes=5, repeat_count=0)
    assert grace == {
        "base_fee": FeeCalculationService.MINIMUM_FEE,
        "overstay_penalty": 0,
        "repeat_penalty": 0,
        "final_fee": FeeCalculationService.MINIMUM_FEE,
    }

    calculated = FeeCalculationService.calculate(
        zone,
        duration_minutes=50,
        repeat_count=2,
        entry_timestamp=datetime(2026, 1, 1, 8, 0).isoformat(),
    )
    assert calculated["base_fee"] >= 50
    assert calculated["overstay_penalty"] > 0
    assert calculated["repeat_penalty"] > 0
    assert calculated["final_fee"] == calculated["base_fee"] + calculated["overstay_penalty"] + calculated["repeat_penalty"]
