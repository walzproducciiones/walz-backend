from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal

CommercialType = Literal[
    "OFERTA",
    "PROMOCION",
    "NOVEDAD",
    "COMBO",
    "2X1",
    "LIQUIDACION",
    "BENEFICIO",
]


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    offer_price: Optional[float] = Field(default=None, gt=0)
    offer_active: bool = False
    commercial_type: Optional[CommercialType] = None
    commercial_text: Optional[str] = Field(default=None, max_length=200)
    commercial_active: bool = False
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

class ProductFilter(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    price: Optional[float] = Field(default=None, gt=0)
    stock: Optional[int] = Field(default=None, ge=0)
    description: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    offer_price: Optional[float] = Field(default=None, gt=0)
    offer_active: Optional[bool] = None
    commercial_type: Optional[CommercialType] = None
    commercial_text: Optional[str] = Field(default=None, max_length=200)
    commercial_active: Optional[bool] = None
    is_active: Optional[bool] = None
