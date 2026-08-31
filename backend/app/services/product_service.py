from sqlalchemy.orm import Session
from sqlalchemy import and_, case
from backend.app.models.product import Product
from backend.app.models.banner import Banner
from backend.app.models.store import Store
from backend.app.models.user import User
from backend.app.schemas.product import ProductCreate, ProductFilter, ProductUpdate
from uuid import UUID
from datetime import datetime, timezone

def get_effective_product_price(product: Product) -> float:
    if (
        product.offer_active
        and product.offer_price is not None
        and float(product.offer_price) > 0
        and float(product.offer_price) < float(product.price)
    ):
        return float(product.offer_price)

    return float(product.price)


def create_product(db: Session, seller_id: UUID, product_data: ProductCreate):
    if product_data.offer_active:
        if product_data.offer_price is None:
            raise ValueError("Ingresa un precio de oferta antes de activarla.")
        if float(product_data.offer_price) >= float(product_data.price):
            raise ValueError("El precio de oferta debe ser menor que el precio normal.")

    if product_data.commercial_active and not str(product_data.commercial_type or "").strip():
        raise ValueError("Selecciona un tipo de propuesta comercial antes de activarla.")

    if (
        product_data.commercial_active
        and str(product_data.commercial_type or "").strip().upper() == "OFERTA"
        and product_data.offer_price is None
    ):
        raise ValueError("Una oferta activa necesita un precio promocional.")

    new_product = Product(
        seller_id=seller_id,
        name=product_data.name,
        description=product_data.description,
        price=product_data.price,
        offer_price=product_data.offer_price,
        offer_active=product_data.offer_active,
        commercial_type=product_data.commercial_type,
        commercial_text=product_data.commercial_text,
        commercial_active=product_data.commercial_active,
        commercial_started_at=(
            datetime.now(timezone.utc)
            if product_data.commercial_active
            else None
        ),
        stock=product_data.stock,
        category=product_data.category,
        subcategory=product_data.subcategory,
        brand=product_data.brand,
        avanter_enabled=product_data.avanter_enabled,
        image_url=product_data.image_url
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

def create_products_bulk(db: Session, seller_id: UUID, products_data: list[ProductCreate]):
    new_products = []
    try:
        for position, product_data in enumerate(products_data, start=1):
            if product_data.offer_active:
                if product_data.offer_price is None:
                    raise ValueError(f"Producto {position}: falta el precio de oferta.")
                if float(product_data.offer_price) >= float(product_data.price):
                    raise ValueError(f"Producto {position}: el precio de oferta debe ser menor que el precio normal.")

            if product_data.commercial_active and not str(product_data.commercial_type or "").strip():
                raise ValueError(f"Producto {position}: selecciona un tipo de propuesta comercial antes de activarla.")

            if (
                product_data.commercial_active
                and str(product_data.commercial_type or "").strip().upper() == "OFERTA"
                and product_data.offer_price is None
            ):
                raise ValueError(f"Producto {position}: una oferta activa necesita un precio promocional.")

            new_product = Product(
                seller_id=seller_id,
                name=product_data.name,
                description=product_data.description,
                price=product_data.price,
                offer_price=product_data.offer_price,
                offer_active=product_data.offer_active,
                commercial_type=product_data.commercial_type,
                commercial_text=product_data.commercial_text,
                commercial_active=product_data.commercial_active,
                commercial_started_at=(
                    datetime.now(timezone.utc)
                    if product_data.commercial_active
                    else None
                ),
                stock=product_data.stock,
                category=product_data.category,
                subcategory=product_data.subcategory,
                brand=product_data.brand,
                avanter_enabled=product_data.avanter_enabled,
                image_url=product_data.image_url,
                publication_status="DRAFT",
                is_active=False,
            )
            db.add(new_product)
            new_products.append(new_product)

        db.commit()
        for product in new_products:
            db.refresh(product)
        return new_products
    except Exception:
        db.rollback()
        raise


def get_products(db: Session, skip: int = 0, limit: int = 100, filters: ProductFilter = None):
    query = (
        db.query(Product)
        .join(Store, Store.owner_id == Product.seller_id)
        .filter(
            Product.is_active == True,
            Product.publication_status == "PUBLISHED",
            Product.is_deleted == False,
            Store.is_active == True,
            Store.operational_status == "ACTIVE",
        )
    )
    
    if filters:
        if filters.name:
            query = query.filter(Product.name.ilike(f"%{filters.name}%"))
        if filters.category:
            query = query.filter(Product.category == filters.category)
        if filters.avanter_enabled is not None:
            query = query.filter(Product.avanter_enabled == filters.avanter_enabled)
        if filters.min_price is not None:
            query = query.filter(Product.price >= filters.min_price)
        if filters.max_price is not None:
            query = query.filter(Product.price <= filters.max_price)
    
    return (
        query
        .order_by(
            Product.commercial_active.desc(),
            case(
                (
                    Product.commercial_active == True,
                    Product.commercial_started_at,
                ),
                else_=None,
            ).desc().nullslast(),
            Product.created_at.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )

def get_product(db: Session, product_id: UUID):
    return (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.is_deleted == False,
        )
        .first()
    )


def count_products_for_admin(db: Session):
    return (
        db.query(Product)
        .filter(Product.is_deleted == False)
        .count()
    )


def get_products_for_admin(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    products = (
        db.query(Product)
        .filter(Product.is_deleted == False)
        .order_by(Product.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    seller_ids = {
        product.seller_id
        for product in products
        if product.seller_id is not None
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

    sellers_by_id = {
        seller.id: seller
        for seller in sellers
    }

    stores_by_owner = {
        store.owner_id: store
        for store in stores
    }

    result = []

    for product in products:
        seller = sellers_by_id.get(product.seller_id)
        store = stores_by_owner.get(product.seller_id)

        result.append({
            "product": product,
            "seller": (
                {
                    "id": seller.id,
                    "first_name": seller.first_name,
                    "last_name": seller.last_name,
                    "email": seller.email,
                    "role": seller.role,
                    "is_active": seller.is_active,
                }
                if seller
                else None
            ),
            "store": (
                {
                    "seller_id": store.owner_id,
                    "name": store.name,
                    "slug": store.slug,
                }
                if store
                else None
            ),
        })

    return result


def get_products_by_seller(db: Session, seller_id: UUID):
    return (
        db.query(Product)
        .filter(
            Product.seller_id == seller_id,
            Product.is_deleted == False,
        )
        .all()
    )

def update_product_by_seller(
    db: Session,
    product_id: UUID,
    seller_id: UUID,
    product_data: ProductUpdate,
):
    product = (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.seller_id == seller_id,
            Product.is_deleted == False,
        )
        .first()
    )

    if not product:
        return None

    updates = product_data.model_dump(exclude_unset=True)

    requested_publication_status = updates.get("publication_status")

    if requested_publication_status is not None:
        updates["is_active"] = requested_publication_status == "PUBLISHED"
    elif "is_active" in updates and updates["is_active"] is not None:
        updates["publication_status"] = (
            "PUBLISHED"
            if updates["is_active"]
            else "PAUSED"
        )

    resulting_price = updates.get("price", product.price)
    resulting_offer_price = updates.get("offer_price", product.offer_price)
    resulting_offer_active = updates.get("offer_active", product.offer_active)
    resulting_commercial_type = updates.get("commercial_type", product.commercial_type)
    resulting_commercial_text = updates.get("commercial_text", product.commercial_text)
    resulting_commercial_active = updates.get("commercial_active", product.commercial_active)

    commercial_content_changed = (
        (
            "commercial_type" in updates
            and resulting_commercial_type != product.commercial_type
        )
        or (
            "commercial_text" in updates
            and str(resulting_commercial_text or "").strip()
            != str(product.commercial_text or "").strip()
        )
        or (
            "offer_price" in updates
            and resulting_offer_price != product.offer_price
        )
    )

    refresh_commercial_started_at = (
        bool(resulting_commercial_active)
        and (
            not bool(product.commercial_active)
            or commercial_content_changed
        )
    )

    if resulting_offer_active:
        if resulting_offer_price is None:
            raise ValueError("Ingresa un precio de oferta antes de activarla.")
        if float(resulting_offer_price) >= float(resulting_price):
            raise ValueError("El precio de oferta debe ser menor que el precio normal.")

    if resulting_commercial_active and not str(resulting_commercial_type or "").strip():
        raise ValueError("Selecciona un tipo de propuesta comercial antes de activarla.")

    if (
        resulting_commercial_active
        and str(resulting_commercial_type or "").strip().upper() == "OFERTA"
        and resulting_offer_price is None
    ):
        raise ValueError("Una oferta activa necesita un precio promocional.")

    for field, value in updates.items():
        if field in {"offer_price", "commercial_type", "commercial_text"}:
            setattr(product, field, value)
        elif value is not None:
            setattr(product, field, value)

    if refresh_commercial_started_at:
        product.commercial_started_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(product)
    return product

def soft_delete_product_by_seller(
    db: Session,
    product_id: UUID,
    seller_id: UUID,
):
    product = (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.seller_id == seller_id,
            Product.is_deleted == False,
        )
        .first()
    )

    if not product:
        return None

    product.is_deleted = True
    product.is_active = False
    product.offer_active = False

    db.query(Banner).filter(
        Banner.product_id == product.id
    ).update(
        {Banner.is_active: False},
        synchronize_session=False,
    )

    db.commit()
    db.refresh(product)
    return product
