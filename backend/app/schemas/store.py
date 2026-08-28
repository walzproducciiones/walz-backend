from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class StoreProfileUpdate(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    logo_url: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = Field(default=None, max_length=1200)
    phone: Optional[str] = Field(default=None, max_length=40)
    city: Optional[str] = Field(default=None, max_length=120)
    address: Optional[str] = Field(default=None, max_length=250)
    business_categories: list[str] = Field(default_factory=list, max_length=8)

    avanter_enabled: bool = False
    avanter_title: Optional[str] = Field(default=None, max_length=160)
    avanter_text: Optional[str] = Field(default=None, max_length=1200)
    avanter_image_url: Optional[str] = Field(default=None, max_length=500)

    delivery_enabled: bool = True
    pickup_enabled: bool = True


class StoreResponse(StoreProfileUpdate):
    slug: Optional[str] = Field(default=None, max_length=180)
    id: UUID
    owner_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True