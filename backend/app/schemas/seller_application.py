from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SellerApplicationCreate(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=160)
    city: Optional[str] = Field(default=None, max_length=120)
    reason: str = Field(..., min_length=10, max_length=1200)


class SellerApplicationReview(BaseModel):
    status: Literal["approved", "rejected"]
    admin_note: Optional[str] = Field(default=None, max_length=1200)


class SellerApplicationResponse(BaseModel):
    id: UUID
    user_id: UUID
    business_name: str
    city: Optional[str] = None
    reason: str
    status: str
    admin_note: Optional[str] = None
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SellerApplicationAdminResponse(SellerApplicationResponse):
    applicant_email: str
    applicant_name: str