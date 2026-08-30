from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.models.order import Order, OrderStatus
from backend.app.models.payment import Payment, PaymentStatus
from backend.app.models.product import Product
from backend.app.models.store import Store
from backend.app.models.store_payment_method import StorePaymentMethod
from backend.app.services.store_service import get_store_by_owner
from backend.app.services.economic_ledger_service import (
    consolidate_order_economy,
)


PAYMENTS_ENABLED = False
PAYMENT_PROVIDER: Optional[str] = None


PAYMENT_STATUS_TRANSITIONS = {
    PaymentStatus.PENDING: {
        PaymentStatus.REPORTED,
        PaymentStatus.APPROVED,
        PaymentStatus.REJECTED,
        PaymentStatus.CANCELLED,
    },
    PaymentStatus.REPORTED: {
        PaymentStatus.APPROVED,
        PaymentStatus.REJECTED,
        PaymentStatus.CANCELLED,
    },
    PaymentStatus.APPROVED: set(),
    PaymentStatus.REJECTED: set(),
    PaymentStatus.CANCELLED: set(),
}


def normalize_payment_status(value) -> PaymentStatus:
    if isinstance(value, PaymentStatus):
        return value

    normalized = str(value or "").strip().lower()

    try:
        return PaymentStatus(normalized)
    except ValueError:
        raise ValueError(
            f"Estado de pago no valido: {value or 'vacio'}."
        )


def change_payment_status(
    db: Session,
    payment_id: UUID,
    requested_status,
    *,
    commit: bool = True,
):
    payment = (
        db.query(Payment)
        .filter(Payment.id == payment_id)
        .with_for_update()
        .first()
    )

    if not payment:
        raise ValueError("Pago no encontrado.")

    current_status = normalize_payment_status(
        payment.status
    )

    target_status = normalize_payment_status(
        requested_status
    )

    # Operacion idempotente:
    # repetir el estado actual no genera error ni altera fechas.
    if target_status == current_status:
        return payment

    allowed = PAYMENT_STATUS_TRANSITIONS.get(
        current_status,
        set(),
    )

    if target_status not in allowed:
        raise ValueError(
            "Transicion de pago no permitida: "
            f"{current_status.value} -> "
            f"{target_status.value}."
        )

    now = datetime.now(timezone.utc)

    payment.status = target_status

    if target_status == PaymentStatus.REPORTED:
        payment.reported_at = now

    elif target_status == PaymentStatus.APPROVED:
        payment.approved_at = now

    elif target_status == PaymentStatus.REJECTED:
        payment.rejected_at = now

    elif target_status == PaymentStatus.CANCELLED:
        payment.cancelled_at = now

    if commit:
        db.commit()
        db.refresh(payment)
    else:
        db.flush()

    return payment


BUYER_REPORTABLE_PAYMENT_METHODS = {
    "BANK_TRANSFER",
    "CUENTA_DNI",
}


ACTIVE_PAYMENT_STATUSES = {
    PaymentStatus.PENDING,
    PaymentStatus.REPORTED,
    PaymentStatus.APPROVED,
}


def _payment_money(value, field_name: str) -> Decimal:
    if value is None:
        raise ValueError(
            f"El pedido no tiene {field_name} definido."
        )

    return Decimal(
        str(value)
    ).quantize(
        Decimal("0.01")
    )


def _normalized_optional_text(value):
    normalized = str(value or "").strip()
    return normalized or None


def create_payment_for_order(
    db: Session,
    order_id: UUID,
    buyer_id: UUID,
    requested_method: str,
):
    """
    Create the financial Payment for an existing order.

    The client may choose only the payment method.
    Store, provider, amount and currency are derived
    and validated server-side.
    """
    order = (
        db.query(Order)
        .filter(
            Order.id == order_id,
            Order.buyer_id == buyer_id,
        )
        .with_for_update()
        .first()
    )

    if not order:
        raise ValueError("Pedido no encontrado.")

    if order.status in {
        OrderStatus.CANCELLED,
        OrderStatus.DELIVERED,
    }:
        raise ValueError(
            "El pedido ya no admite iniciar un pago."
        )

    if not order.store_id:
        raise ValueError(
            "El pedido no tiene una tienda financiera definida."
        )

    fulfillment_method = str(
        order.fulfillment_method or ""
    ).strip().lower()

    if fulfillment_method not in {
        "delivery",
        "pickup",
    }:
        raise ValueError(
            "El pedido no tiene una modalidad "
            "de entrega financiera valida."
        )

    store = (
        db.query(Store)
        .filter(Store.id == order.store_id)
        .first()
    )

    if not store:
        raise ValueError(
            "La tienda asociada al pedido no existe."
        )

    product_ids = [
        item.product_id
        for item in order.items
    ]

    if not product_ids:
        raise ValueError(
            "El pedido no contiene productos."
        )

    products = (
        db.query(Product)
        .filter(
            Product.id.in_(product_ids)
        )
        .all()
    )

    if (
        len(products) != len(set(product_ids))
        or any(
            product.seller_id != store.owner_id
            for product in products
        )
    ):
        raise ValueError(
            "El pedido no coincide con la tienda "
            "asociada al pago."
        )

    method = str(
        requested_method or ""
    ).strip().upper()

    if method not in PAYMENT_METHOD_DEFINITIONS:
        raise ValueError(
            f"Forma de pago no valida: "
            f"{method or 'vacia'}."
        )

    configured_method = (
        db.query(StorePaymentMethod)
        .filter(
            StorePaymentMethod.store_id == store.id,
            StorePaymentMethod.method == method,
        )
        .first()
    )

    if (
        not configured_method
        or not configured_method.enabled
    ):
        raise ValueError(
            "La tienda no tiene habilitada "
            "esa forma de pago."
        )

    definition = PAYMENT_METHOD_DEFINITIONS[
        method
    ]

    provider = definition["provider"]

    destination_account_holder = _normalized_optional_text(
        configured_method.account_holder
    )
    destination_account_alias = _normalized_optional_text(
        configured_method.account_alias
    )
    destination_account_cbu_cvu = _normalized_optional_text(
        configured_method.account_cbu_cvu
    )
    destination_bank_name = _normalized_optional_text(
        configured_method.bank_name
    )
    destination_instructions = _normalized_optional_text(
        configured_method.instructions
    )

    if (
        method == "BANK_TRANSFER"
        and not destination_account_alias
        and not destination_account_cbu_cvu
    ):
        raise ValueError(
            "La tienda todavia no completo un Alias o CBU/CVU "
            "para recibir transferencias."
        )

    if method == "MERCADO_PAGO":
        if not PAYMENTS_ENABLED:
            raise ValueError(
                "Mercado Pago todavia no esta habilitado."
            )

    if method == "CASH":
        if fulfillment_method != "pickup":
            raise ValueError(
                "El efectivo solamente esta habilitado "
                "para retiro en el local."
            )

        if not configured_method.allow_pay_on_pickup:
            raise ValueError(
                "La tienda no permite pagar en efectivo "
                "al retirar."
            )

    items_subtotal = _payment_money(
        order.items_subtotal,
        "items_subtotal",
    )

    shipping_amount = _payment_money(
        order.shipping_amount,
        "shipping_amount",
    )

    discount_amount = _payment_money(
        order.discount_amount,
        "discount_amount",
    )

    payable_amount = _payment_money(
        order.payable_amount,
        "payable_amount",
    )

    calculated_payable = (
        items_subtotal
        + shipping_amount
        - discount_amount
    ).quantize(
        Decimal("0.01")
    )

    if calculated_payable != payable_amount:
        raise ValueError(
            "El snapshot financiero del pedido "
            "es inconsistente."
        )

    if payable_amount <= Decimal("0.00"):
        raise ValueError(
            "El importe pagable debe ser mayor a cero."
        )

    currency = str(
        order.currency or ""
    ).strip().upper()

    if currency != "ARS":
        raise ValueError(
            "La moneda del pedido no esta soportada."
        )

    existing_payment = (
        db.query(Payment)
        .filter(
            Payment.order_id == order.id,
            Payment.status.in_(
                list(ACTIVE_PAYMENT_STATUSES)
            ),
        )
        .order_by(
            Payment.created_at.desc(),
            Payment.id.desc(),
        )
        .first()
    )

    if existing_payment:
        current_status = normalize_payment_status(
            existing_payment.status
        )

        if current_status == PaymentStatus.APPROVED:
            raise ValueError(
                "El pedido ya tiene un pago aprobado."
            )

        same_payment = (
            str(
                existing_payment.method or ""
            ).strip().upper()
            == method

            and existing_payment.store_id
            == store.id

            and _payment_money(
                existing_payment.amount,
                "amount",
            )
            == payable_amount

            and str(
                existing_payment.currency or ""
            ).strip().upper()
            == currency
        )

        if same_payment:
            return existing_payment

        raise ValueError(
            "El pedido ya tiene un pago activo."
        )

    payment = Payment(
        order_id=order.id,
        store_id=store.id,
        method=method,
        provider=provider,

        destination_account_holder=destination_account_holder,
        destination_account_alias=destination_account_alias,
        destination_account_cbu_cvu=destination_account_cbu_cvu,
        destination_bank_name=destination_bank_name,
        destination_instructions=destination_instructions,

        status=PaymentStatus.PENDING,
        amount=payable_amount,
        currency=currency,
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)

    return payment


def get_payments_by_buyer(
    db: Session,
    buyer_id: UUID,
    limit: int = 50,
    offset: int = 0,
):
    return (
        db.query(Payment)
        .join(
            Order,
            Order.id == Payment.order_id,
        )
        .filter(
            Order.buyer_id == buyer_id,
        )
        .order_by(
            Payment.created_at.desc(),
            Payment.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_payments_by_seller(
    db: Session,
    seller_id: UUID,
    limit: int = 50,
    offset: int = 0,
):
    return (
        db.query(Payment)
        .join(
            Store,
            Store.id == Payment.store_id,
        )
        .filter(
            Store.owner_id == seller_id,
        )
        .order_by(
            Payment.created_at.desc(),
            Payment.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_payments_for_admin(
    db: Session,
    limit: int = 100,
    offset: int = 0,
):
    return (
        db.query(Payment)
        .order_by(
            Payment.created_at.desc(),
            Payment.id.desc(),
        )
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_payment_for_buyer(
    db: Session,
    payment_id: UUID,
    buyer_id: UUID,
):
    return (
        db.query(Payment)
        .join(
            Order,
            Order.id == Payment.order_id,
        )
        .filter(
            Payment.id == payment_id,
            Order.buyer_id == buyer_id,
        )
        .first()
    )


def get_payment_for_seller(
    db: Session,
    payment_id: UUID,
    seller_id: UUID,
):
    return (
        db.query(Payment)
        .join(
            Store,
            Store.id == Payment.store_id,
        )
        .filter(
            Payment.id == payment_id,
            Store.owner_id == seller_id,
        )
        .first()
    )


def report_payment_by_buyer(
    db: Session,
    payment_id: UUID,
    buyer_id: UUID,
):
    payment = get_payment_for_buyer(
        db,
        payment_id,
        buyer_id,
    )

    if not payment:
        raise ValueError("Pago no encontrado.")

    method = str(
        payment.method or ""
    ).strip().upper()

    if method not in BUYER_REPORTABLE_PAYMENT_METHODS:
        raise ValueError(
            "Esta forma de pago no se informa manualmente "
            "por el comprador."
        )

    return change_payment_status(
        db,
        payment.id,
        PaymentStatus.REPORTED,
    )


def review_payment_by_seller(
    db: Session,
    payment_id: UUID,
    seller_id: UUID,
    requested_status,
):
    payment = get_payment_for_seller(
        db,
        payment_id,
        seller_id,
    )

    if not payment:
        raise ValueError("Pago no encontrado.")

    target_status = normalize_payment_status(
        requested_status
    )

    if target_status not in {
        PaymentStatus.APPROVED,
        PaymentStatus.REJECTED,
    }:
        raise ValueError(
            "El vendedor solamente puede aprobar "
            "o rechazar un pago."
        )

    current_status = normalize_payment_status(
        payment.status
    )

    # Mantener idempotencia si se repite el estado terminal actual.
    if target_status == current_status:
        return payment

    payment_method = str(
        payment.method or ""
    ).strip().upper()

    if (
        payment_method in BUYER_REPORTABLE_PAYMENT_METHODS
        and current_status != PaymentStatus.REPORTED
    ):
        raise ValueError(
            "El comprador primero debe informar que realizo "
            "el pago antes de que el vendedor pueda revisarlo."
        )

    try:
        payment = change_payment_status(
            db,
            payment.id,
            target_status,
            commit=False,
        )

        if target_status == PaymentStatus.APPROVED:
            consolidate_order_economy(
                db,
                payment.order_id,
            )

        db.commit()
        db.refresh(payment)

        return payment

    except (ValueError, SQLAlchemyError):
        db.rollback()
        raise


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
            "account_holder": (
                str(row.account_holder or "").strip()
                if row
                else ""
            ) or None,
            "account_alias": (
                str(row.account_alias or "").strip()
                if row
                else ""
            ) or None,
            "account_cbu_cvu": (
                str(row.account_cbu_cvu or "").strip()
                if row
                else ""
            ) or None,
            "bank_name": (
                str(row.bank_name or "").strip()
                if row
                else ""
            ) or None,
            "instructions": (
                str(row.instructions or "").strip()
                if row
                else ""
            ) or None,
        })

    return {
        "store_id": store.id,
        "store_name": store.name,
        "methods": methods,
    }


def get_store_payment_methods_for_buyer(
    db: Session,
    store_id: UUID,
):
    """
    Return only payment methods that a buyer can actually
    select for an active store.

    Seller configuration remains private in /methods/mine.
    """
    store = (
        db.query(Store)
        .filter(
            Store.id == store_id,
            Store.is_active.is_(True),
            Store.operational_status == "ACTIVE",
        )
        .first()
    )

    if not store:
        raise ValueError("Tienda no encontrada.")

    rows = (
        db.query(StorePaymentMethod)
        .filter(
            StorePaymentMethod.store_id == store.id,
            StorePaymentMethod.enabled.is_(True),
        )
        .all()
    )

    serialized = _serialize_store_payment_methods(
        store,
        rows,
    )

    usable_methods = []

    for item in serialized["methods"]:
        if not item["enabled"]:
            continue

        method = str(
            item["method"] or ""
        ).strip().upper()

        # La integracion online real continua deshabilitada.
        if method == "MERCADO_PAGO" and not PAYMENTS_ENABLED:
            continue

        # En V1 el efectivo existe solamente al retirar.
        if method == "CASH":
            if not store.pickup_enabled:
                continue

            if not item["allow_pay_on_pickup"]:
                continue

        # Una transferencia solo puede ofrecerse cuando el
        # vendedor configuro un destino utilizable.
        if method == "BANK_TRANSFER":
            if not (
                item["account_alias"]
                or item["account_cbu_cvu"]
            ):
                continue

        usable_methods.append({
            "method": method,
            "label": item["label"],
            "allow_pay_on_pickup": (
                item["allow_pay_on_pickup"]
            ),
            "account_holder": item["account_holder"],
            "account_alias": item["account_alias"],
            "account_cbu_cvu": item["account_cbu_cvu"],
            "bank_name": item["bank_name"],
            "instructions": item["instructions"],
        })

    return {
        "store_id": store.id,
        "store_name": store.name,
        "methods": usable_methods,
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

        account_holder = str(
            item.account_holder or ""
        ).strip() or None

        account_alias = str(
            item.account_alias or ""
        ).strip() or None

        account_cbu_cvu = str(
            item.account_cbu_cvu or ""
        ).strip() or None

        bank_name = str(
            item.bank_name or ""
        ).strip() or None

        instructions = str(
            item.instructions or ""
        ).strip() or None

        if (
            method == "BANK_TRANSFER"
            and enabled
            and not (
                account_alias
                or account_cbu_cvu
            )
        ):
            raise ValueError(
                "Para habilitar Transferencia bancaria "
                "completa al menos Alias o CBU/CVU."
            )

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
            "account_holder": account_holder,
            "account_alias": account_alias,
            "account_cbu_cvu": account_cbu_cvu,
            "bank_name": bank_name,
            "instructions": instructions,
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
            "account_holder": None,
            "account_alias": None,
            "account_cbu_cvu": None,
            "bank_name": None,
            "instructions": None,
        })

        row = existing_by_method.get(method)

        if row:
            row.provider = definition["provider"]
            row.enabled = values["enabled"]
            row.allow_pay_on_pickup = (
                values["allow_pay_on_pickup"]
            )
            row.account_holder = values["account_holder"]
            row.account_alias = values["account_alias"]
            row.account_cbu_cvu = values["account_cbu_cvu"]
            row.bank_name = values["bank_name"]
            row.instructions = values["instructions"]
        else:
            db.add(StorePaymentMethod(
                store_id=store.id,
                method=method,
                provider=definition["provider"],
                enabled=values["enabled"],
                allow_pay_on_pickup=(
                    values["allow_pay_on_pickup"]
                ),
                account_holder=values["account_holder"],
                account_alias=values["account_alias"],
                account_cbu_cvu=values["account_cbu_cvu"],
                bank_name=values["bank_name"],
                instructions=values["instructions"],
            ))

    db.commit()

    return get_store_payment_methods_by_owner(
        db,
        owner_id,
    )
