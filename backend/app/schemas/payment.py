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
    account_holder: str | None = Field(
        default=None,
        max_length=160,
    )
    account_alias: str | None = Field(
        default=None,
        max_length=120,
    )
    account_cbu_cvu: str | None = Field(
        default=None,
        max_length=40,
    )
    bank_name: str | None = Field(
        default=None,
        max_length=120,
    )
    instructions: str | None = Field(
        default=None,
        max_length=500,
    )


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
    account_holder: str | None = None
    account_alias: str | None = None
    account_cbu_cvu: str | None = None
    bank_name: str | None = None
    instructions: str | None = None


class StorePaymentMethodsResponse(BaseModel):
    store_id: UUID
    store_name: str
    methods: list[StorePaymentMethodResponse]




class BuyerStorePaymentMethodResponse(BaseModel):
    method: str
    label: str
    allow_pay_on_pickup: bool
    account_holder: str | None = None
    account_alias: str | None = None
    account_cbu_cvu: str | None = None
    bank_name: str | None = None
    instructions: str | None = None


class BuyerStorePaymentMethodsResponse(BaseModel):
    store_id: UUID
    store_name: str
    methods: list[BuyerStorePaymentMethodResponse]



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

    destination_account_holder: str | None = None
    destination_account_alias: str | None = None
    destination_account_cbu_cvu: str | None = None
    destination_bank_name: str | None = None
    destination_instructions: str | None = None

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
