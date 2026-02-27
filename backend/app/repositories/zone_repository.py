from app.database import get_connection


class ZoneRepository:

    @staticmethod
    def list_all():
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM zones ORDER BY zone_id")
        rows = cur.fetchall()
        conn.close()
        return rows

    @staticmethod
    def get_by_id(zone_id: str):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM zones WHERE zone_id=?", (zone_id,))
        row = cur.fetchone()
        conn.close()
        return row

    @staticmethod
    def delete(zone_id: str):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM zones WHERE zone_id=?", (zone_id,))
        conn.commit()
        conn.close()

    @staticmethod
    def update(zone_id: str, zone):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE zones
            SET zone_name=?,
                base_hourly_rate=?,
                peak_start=?,
                peak_end=?,
                peak_multiplier=?,
                max_duration_minutes=?,
                overstay_multiplier=?
            WHERE zone_id=?
        """, (
            zone.zone_name,
            zone.base_hourly_rate,
            zone.peak_start,
            zone.peak_end,
            zone.peak_multiplier,
            zone.max_duration_minutes,
            zone.overstay_multiplier,
            zone_id
        ))
        conn.commit()
        conn.close()


    @staticmethod
    def create(zone):
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO zones
            (zone_id, zone_name, base_hourly_rate, peak_start, peak_end, peak_multiplier, max_duration_minutes, overstay_multiplier)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            zone.zone_id,
            zone.zone_name,
            zone.base_hourly_rate,
            zone.peak_start,
            zone.peak_end,
            zone.peak_multiplier,
            zone.max_duration_minutes,
            zone.overstay_multiplier
        ))
        conn.commit()
        conn.close()