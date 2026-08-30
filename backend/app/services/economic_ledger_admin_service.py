from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.models.economic_ledger_entry import (
    EconomicLedgerEntry,
    EconomicLedgerEntryType,
)
from backend.app.models.store import Store
from backend.app.models.user import User


def get_economic_ledger_for_admin(
    db: Session,
    *,
    limit: int = 100,
    offset: int = 0,
):
    entries = (
        db.query(EconomicLedgerEntry)
        .order_by(
            EconomicLedgerEntry.created_at.desc(),
            EconomicLedgerEntry.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )

    store_ids = {
        entry.store_id
        for entry in entries
        if entry.store_id is not None
    }

    seller_ids = {
        entry.seller_id
        for entry in entries
        if entry.seller_id is not None
    }

    stores = (
        db.query(Store)
        .filter(Store.id.in_(store_ids))
        .all()
        if store_ids
        else []
    )

    sellers = (
        db.query(User)
        .filter(User.id.in_(seller_ids))
        .all()
        if seller_ids
        else []
    )

    stores_by_id = {
        store.id: store
        for store in stores
    }

    sellers_by_id = {
        seller.id: seller
        for seller in sellers
    }

    result = []

    for entry in entries:
        store = stores_by_id.get(entry.store_id)
        seller = sellers_by_id.get(entry.seller_id)

        seller_name = " ".join(
            part
            for part in (
                getattr(seller, "first_name", None),
                getattr(seller, "last_name", None),
            )
            if part
        ).strip()

        result.append(
            {
                "entry": entry,
                "store": {
                    "id": store.id,
                    "name": store.name,
                    "slug": store.slug,
                },
                "seller": {
                    "id": seller.id,
                    "name": seller_name or seller.email,
                    "email": seller.email,
                },
            }
        )

    return result


def get_economic_ledger_summary_for_admin(
    db: Session,
):
    total_entries = (
        db.query(func.count(EconomicLedgerEntry.id))
        .scalar()
        or 0
    )

    accrued_entries = (
        db.query(func.count(EconomicLedgerEntry.id))
        .filter(
            EconomicLedgerEntry.entry_type
            == EconomicLedgerEntryType.PLATFORM_FEE_ACCRUED
        )
        .scalar()
        or 0
    )

    reversal_entries = (
        db.query(func.count(EconomicLedgerEntry.id))
        .filter(
            EconomicLedgerEntry.entry_type
            == EconomicLedgerEntryType.PLATFORM_FEE_REVERSAL
        )
        .scalar()
        or 0
    )

    accrued_amount = (
        db.query(func.coalesce(func.sum(EconomicLedgerEntry.amount), 0))
        .filter(
            EconomicLedgerEntry.entry_type
            == EconomicLedgerEntryType.PLATFORM_FEE_ACCRUED
        )
        .scalar()
        or Decimal("0.00")
    )

    reversal_amount = (
        db.query(func.coalesce(func.sum(EconomicLedgerEntry.amount), 0))
        .filter(
            EconomicLedgerEntry.entry_type
            == EconomicLedgerEntryType.PLATFORM_FEE_REVERSAL
        )
        .scalar()
        or Decimal("0.00")
    )

    net_platform_amount = (
        db.query(func.coalesce(func.sum(EconomicLedgerEntry.amount), 0))
        .scalar()
        or Decimal("0.00")
    )

    return {
        "total_entries": int(total_entries),
        "accrued_entries": int(accrued_entries),
        "reversal_entries": int(reversal_entries),
        "accrued_amount": Decimal(str(accrued_amount)),
        "reversal_amount": Decimal(str(reversal_amount)),
        "net_platform_amount": Decimal(str(net_platform_amount)),
        "currency": "ARS",
    }
