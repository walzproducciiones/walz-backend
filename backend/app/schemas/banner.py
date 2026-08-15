from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class BannerBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    subtitle: Optional[str] = Field(default=None, max_length=500)
    image_url: str = Field(..., min_length=1, max_length=500)
    link_url: Optional[str] = Field(default=None, max_length=500)
    button_text: Optional[str] = Field(default=None, max_length=60)
    is_active: bool = True
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    display_order: int = Field(default=0, ge=0)


class BannerCreate(BannerBase):
    pass


class BannerUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=160)
    subtitle: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = Field(default=None, min_length=1, max_length=500)
    link_url: Optional[str] = Field(default=None, max_length=500)
    button_text: Optional[str] = Field(default=None, max_length=60)
    is_active: Optional[bool] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    display_order: Optional[int] = Field(default=None, ge=0)


class BannerResponse(BannerBase):
    id: UUID
    created_by: UUID
    seller_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    approval_status: str = "approved"
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BannerProposalCreate(BaseModel):
    product_id: UUID
    title: str = Field(..., min_length=1, max_length=160)
    subtitle: Optional[str] = Field(default=None, max_length=500)
    image_url: str = Field(..., min_length=1, max_length=500)


class BannerReviewUpdate(BaseModel):
    status: Literal["approved", "rejected"]