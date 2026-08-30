from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from backend.app.models.economic_ledger_entry import (
    EconomicLedgerEntryType,
)


class EconomicLedgerEntryResponse(BaseModel):
    id: UUID
    order_id: UUID
    payment_id: Optional[UUID] = None
    store_id: UUID
    seller_id: UUID

    entry_type: EconomicLedgerEntryType

    amount: Decimal
    currency: str

    platform_fee_rate: Decimal
    platform_fee_base: Decimal
    seller_net_amount: Decimal

    reverses_entry_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EconomicLedgerAdminStoreResponse(BaseModel):
    id: UUID
    name: str
    slug: Optional[str] = None


class EconomicLedgerAdminSellerResponse(BaseModel):
    id: UUID
    name: str
    email: str


class EconomicLedgerAdminResponse(BaseModel):
    entry: EconomicLedgerEntryResponse
    store: EconomicLedgerAdminStoreResponse
    seller: EconomicLedgerAdminSellerResponse


class EconomicLedgerAdminSummaryResponse(BaseModel):
    total_entries: int
    accrued_entries: int
    reversal_entries: int

    accrued_amount: Decimal
    reversal_amount: Decimal
    net_platform_amount: Decimal

    currency: str
