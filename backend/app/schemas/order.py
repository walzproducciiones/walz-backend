from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from backend.app.schemas.product import ProductResponse


class OrderItemBase(BaseModel):
    product_id: UUID
    quantity: int = Field(default=1, ge=1, le=999)


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemResponse(OrderItemBase):
    id: UUID
    price_at_purchase: float
    product: ProductResponse

    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    shipping_address: Optional[str] = Field(
        default=None,
        max_length=500,
    )


class OrderCreate(OrderBase):
    items: List[OrderItemCreate] = Field(min_length=1, max_length=100)


class OrderResponse(OrderBase):
    id: UUID
    buyer_id: UUID
    total_amount: float
    status: str
    created_at: datetime
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True

class OrderStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1, max_length=30)
