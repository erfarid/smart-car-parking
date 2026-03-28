from __future__ import annotations

from datetime import datetime, timedelta


class FeeCalculationService:
    GRACE_PERIOD_MINUTES = 10
    MINIMUM_FEE = 50

    @staticmethod
    def _parse_minutes(hhmm: str) -> int:
        hour, minute = hhmm.split(":")
        return int(hour) * 60 + int(minute)

    @staticmethod
    def _is_peak(zone, current_dt: datetime) -> bool:
        peak_start = FeeCalculationService._parse_minutes(zone["peak_start"])
        peak_end = FeeCalculationService._parse_minutes(zone["peak_end"])
        minute_of_day = current_dt.hour * 60 + current_dt.minute
        return peak_start <= minute_of_day < peak_end

    @staticmethod
    def calculate(zone, duration_minutes, repeat_count, entry_timestamp: str | None = None):
        duration_minutes = max(0, int(duration_minutes or 0))
        base_rate_per_minute = float(zone["base_hourly_rate"]) / 60.0
        max_duration = int(zone["max_duration_minutes"])
        peak_multiplier = min(float(zone["peak_multiplier"]), 1.3)
        overstay_multiplier = float(zone["overstay_multiplier"])

        if duration_minutes <= FeeCalculationService.GRACE_PERIOD_MINUTES:
            base_fee = FeeCalculationService.MINIMUM_FEE
            overstay_penalty = 0
        else:
            entry_dt = datetime.fromisoformat(entry_timestamp) if entry_timestamp else datetime.now()
            normal_charge = 0.0
            actual_charge = 0.0

            for minute_offset in range(FeeCalculationService.GRACE_PERIOD_MINUTES, duration_minutes):
                current_dt = entry_dt + timedelta(minutes=minute_offset)
                minute_rate = base_rate_per_minute
                if FeeCalculationService._is_peak(zone, current_dt):
                    minute_rate *= peak_multiplier

                normal_charge += minute_rate
                if minute_offset >= max_duration:
                    actual_charge += minute_rate * overstay_multiplier
                else:
                    actual_charge += minute_rate

            base_fee = max(FeeCalculationService.MINIMUM_FEE, int(round(normal_charge)))
            overstay_penalty = max(0, int(round(actual_charge - normal_charge)))

        repeat_penalty = int(round(base_fee * 0.2 * max(0, int(repeat_count or 0))))
        final_fee = base_fee + overstay_penalty + repeat_penalty

        return {
            "base_fee": base_fee,
            "overstay_penalty": overstay_penalty,
            "repeat_penalty": repeat_penalty,
            "final_fee": final_fee,
        }
