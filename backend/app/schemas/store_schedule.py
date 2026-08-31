from datetime import date, datetime, time
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


OnlineOrderMode = Literal["ALWAYS", "OPEN_ONLY"]
ExceptionOnlineOrderMode = Literal["ALWAYS", "OPEN_ONLY", "DISABLED"]
SchedulePeriodType = Literal["REGULAR", "SEASONAL"]
ScheduleExceptionMode = Literal["CLOSED", "SPECIAL_HOURS"]


class StoreScheduleIntervalInput(BaseModel):
    weekday: int = Field(..., ge=0, le=6)
    opens_at: time
    closes_at: time


class StoreSchedulePeriodInput(BaseModel):
    id: UUID | None = None
    period_type: SchedulePeriodType
    name: str = Field(..., min_length=1, max_length=120)
    valid_from: date | None = None
    valid_until: date | None = None
    recurs_annually: bool = True
    is_active: bool = True
    intervals: list[StoreScheduleIntervalInput] = Field(
        default_factory=list,
        max_length=28,
    )


class StoreScheduleExceptionIntervalInput(BaseModel):
    opens_at: time
    closes_at: time


class StoreScheduleExceptionInput(BaseModel):
    id: UUID | None = None
    start_date: date
    end_date: date
    mode: ScheduleExceptionMode
    label: str | None = Field(default=None, max_length=120)
    public_message: str | None = Field(default=None, max_length=500)
    online_order_override: ExceptionOnlineOrderMode | None = None
    intervals: list[StoreScheduleExceptionIntervalInput] = Field(
        default_factory=list,
        max_length=8,
    )


class StoreScheduleUpdate(BaseModel):
    timezone_name: str = Field(
        default="America/Argentina/Buenos_Aires",
        min_length=1,
        max_length=80,
    )
    online_order_mode: OnlineOrderMode = "ALWAYS"
    periods: list[StoreSchedulePeriodInput] = Field(
        default_factory=list,
        max_length=20,
    )
    exceptions: list[StoreScheduleExceptionInput] = Field(
        default_factory=list,
        max_length=200,
    )


class StoreScheduleIntervalResponse(StoreScheduleIntervalInput):
    id: UUID


class StoreSchedulePeriodResponse(BaseModel):
    id: UUID
    period_type: SchedulePeriodType
    name: str
    valid_from: date | None = None
    valid_until: date | None = None
    recurs_annually: bool
    is_active: bool
    intervals: list[StoreScheduleIntervalResponse]


class StoreScheduleExceptionIntervalResponse(
    StoreScheduleExceptionIntervalInput
):
    id: UUID


class StoreScheduleExceptionResponse(BaseModel):
    id: UUID
    start_date: date
    end_date: date
    mode: ScheduleExceptionMode
    label: str | None = None
    public_message: str | None = None
    online_order_override: ExceptionOnlineOrderMode | None = None
    intervals: list[StoreScheduleExceptionIntervalResponse]


class StoreScheduleResponse(BaseModel):
    store_id: UUID
    timezone_name: str
    online_order_mode: OnlineOrderMode
    periods: list[StoreSchedulePeriodResponse]
    exceptions: list[StoreScheduleExceptionResponse]
    created_at: datetime | None = None
    updated_at: datetime | None = None



class StoreScheduleStatusResponse(BaseModel):
    store_id: UUID
    timezone_name: str
    local_datetime: datetime
    is_configured: bool
    is_open: bool | None = None
    source: Literal[
        "UNCONFIGURED",
        "NO_ACTIVE_SCHEDULE",
        "REGULAR",
        "SEASONAL",
        "EXCEPTION",
    ]
    source_label: str | None = None
    public_message: str | None = None
    online_orders_allowed: bool
    effective_online_order_mode: Literal[
        "ALWAYS",
        "OPEN_ONLY",
        "DISABLED",
    ]
    next_open_at: datetime | None = None
