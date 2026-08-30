from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.app.models.banner import Banner
from backend.app.models.product import Product
from backend.app.models.store import Store
from backend.app.models.user import User
from backend.app.schemas.banner import (
    BannerCreate,
    BannerProposalCreate,
    BannerUpdate,
)


def _validate_dates(starts_at, ends_at):
    if starts_at and ends_at and ends_at <= starts_at:
        raise ValueError("La fecha de finalizacion debe ser posterior al inicio.")


def _validate_banner_media(placement, image_url):
    normalized_placement = str(
        placement or "CENTRAL_MARKETPLACE"
    ).strip().upper()

    normalized_image = str(image_url or "").strip()

    if (
        normalized_placement != "BOTTOM_BAR"
        and not normalized_image
    ):
        raise ValueError(
            "Los banners graficos requieren una imagen."
        )


def _validate_banner_origin(seller_id, placement):
    normalized_placement = str(
        placement or "CENTRAL_MARKETPLACE"
    ).strip().upper()

    if seller_id is None:
        if normalized_placement == "SELLER_SPONSORED":
            raise ValueError(
                "La publicidad Central no puede clasificarse como publicidad de vendedor."
            )
        return

    if normalized_placement != "SELLER_SPONSORED":
        raise ValueError(
            "La publicidad de un vendedor debe permanecer como publicidad patrocinada de vendedor."
        )


def get_active_banners(
    db: Session,
    placement: str | None = "CENTRAL_MARKETPLACE",
):
    now = datetime.now(timezone.utc)

    placement = str(
        placement or "CENTRAL_MARKETPLACE"
    ).strip().upper()

    query = (
        db.query(Banner)
        .filter(
            Banner.is_active == True,
            Banner.approval_status == "approved",
            or_(Banner.starts_at.is_(None), Banner.starts_at <= now),
            or_(Banner.ends_at.is_(None), Banner.ends_at >= now),
        )
    )

    if placement:
        query = query.filter(Banner.placement == placement)

    return (
        query
        .order_by(Banner.display_order.asc(), Banner.created_at.desc())
        .all()
    )


def get_all_banners(db: Session):
    banners = (
        db.query(Banner)
        .order_by(Banner.display_order.asc(), Banner.created_at.desc())
        .all()
    )

    seller_ids = {
        banner.seller_id
        for banner in banners
        if banner.seller_id is not None
    }

    product_ids = {
        banner.product_id
        for banner in banners
        if banner.product_id is not None
    }

    sellers = (
        db.query(User)
        .filter(User.id.in_(seller_ids))
        .all()
        if seller_ids
        else []
    )

    stores = (
        db.query(Store)
        .filter(Store.owner_id.in_(seller_ids))
        .all()
        if seller_ids
        else []
    )

    products = (
        db.query(Product)
        .filter(Product.id.in_(product_ids))
        .all()
        if product_ids
        else []
    )

    sellers_by_id = {
        seller.id: seller
        for seller in sellers
    }

    stores_by_owner = {
        store.owner_id: store
        for store in stores
    }

    products_by_id = {
        product.id: product
        for product in products
    }

    result = []

    for banner in banners:
        seller = sellers_by_id.get(banner.seller_id)
        store = stores_by_owner.get(banner.seller_id)
        product = products_by_id.get(banner.product_id)

        row = {
            column.name: getattr(banner, column.name)
            for column in Banner.__table__.columns
        }

        if seller:
            seller_name = " ".join(
                part
                for part in [
                    str(seller.first_name or "").strip(),
                    str(seller.last_name or "").strip(),
                ]
                if part
            )
            row["seller_name"] = seller_name or None
            row["seller_email"] = seller.email

        if store:
            row["store_name"] = store.name
            row["store_slug"] = store.slug

        if product:
            row["product_name"] = product.name

        result.append(row)

    return result


def create_banner(db: Session, admin_id: UUID, data: BannerCreate):
    _validate_dates(data.starts_at, data.ends_at)

    payload = data.model_dump()

    _validate_banner_origin(
        None,
        payload.get("placement"),
    )

    _validate_banner_media(
        payload.get("placement"),
        payload.get("image_url"),
    )

    if (
        payload.get("placement") == "BOTTOM_BAR"
        and not payload.get("image_url")
    ):
        # SQLite actual conserva image_url como NOT NULL.
        # La barra de texto usa cadena vacia internamente.
        payload["image_url"] = ""

    banner = Banner(
        created_by=admin_id,
        approval_status="approved",
        **payload,
    )

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

    resulting_placement = updates.get(
        "placement",
        banner.placement,
    )

    resulting_image = updates.get(
        "image_url",
        banner.image_url,
    )

    _validate_banner_origin(
        banner.seller_id,
        resulting_placement,
    )

    if (
        banner.seller_id is not None
        and updates.get("is_active") is True
        and str(banner.approval_status or "").strip().lower() != "approved"
    ):
        raise ValueError(
            "Solo puede activarse publicidad de vendedor aprobada."
        )

    if (
        resulting_placement == "BOTTOM_BAR"
        and "image_url" in updates
        and updates["image_url"] is None
    ):
        updates["image_url"] = ""
        resulting_image = ""

    _validate_banner_media(
        resulting_placement,
        resulting_image,
    )

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
        placement="SELLER_SPONSORED",
        audience="PUBLIC",
        style_variant="STANDARD",
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
    review_note: str | None = None,
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

    _validate_banner_origin(
        banner.seller_id,
        banner.placement,
    )

    banner.approval_status = requested_status
    banner.is_active = requested_status == "approved"
    banner.reviewed_by = admin_id
    banner.reviewed_at = datetime.now(timezone.utc)
    banner.review_note = str(review_note or "").strip() or None
    db.commit()
    db.refresh(banner)
    return banner
