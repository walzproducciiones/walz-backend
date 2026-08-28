from uuid import UUID

from pydantic import BaseModel, Field


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
