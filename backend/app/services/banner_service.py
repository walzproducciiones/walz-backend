from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.app.models.banner import Banner
from backend.app.models.product import Product
from backend.app.schemas.banner import (
    BannerCreate,
    BannerProposalCreate,
    BannerUpdate,
)


def _validate_dates(starts_at, ends_at):
    if starts_at and ends_at and ends_at <= starts_at:
        raise ValueError("La fecha de finalizacion debe ser posterior al inicio.")


def get_active_banners(db: Session):
    now = datetime.now(timezone.utc)
    return (
        db.query(Banner)
        .filter(
            Banner.is_active == True,
            Banner.approval_status == "approved",
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
    banner = Banner(created_by=admin_id, approval_status="approved", **data.model_dump())
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

def create_banner_proposal(
    db: Session,
    seller_id: UUID,
    data: BannerProposalCreate,
):
    product = (
        db.query(Product)
        .filter(
            Product.id == data.product_id,
            Product.seller_id == seller_id,
        )
        .first()
    )
    if not product:
        return None, "Solo podes promocionar un producto propio."

    proposal = Banner(
        title=data.title,
        subtitle=data.subtitle,
        image_url=data.image_url,
        button_text="Ver producto",
        is_active=False,
        display_order=0,
        created_by=seller_id,
        seller_id=seller_id,
        product_id=product.id,
        approval_status="pending",
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal, None


def get_banner_proposals_by_seller(db: Session, seller_id: UUID):
    return (
        db.query(Banner)
        .filter(Banner.seller_id == seller_id)
        .order_by(Banner.created_at.desc())
        .all()
    )


def review_banner_proposal(
    db: Session,
    banner_id: UUID,
    admin_id: UUID,
    requested_status: str,
):
    banner = (
        db.query(Banner)
        .filter(
            Banner.id == banner_id,
            Banner.seller_id.isnot(None),
        )
        .first()
    )
    if not banner:
        return None

    banner.approval_status = requested_status
    banner.is_active = requested_status == "approved"
    banner.reviewed_by = admin_id
    banner.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(banner)
    return banner