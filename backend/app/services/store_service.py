from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.models.store import Store
from backend.app.schemas.store import StoreProfileUpdate


def get_active_stores(db: Session):
    return (
        db.query(Store)
        .filter(Store.is_active == True)
        .order_by(Store.name.asc())
        .all()
    )


def get_store_by_owner(db: Session, owner_id: UUID):
    return db.query(Store).filter(Store.owner_id == owner_id).first()


def save_store_profile(
    db: Session,
    owner_id: UUID,
    data: StoreProfileUpdate,
):
    store = get_store_by_owner(db, owner_id)
    values = data.model_dump()

    for optional_field in ("logo_url", "description", "phone", "city", "address"):
        value = values.get(optional_field)
        values[optional_field] = str(value).strip() if value else None

    values["name"] = values["name"].strip()

    if store:
        for field, value in values.items():
            setattr(store, field, value)
    else:
        store = Store(owner_id=owner_id, **values)
        db.add(store)

    db.commit()
    db.refresh(store)
    return store