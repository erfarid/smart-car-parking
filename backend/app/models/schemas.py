import re
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")
ALLOWED_ROLES = {"user", "admin", "worker"}


class _BaseSchema(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class ZoneCreate(_BaseSchema):
    zone_id: str = Field(min_length=1)
    zone_name: str = Field(min_length=1)
    base_hourly_rate: int = Field(gt=0)
    peak_start: str
    peak_end: str
    peak_multiplier: float = Field(ge=1.0, le=1.3)
    max_duration_minutes: int = Field(default=1440, gt=0, le=1440)
    overstay_multiplier: float = Field(default=2.0, ge=1.0)

    @field_validator("peak_start", "peak_end")
    @classmethod
    def validate_time_format(cls, value: str) -> str:
        if not TIME_PATTERN.fullmatch(value):
            raise ValueError("time must be in HH:MM 24-hour format")
        return value

    @model_validator(mode="after")
    def validate_peak_window(self):
        start = int(self.peak_start[:2]) * 60 + int(self.peak_start[3:])
        end = int(self.peak_end[:2]) * 60 + int(self.peak_end[3:])
        if start >= end:
            raise ValueError("peak_start must be earlier than peak_end")
        return self


class SessionCreate(_BaseSchema):
    plate_number: str = Field(min_length=1)
    zone_id: str = Field(min_length=1)
    entry_timestamp: Optional[str] = None
    user_id: Optional[str] = None
    user_role: str = "user"

    @field_validator("plate_number")
    @classmethod
    def normalize_plate(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("plate_number is required")
        return normalized

    @field_validator("entry_timestamp", "user_id", mode="before")
    @classmethod
    def empty_strings_to_none(cls, value):
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("user_role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_ROLES:
            raise ValueError("user_role must be 'user', 'admin', or 'worker'")
        return normalized


class SessionClose(_BaseSchema):
    exit_timestamp: Optional[str] = None
    user_id: Optional[str] = None
    user_role: str = "user"

    @field_validator("exit_timestamp", "user_id", mode="before")
    @classmethod
    def empty_strings_to_none(cls, value):
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("user_role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_ROLES:
            raise ValueError("user_role must be 'user', 'admin', or 'worker'")
        return normalized


class PaymentRequest(_BaseSchema):
    session_ids: List[str] = Field(min_length=1)

    @field_validator("session_ids")
    @classmethod
    def normalize_session_ids(cls, value: List[str]) -> List[str]:
        normalized: List[str] = []
        for raw_id in value:
            cleaned = raw_id.strip()
            if not cleaned:
                raise ValueError("session_ids cannot contain empty values")
            if cleaned not in normalized:
                normalized.append(cleaned)
        if not normalized:
            raise ValueError("session_ids cannot be empty")
        return normalized


class PaymentByPlateRequest(_BaseSchema):
    plate_number: str = Field(min_length=1)

    @field_validator("plate_number")
    @classmethod
    def normalize_plate(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("plate_number is required")
        return normalized
