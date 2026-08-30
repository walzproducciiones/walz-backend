from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from backend.app.models.seller_fee_settlement import (
    SellerFeeSettlementStatus,
)


class SellerEconomicAccountResponse(BaseModel):
    seller_id: UUID
    seller_name: str
    seller_email: str

    store_id: UUID
    store_name: str
    store_slug: Optional[str] = None

    accrued_amount: Decimal
    reversal_amount: Decimal
    net_fee_amount: Decimal

    settled_amount: Decimal
    pending_amount: Decimal

    currency: str


class SellerFeeSettlementCreate(BaseModel):
    seller_id: UUID

    amount: Decimal = Field(
        gt=0,
        max_digits=14,
        decimal_places=2,
    )

    method: Optional[str] = Field(
        default=None,
        max_length=60,
    )

    reference: Optional[str] = Field(
        default=None,
        max_length=160,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=500,
    )


class SellerFeeSettlementResponse(BaseModel):
    id: UUID

    seller_id: UUID
    store_id: UUID
    created_by_admin_id: UUID

    status: SellerFeeSettlementStatus

    amount: Decimal
    currency: str

    method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

    settled_at: datetime
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
