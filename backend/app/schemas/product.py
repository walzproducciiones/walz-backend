from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional

class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    stock: int = Field(0, ge=0)
    category: Optional[str] = None
    image_url: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: UUID
    seller_id: UUID
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True