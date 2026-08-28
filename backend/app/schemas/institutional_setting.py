from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class InstitutionalSettingUpdate(BaseModel):
    institutional_name: str = Field(..., min_length=2, max_length=160)
    description: Optional[str] = Field(default=None, max_length=1200)

    email: Optional[str] = Field(default=None, max_length=250)
    phone: Optional[str] = Field(default=None, max_length=60)
    whatsapp: Optional[str] = Field(default=None, max_length=60)

    city: Optional[str] = Field(default=None, max_length=120)
    address: Optional[str] = Field(default=None, max_length=250)

    website_url: Optional[str] = Field(default=None, max_length=500)
    instagram_url: Optional[str] = Field(default=None, max_length=500)
    facebook_url: Optional[str] = Field(default=None, max_length=500)


class InstitutionalSettingResponse(InstitutionalSettingUpdate):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class InstitutionalSettingPublicResponse(BaseModel):
    institutional_name: str
    description: Optional[str] = None

    email: Optional[str] = None
    whatsapp: Optional[str] = None

    website_url: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None

    class Config:
        from_attributes = True
