class FeeCalculationService:

    @staticmethod
    def calculate(zone, duration_minutes, repeat_count):

        base_rate = zone["base_hourly_rate"]
        max_duration = zone["max_duration_minutes"]
        overstay_multiplier = zone["overstay_multiplier"]

        hours = duration_minutes / 60.0
        base_fee = int(base_rate * hours)

        overstay_penalty = 0
        if duration_minutes > max_duration:
            overstay_penalty = int(base_fee * (overstay_multiplier - 1))

        repeat_penalty = int(base_fee * 0.2 * repeat_count)

        final_fee = base_fee + overstay_penalty + repeat_penalty

        return {
            "base_fee": base_fee,
            "overstay_penalty": overstay_penalty,
            "repeat_penalty": repeat_penalty,
            "final_fee": final_fee
        }