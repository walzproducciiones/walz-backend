from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.app.models.payment import PaymentStatus


class StorePaymentMethodUpdate(BaseModel):
    method: str = Field(
        ...,
        min_length=1,
        max_length=40,
    )
    enabled: bool = False
    allow_pay_on_pickup: bool = False


class StorePaymentMethodsUpdate(BaseModel):
    methods: list[StorePaymentMethodUpdate] = Field(
        min_length=1,
        max_length=20,
    )


class StorePaymentMethodResponse(BaseModel):
    method: str
    label: str
    provider: str
    enabled: bool
    allow_pay_on_pickup: bool


class StorePaymentMethodsResponse(BaseModel):
    store_id: UUID
    store_name: str
    methods: list[StorePaymentMethodResponse]



class PaymentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    method: str = Field(
        min_length=1,
        max_length=40,
    )


class PaymentSellerStatusUpdate(BaseModel):
    status: PaymentStatus


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_id: UUID
    store_id: UUID
    method: str
    provider: str
    status: PaymentStatus
    amount: Decimal
    currency: str

    external_reference: str | None = None
    provider_payment_id: str | None = None

    reported_at: datetime | None = None
    approved_at: datetime | None = None
    rejected_at: datetime | None = None
    cancelled_at: datetime | None = None

    created_at: datetime
    updated_at: datetime
