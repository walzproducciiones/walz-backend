from enum import Enum
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.models.store_payment_method import StorePaymentMethod
from backend.app.services.store_service import get_store_by_owner


class PaymentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


PAYMENTS_ENABLED = False
PAYMENT_PROVIDER: Optional[str] = None


PAYMENT_METHOD_DEFINITIONS = {
    "CASH": {
        "label": "Efectivo",
        "provider": "MANUAL",
    },
    "BANK_TRANSFER": {
        "label": "Transferencia bancaria",
        "provider": "MANUAL",
    },
    "CUENTA_DNI": {
        "label": "Cuenta DNI",
        "provider": "BANCO_PROVINCIA",
    },
    "MERCADO_PAGO": {
        "label": "Mercado Pago",
        "provider": "MERCADO_PAGO",
    },
}


def get_payment_configuration():
    return {
        "enabled": PAYMENTS_ENABLED,
        "provider": PAYMENT_PROVIDER,
        "stores_card_data": False,
        "message": "Los pagos online todavia no estan habilitados.",
    }


def _serialize_store_payment_methods(store, rows):
    rows_by_method = {
        str(row.method or "").strip().upper(): row
        for row in rows
    }

    methods = []

    for method, definition in PAYMENT_METHOD_DEFINITIONS.items():
        row = rows_by_method.get(method)

        methods.append({
            "method": method,
            "label": definition["label"],
            "provider": definition["provider"],
            "enabled": bool(row.enabled) if row else False,
            "allow_pay_on_pickup": (
                bool(row.allow_pay_on_pickup)
                if row
                else False
            ),
        })

    return {
        "store_id": store.id,
        "store_name": store.name,
        "methods": methods,
    }


def get_store_payment_methods_by_owner(
    db: Session,
    owner_id: UUID,
):
    store = get_store_by_owner(db, owner_id)

    if not store:
        raise ValueError("Tienda no encontrada.")

    rows = (
        db.query(StorePaymentMethod)
        .filter(StorePaymentMethod.store_id == store.id)
        .all()
    )

    return _serialize_store_payment_methods(store, rows)


def save_store_payment_methods(
    db: Session,
    owner_id: UUID,
    methods,
):
    store = get_store_by_owner(db, owner_id)

    if not store:
        raise ValueError("Tienda no encontrada.")

    normalized = {}

    for item in methods:
        method = str(item.method or "").strip().upper()

        if method not in PAYMENT_METHOD_DEFINITIONS:
            raise ValueError(
                f"Forma de pago no valida: {method or 'vacia'}."
            )

        if method in normalized:
            raise ValueError(
                f"La forma de pago {method} esta repetida."
            )

        enabled = bool(item.enabled)
        allow_pay_on_pickup = bool(item.allow_pay_on_pickup)

        if allow_pay_on_pickup and not enabled:
            raise ValueError(
                "No se puede permitir pago al retirar "
                "en una forma de pago deshabilitada."
            )

        if allow_pay_on_pickup and not store.pickup_enabled:
            raise ValueError(
                "La tienda no tiene habilitado el retiro en el local."
            )

        normalized[method] = {
            "enabled": enabled,
            "allow_pay_on_pickup": allow_pay_on_pickup,
        }

    if not any(
        values["enabled"]
        for values in normalized.values()
    ):
        raise ValueError(
            "Selecciona al menos una forma de pago."
        )

    existing_rows = (
        db.query(StorePaymentMethod)
        .filter(StorePaymentMethod.store_id == store.id)
        .all()
    )

    existing_by_method = {
        str(row.method or "").strip().upper(): row
        for row in existing_rows
    }

    for method, definition in PAYMENT_METHOD_DEFINITIONS.items():
        values = normalized.get(method, {
            "enabled": False,
            "allow_pay_on_pickup": False,
        })

        row = existing_by_method.get(method)

        if row:
            row.provider = definition["provider"]
            row.enabled = values["enabled"]
            row.allow_pay_on_pickup = (
                values["allow_pay_on_pickup"]
            )
        else:
            db.add(StorePaymentMethod(
                store_id=store.id,
                method=method,
                provider=definition["provider"],
                enabled=values["enabled"],
                allow_pay_on_pickup=(
                    values["allow_pay_on_pickup"]
                ),
            ))

    db.commit()

    return get_store_payment_methods_by_owner(
        db,
        owner_id,
    )
