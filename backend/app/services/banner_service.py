from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.app.models.banner import Banner
from backend.app.schemas.banner import BannerCreate, BannerUpdate


def _validate_dates(starts_at, ends_at):
    if starts_at and ends_at and ends_at <= starts_at:
        raise ValueError("La fecha de finalizacion debe ser posterior al inicio.")


def get_active_banners(db: Session):
    now = datetime.now(timezone.utc)
    return (
        db.query(Banner)
        .filter(
            Banner.is_active == True,
            or_(Banner.starts_at.is_(None), Banner.starts_at <= now),
            or_(Banner.ends_at.is_(None), Banner.ends_at >= now),
        )
        .order_by(Banner.display_order.asc(), Banner.created_at.desc())
        .all()
    )


def get_all_banners(db: Session):
    return (
        db.query(Banner)
        .order_by(Banner.display_order.asc(), Banner.created_at.desc())
        .all()
    )


def create_banner(db: Session, admin_id: UUID, data: BannerCreate):
    _validate_dates(data.starts_at, data.ends_at)
    banner = Banner(created_by=admin_id, **data.model_dump())
    db.add(banner)
    db.commit()
    db.refresh(banner)
    return banner


def update_banner(db: Session, banner_id: UUID, data: BannerUpdate):
    banner = db.query(Banner).filter(Banner.id == banner_id).first()
    if not banner:
        return None

    updates = data.model_dump(exclude_unset=True)
    resulting_start = updates.get("starts_at", banner.starts_at)
    resulting_end = updates.get("ends_at", banner.ends_at)
    _validate_dates(resulting_start, resulting_end)

    nullable_fields = {"subtitle", "link_url", "button_text", "starts_at", "ends_at"}
    for field, value in updates.items():
        if value is not None or field in nullable_fields:
            setattr(banner, field, value)

    db.commit()
    db.refresh(banner)
    return banner