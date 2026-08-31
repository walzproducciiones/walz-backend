from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


DutyAssignmentStatus = Literal[
    "SCHEDULED",
    "CANCELLED",
]

DutyReplacementStatus = Literal[
    "ACTIVE",
    "CANCELLED",
]


class PharmacyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=40)
    whatsapp: Optional[str] = Field(default=None, max_length=40)
    email: Optional[str] = Field(default=None, max_length=200)
    address: Optional[str] = Field(default=None, max_length=250)
    locality: Optional[str] = Field(default=None, max_length=120)
    region: Optional[str] = Field(default=None, max_length=120)
    country_code: Optional[str] = Field(default=None, min_length=2, max_length=2)
    timezone: str = Field(
        default="America/Argentina/Buenos_Aires",
        min_length=1,
        max_length=64,
    )
    is_active: bool = True


class PharmacyCreate(PharmacyBase):
    store_id: Optional[UUID] = None


class PharmacyUpdate(BaseModel):
    store_id: Optional[UUID] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=40)
    whatsapp: Optional[str] = Field(default=None, max_length=40)
    email: Optional[str] = Field(default=None, max_length=200)
    address: Optional[str] = Field(default=None, max_length=250)
    locality: Optional[str] = Field(default=None, max_length=120)
    region: Optional[str] = Field(default=None, max_length=120)
    country_code: Optional[str] = Field(default=None, min_length=2, max_length=2)
    timezone: Optional[str] = Field(default=None, min_length=1, max_length=64)
    is_active: Optional[bool] = None


class PharmacyResponse(PharmacyBase):
    id: UUID
    store_id: Optional[UUID] = None
    created_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PharmacyDutyAreaBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    locality: Optional[str] = Field(default=None, max_length=120)
    region: Optional[str] = Field(default=None, max_length=120)
    country_code: Optional[str] = Field(default=None, min_length=2, max_length=2)
    timezone: str = Field(
        default="America/Argentina/Buenos_Aires",
        min_length=1,
        max_length=64,
    )
    is_active: bool = True


class PharmacyDutyAreaCreate(PharmacyDutyAreaBase):
    pass


class PharmacyDutyAreaUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=160)
    locality: Optional[str] = Field(default=None, max_length=120)
    region: Optional[str] = Field(default=None, max_length=120)
    country_code: Optional[str] = Field(default=None, min_length=2, max_length=2)
    timezone: Optional[str] = Field(default=None, min_length=1, max_length=64)
    is_active: Optional[bool] = None


class PharmacyDutyAreaResponse(PharmacyDutyAreaBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PharmacyDutyAssignmentCreate(BaseModel):
    pharmacy_id: UUID
    area_id: UUID
    starts_at: datetime
    ends_at: datetime
    public_note: Optional[str] = None


class PharmacyDutyAssignmentUpdate(BaseModel):
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    status: Optional[DutyAssignmentStatus] = None
    public_note: Optional[str] = None


class PharmacyDutyAssignmentResponse(BaseModel):
    id: UUID
    pharmacy_id: UUID
    area_id: UUID
    starts_at: datetime
    ends_at: datetime
    status: DutyAssignmentStatus
    public_note: Optional[str] = None
    published_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PharmacyDutyReplacementCreate(BaseModel):
    replacement_pharmacy_id: UUID
    starts_at: datetime
    ends_at: datetime
    reason: Optional[str] = Field(default=None, max_length=250)
    public_note: Optional[str] = None


class PharmacyDutyReplacementUpdate(BaseModel):
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    status: Optional[DutyReplacementStatus] = None
    reason: Optional[str] = Field(default=None, max_length=250)
    public_note: Optional[str] = None


class PharmacyDutyReplacementResponse(BaseModel):
    id: UUID
    assignment_id: UUID
    replacement_pharmacy_id: UUID
    starts_at: datetime
    ends_at: datetime
    status: DutyReplacementStatus
    reason: Optional[str] = None
    public_note: Optional[str] = None
    published_by_user_id: Optional[UUID] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PharmacyDutyPublicItem(BaseModel):
    assignment_id: UUID
    area: PharmacyDutyAreaResponse
    starts_at: datetime
    ends_at: datetime
    original_pharmacy: PharmacyResponse
    effective_pharmacy: PharmacyResponse
    is_replacement: bool = False
    public_note: Optional[str] = None
