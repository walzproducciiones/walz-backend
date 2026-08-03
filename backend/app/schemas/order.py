from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import List, Optional
from backend.app.schemas.product import ProductResponse

class OrderItemBase(BaseModel):
    product_id: UUID
    quantity: int = 1

class OrderItemCreate(OrderItemBase):
    pass

class OrderItemResponse(OrderItemBase):
    id: UUID
    price_at_purchase: float
    product: ProductResponse

    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    shipping_address: Optional[str] = None

class OrderCreate(OrderBase):
    items: List[OrderItemCreate]

class OrderResponse(OrderBase):
    id: UUID
    buyer_id: UUID
    total_amount: float
    status: str
    created_at: datetime
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True