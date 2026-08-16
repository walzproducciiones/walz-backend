from datetime import date, datetime
from typing import List, Literal, Optional
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


class SellerDeliveryChoice(BaseModel):
    seller_id: UUID
    method: Literal["delivery", "pickup"]
    shipping_address: str = Field(..., min_length=1, max_length=500)
    requested_date: Optional[date] = None
    requested_time_window: Optional[str] = Field(default=None, max_length=60)


class CheckoutCreate(BaseModel):
    items: List[OrderItemCreate] = Field(min_length=1, max_length=100)
    deliveries: List[SellerDeliveryChoice] = Field(min_length=1, max_length=100)


class OrderResponse(OrderBase):
    id: UUID
    buyer_id: UUID
    total_amount: float
    status: str
    pickup_status: Optional[str] = None
    pickup_ready_at: Optional[datetime] = None
    pickup_buyer_going_at: Optional[datetime] = None
    pickup_buyer_arrived_at: Optional[datetime] = None
    pickup_seller_handed_at: Optional[datetime] = None
    pickup_buyer_received_at: Optional[datetime] = None
    delivery_plan_status: Optional[str] = None
    delivery_buyer_requested_date: Optional[date] = None
    delivery_buyer_requested_window: Optional[str] = None
    delivery_transport_type: Optional[str] = None
    delivery_estimated_date: Optional[date] = None
    delivery_time_window: Optional[str] = None
    delivery_scheduled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True

class OrderStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1, max_length=30)


class PickupStatusUpdate(BaseModel):
    action: Literal["buyer_going", "buyer_arrived", "buyer_received"]

class DeliveryPlanUpdate(BaseModel):
    transport_type: Literal["moto", "correo", "propio", "otro"]
    estimated_date: date
    time_window: str = Field(..., min_length=3, max_length=60)


class DeliveryPlanDecision(BaseModel):
    action: Literal["accept", "keep_requested"]
