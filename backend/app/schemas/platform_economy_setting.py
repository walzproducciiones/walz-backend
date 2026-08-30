from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class PlatformEconomySettingUpdate(BaseModel):
    economy_enabled: bool

    default_commission_rate: Decimal = Field(
        ...,
        ge=Decimal("0.0000"),
        le=Decimal("100.0000"),
        max_digits=7,
        decimal_places=4,
    )


class PlatformEconomySettingResponse(
    PlatformEconomySettingUpdate
):
    id: UUID
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
