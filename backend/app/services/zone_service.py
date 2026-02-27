from app.repositories.zone_repository import ZoneRepository


class ZoneService:
    """
    Business layer for zones.
    Keeps controllers clean and delegates DB calls to the repository.
    """

    @staticmethod
    def list_zones():
        return ZoneRepository.list_all()

    @staticmethod
    def get_zone(zone_id: str):
        zone = ZoneRepository.get_by_id(zone_id)
        if not zone:
            raise ValueError("Zone not found")
        return zone

    @staticmethod
    def create_zone(zone):
        # Basic validation (you can extend later)
        if zone.base_hourly_rate <= 0:
            raise ValueError("base_hourly_rate must be > 0")
        if zone.peak_multiplier < 1.0:
            raise ValueError("peak_multiplier must be >= 1.0")
        if zone.max_duration_minutes <= 0:
            raise ValueError("max_duration_minutes must be > 0")
        if zone.overstay_multiplier < 1.0:
            raise ValueError("overstay_multiplier must be >= 1.0")

        ZoneRepository.create(zone)

    @staticmethod
    def delete_zone(zone_id: str):
        zone = ZoneRepository.get_by_id(zone_id)
        if not zone:
            raise ValueError("Zone not found")
        ZoneRepository.delete(zone_id)

    @staticmethod
    def update_zone(zone_id: str, zone):
        existing = ZoneRepository.get_by_id(zone_id)
        if not existing:
            raise ValueError("Zone not found")

        ZoneRepository.update(zone_id, zone)