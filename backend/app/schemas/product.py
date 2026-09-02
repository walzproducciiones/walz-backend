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


PublicationStatus = Literal[
    "DRAFT",
    "PUBLISHED",
    "PAUSED",
]

ImageLayout = Literal["AUTO", "LANDSCAPE", "SQUARE", "PORTRAIT"]
ImageContrast = Literal["AUTO", "LIGHT", "NEUTRAL", "DARK"]


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
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    avanter_enabled: bool = False
    image_url: Optional[str] = None
    image_layout: ImageLayout = "AUTO"
    image_contrast: ImageContrast = "AUTO"

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    id: UUID
    seller_id: UUID
    is_active: bool
    publication_status: PublicationStatus
    created_at: datetime

    class Config:
        from_attributes = True


class ProductAdminStoreResponse(BaseModel):
    seller_id: UUID
    name: str
    slug: Optional[str] = None


class ProductAdminSellerResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: str
    role: str
    is_active: bool


class ProductAdminResponse(BaseModel):
    product: ProductResponse
    seller: Optional[ProductAdminSellerResponse] = None
    store: Optional[ProductAdminStoreResponse] = None


class ProductFilter(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    avanter_enabled: Optional[bool] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    price: Optional[float] = Field(default=None, gt=0)
    stock: Optional[int] = Field(default=None, ge=0)
    description: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    avanter_enabled: Optional[bool] = None
    image_url: Optional[str] = None
    image_layout: Optional[ImageLayout] = None
    image_contrast: Optional[ImageContrast] = None
    offer_price: Optional[float] = Field(default=None, gt=0)
    offer_active: Optional[bool] = None
    commercial_type: Optional[CommercialType] = None
    commercial_text: Optional[str] = Field(default=None, max_length=200)
    commercial_active: Optional[bool] = None
    publication_status: Optional[PublicationStatus] = None
    is_active: Optional[bool] = None
