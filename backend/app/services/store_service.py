import re
import unicodedata
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.models.store import Store
from backend.app.schemas.store import StoreProfileUpdate


def normalize_store_slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return slug[:180] or "tienda"

def get_store_by_slug(db: Session, slug: str):
    return db.query(Store).filter(Store.slug == slug).first()

def build_unique_store_slug(db: Session, name: str, owner_id: UUID) -> str:
    base = normalize_store_slug(name)
    candidate = base
    counter = 2
    while db.query(Store).filter(Store.slug == candidate, Store.owner_id != owner_id).first():
        suffix = f"-{counter}"
        candidate = f"{base[:180 - len(suffix)]}{suffix}"
        counter += 1
    return candidate

def get_all_stores(db: Session):
    return (
        db.query(Store)
        .order_by(Store.name.asc())
        .all()
    )



def get_active_stores(db: Session):
    return (
        db.query(Store)
        .filter(Store.is_active == True)
        .order_by(Store.name.asc())
        .all()
    )


def get_store_by_owner(db: Session, owner_id: UUID):
    return db.query(Store).filter(Store.owner_id == owner_id).first()


SELLER_STORE_STATUS_TRANSITIONS = {
    "ACTIVE": {"PAUSED"},
    "PAUSED": {"ACTIVE"},
    "SUSPENDED": {"REACTIVATION_REQUESTED"},
    "UNDER_REVIEW": set(),
    "REACTIVATION_REQUESTED": set(),
    "CLOSED": set(),
}


ADMIN_STORE_STATUS_TRANSITIONS = {
    "ACTIVE": {"SUSPENDED", "UNDER_REVIEW"},
    "PAUSED": {"ACTIVE", "SUSPENDED", "UNDER_REVIEW"},
    "SUSPENDED": {"ACTIVE", "UNDER_REVIEW"},
    "UNDER_REVIEW": {"ACTIVE", "SUSPENDED"},
    "REACTIVATION_REQUESTED": {"ACTIVE", "SUSPENDED", "UNDER_REVIEW"},
    "CLOSED": set(),
}


def get_store_by_id(db: Session, store_id: UUID):
    return db.query(Store).filter(Store.id == store_id).first()


def normalize_store_status_reason(reason):
    value = str(reason or "").strip()
    return value or None


def apply_store_operational_status(
    db: Session,
    store: Store,
    requested_status: str,
    reason=None,
):
    normalized_status = str(requested_status or "").strip().upper()
    normalized_reason = normalize_store_status_reason(reason)

    store.operational_status = normalized_status
    store.status_reason = normalized_reason
    store.status_changed_at = datetime.now(timezone.utc)
    store.is_active = normalized_status == "ACTIVE"

    try:
        db.commit()
        db.refresh(store)
        return store
    except Exception:
        db.rollback()
        raise


def change_store_status_by_seller(
    db: Session,
    owner_id: UUID,
    requested_status: str,
    reason=None,
):
    store = get_store_by_owner(db, owner_id)

    if not store:
        raise ValueError("Tienda no encontrada.")

    current_status = str(
        store.operational_status or "ACTIVE"
    ).strip().upper()

    requested_status = str(
        requested_status or ""
    ).strip().upper()

    allowed = SELLER_STORE_STATUS_TRANSITIONS.get(
        current_status,
        set(),
    )

    if requested_status not in allowed:
        if current_status == "SUSPENDED" and requested_status == "ACTIVE":
            raise ValueError(
                "Una tienda suspendida por WalZ One no puede "
                "reactivarse directamente. Solicita la reactivacion."
            )

        raise ValueError(
            f"No se permite cambiar la tienda de "
            f"{current_status} a {requested_status}."
        )

    if requested_status == "REACTIVATION_REQUESTED":
        normalized_reason = normalize_store_status_reason(reason)

        if not normalized_reason:
            raise ValueError(
                "Explica brevemente por que solicitas la reactivacion "
                "o que situacion fue corregida."
            )

    return apply_store_operational_status(
        db,
        store,
        requested_status,
        reason,
    )


def change_store_status_by_admin(
    db: Session,
    store_id: UUID,
    requested_status: str,
    reason=None,
):
    store = get_store_by_id(db, store_id)

    if not store:
        raise ValueError("Tienda no encontrada.")

    current_status = str(
        store.operational_status or "ACTIVE"
    ).strip().upper()

    requested_status = str(
        requested_status or ""
    ).strip().upper()

    allowed = ADMIN_STORE_STATUS_TRANSITIONS.get(
        current_status,
        set(),
    )

    if requested_status not in allowed:
        raise ValueError(
            f"No se permite cambiar la tienda de "
            f"{current_status} a {requested_status} desde Administracion Central."
        )

    normalized_reason = normalize_store_status_reason(reason)

    if requested_status in {"SUSPENDED", "UNDER_REVIEW"} and not normalized_reason:
        raise ValueError(
            "Indica el motivo de la suspension o revision."
        )

    return apply_store_operational_status(
        db,
        store,
        requested_status,
        reason,
    )



def save_store_profile(
    db: Session,
    owner_id: UUID,
    data: StoreProfileUpdate,
):
    store = get_store_by_owner(db, owner_id)
    values = data.model_dump()
    if not values.get("delivery_enabled") and not values.get("pickup_enabled"):
        raise ValueError("Selecciona al menos una forma de entrega.")

    for optional_field in (
        "logo_url",
        "description",
        "phone",
        "city",
        "address",
        "avanter_title",
        "avanter_text",
        "avanter_image_url",
    ):
        value = values.get(optional_field)
        values[optional_field] = str(value).strip() if value else None

    categories = values.get("business_categories") or []
    normalized_categories = []
    seen_categories = set()

    for category in categories:
        value = " ".join(str(category or "").strip().split())
        if not value:
            continue
        if len(value) > 80:
            raise ValueError("Cada rubro puede tener hasta 80 caracteres.")

        key = value.casefold()
        if key in seen_categories:
            continue

        seen_categories.add(key)
        normalized_categories.append(value)

    if len(normalized_categories) > 8:
        raise ValueError("Selecciona hasta 8 rubros por tienda.")

    values["business_categories"] = normalized_categories
    values["name"] = values["name"].strip()

    if store:
        if not store.slug:
            store.slug = build_unique_store_slug(db, values["name"], owner_id)
        for field, value in values.items():
            setattr(store, field, value)
    else:
        values["slug"] = build_unique_store_slug(db, values["name"], owner_id)
        store = Store(owner_id=owner_id, **values)
        db.add(store)

    if values.get("pickup_enabled") is False and store.id is not None:
        from backend.app.models.store_payment_method import StorePaymentMethod

        (
            db.query(StorePaymentMethod)
            .filter(
                StorePaymentMethod.store_id == store.id,
                StorePaymentMethod.allow_pay_on_pickup == True,
            )
            .update(
                {"allow_pay_on_pickup": False},
                synchronize_session=False,
            )
        )

    db.commit()
    db.refresh(store)
    return store