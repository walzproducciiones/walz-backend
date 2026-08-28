from sqlalchemy import inspect, text


def ensure_product_promotion_columns(engine):
    """Add promotion columns to existing databases without deleting data."""
    inspector = inspect(engine)

    if "products" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("products")
    }

    with engine.begin() as connection:
        if "offer_price" not in existing_columns:
            connection.execute(text(
                "ALTER TABLE products ADD COLUMN offer_price FLOAT"
            ))

        if "offer_active" not in existing_columns:
            connection.execute(text(
                "ALTER TABLE products "
                "ADD COLUMN offer_active BOOLEAN NOT NULL DEFAULT FALSE"
            ))

        if "commercial_type" not in existing_columns:
            connection.execute(text(
                "ALTER TABLE products ADD COLUMN commercial_type VARCHAR(50)"
            ))

        if "commercial_text" not in existing_columns:
            connection.execute(text(
                "ALTER TABLE products ADD COLUMN commercial_text VARCHAR(200)"
            ))

        if "commercial_active" not in existing_columns:
            connection.execute(text(
                "ALTER TABLE products "
                "ADD COLUMN commercial_active BOOLEAN NOT NULL DEFAULT FALSE"
            ))

        if "commercial_started_at" not in existing_columns:
            timestamp_type = (
                "TIMESTAMP WITH TIME ZONE"
                if engine.dialect.name == "postgresql"
                else "DATETIME"
            )
            connection.execute(text(
                "ALTER TABLE products "
                f"ADD COLUMN commercial_started_at {timestamp_type}"
            ))

def ensure_product_subcategory_column(engine):
    """Add product subcategory without deleting existing product data."""
    inspector = inspect(engine)

    if "products" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("products")
    }

    with engine.begin() as connection:
        if "subcategory" not in existing_columns:
            connection.execute(text(
                "ALTER TABLE products ADD COLUMN subcategory VARCHAR(100)"
            ))

def ensure_product_brand_column(engine):
    """Add product brand without deleting existing product data."""
    inspector = inspect(engine)

    if "products" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("products")
    }

    with engine.begin() as connection:
        if "brand" not in existing_columns:
            connection.execute(text(
                "ALTER TABLE products ADD COLUMN brand VARCHAR(100)"
            ))


def ensure_product_avanter_column(engine):
    """Add Avanter product association without changing product classification."""
    inspector = inspect(engine)

    if "products" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("products")
    }

    with engine.begin() as connection:
        if "avanter_enabled" not in existing_columns:
            connection.execute(text(
                "ALTER TABLE products "
                "ADD COLUMN avanter_enabled BOOLEAN NOT NULL DEFAULT FALSE"
            ))


def ensure_product_deletion_column(engine):
    """Add logical product deletion without removing historical data."""
    inspector = inspect(engine)

    if "products" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("products")
    }

    with engine.begin() as connection:
        if "is_deleted" not in existing_columns:
            connection.execute(text(
                "ALTER TABLE products "
                "ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE"
            ))


def ensure_admin_user(engine, admin_email):
    """Promote only the configured owner account to administrator."""
    normalized_email = str(admin_email or "").strip().lower()
    if not normalized_email:
        return

    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE users SET role = 'ADMIN' "
                "WHERE LOWER(email) = :admin_email"
            ),
            {"admin_email": normalized_email},
        )

def ensure_banner_proposal_columns(engine):
    inspector = inspect(engine)
    if "banners" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("banners")
    }

    definitions = {
        "seller_id": "UUID",
        "product_id": "UUID",
        "approval_status": "VARCHAR(20) NOT NULL DEFAULT 'approved'",
        "reviewed_by": "UUID",
        "reviewed_at": "TIMESTAMP",
    }

    with engine.begin() as connection:
        for column_name, definition in definitions.items():
            if column_name not in existing_columns:
                connection.execute(text(
                    f"ALTER TABLE banners ADD COLUMN {column_name} {definition}"
                ))

def ensure_user_terms_columns(engine):
    """Add terms acceptance evidence without changing existing accounts."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    with engine.begin() as connection:
        if "terms_accepted_at" not in existing_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMP"))
        if "terms_version" not in existing_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN terms_version VARCHAR(40)"))

def ensure_store_slug_column(engine):
    """Add public store slug without deleting or modifying existing store data."""
    inspector = inspect(engine)
    if "stores" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("stores")}
    with engine.begin() as connection:
        if "slug" not in existing_columns:
            connection.execute(text("ALTER TABLE stores ADD COLUMN slug VARCHAR(180)"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_stores_slug ON stores (slug)"))

def ensure_store_avanter_columns(engine):
    """Add optional Avanter program fields without changing store categories."""
    inspector = inspect(engine)

    if "stores" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("stores")
    }

    definitions = {
        "avanter_enabled": "BOOLEAN NOT NULL DEFAULT FALSE",
        "avanter_title": "VARCHAR(160)",
        "avanter_text": "TEXT",
        "avanter_image_url": "VARCHAR(500)",
    }

    with engine.begin() as connection:
        for column_name, definition in definitions.items():
            if column_name not in existing_columns:
                connection.execute(text(
                    f"ALTER TABLE stores ADD COLUMN {column_name} {definition}"
                ))


def ensure_store_delivery_columns(engine):
    """Add store delivery choices without changing existing behavior."""
    inspector = inspect(engine)
    if "stores" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("stores")}
    with engine.begin() as connection:
        if "delivery_enabled" not in existing_columns:
            connection.execute(text(
                "ALTER TABLE stores ADD COLUMN delivery_enabled BOOLEAN NOT NULL DEFAULT TRUE"
            ))
        if "pickup_enabled" not in existing_columns:
            connection.execute(text(
                "ALTER TABLE stores ADD COLUMN pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE"
            ))

def ensure_store_operational_status_columns(engine):
    """Add store operational status fields without changing existing store data."""
    inspector = inspect(engine)

    if "stores" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("stores")
    }

    timestamp_type = (
        "TIMESTAMP WITH TIME ZONE"
        if engine.dialect.name == "postgresql"
        else "DATETIME"
    )

    definitions = {
        "operational_status": "VARCHAR(40) NOT NULL DEFAULT 'ACTIVE'",
        "status_reason": "TEXT",
        "status_changed_at": timestamp_type,
    }

    with engine.begin() as connection:
        for column_name, definition in definitions.items():
            if column_name not in existing_columns:
                connection.execute(text(
                    f"ALTER TABLE stores ADD COLUMN {column_name} {definition}"
                ))



def ensure_store_business_categories_column(engine):
    """Add multiple business categories to stores without deleting existing data."""
    inspector = inspect(engine)

    if "stores" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("stores")
    }

    if "business_categories" in existing_columns:
        return

    with engine.begin() as connection:
        if engine.dialect.name == "postgresql":
            connection.execute(text(
                "ALTER TABLE stores "
                "ADD COLUMN business_categories JSONB NOT NULL DEFAULT '[]'::jsonb"
            ))
        else:
            connection.execute(text(
                "ALTER TABLE stores "
                "ADD COLUMN business_categories TEXT NOT NULL DEFAULT '[]'"
            ))


def ensure_order_pickup_columns(engine):
    """Add safe pickup confirmations without modifying existing orders."""
    inspector = inspect(engine)
    if "orders" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("orders")}
    definitions = {
        "pickup_status": "VARCHAR(30)",
        "pickup_ready_at": "TIMESTAMP",
        "pickup_buyer_going_at": "TIMESTAMP",
        "pickup_buyer_arrived_at": "TIMESTAMP",
        "pickup_seller_handed_at": "TIMESTAMP",
        "pickup_buyer_received_at": "TIMESTAMP",
        "delivery_plan_status": "VARCHAR(30)",
        "delivery_buyer_requested_date": "DATE",
        "delivery_buyer_requested_window": "VARCHAR(60)",
        "delivery_transport_type": "VARCHAR(30)",
        "delivery_estimated_date": "DATE",
        "delivery_time_window": "VARCHAR(60)",
        "delivery_scheduled_at": "TIMESTAMP",
        "courier_name": "VARCHAR(120)",
        "courier_phone": "VARCHAR(40)",
        "courier_photo_url": "VARCHAR(500)",
        "courier_vehicle": "VARCHAR(120)",
        "carrier_company": "VARCHAR(120)",
        "delivery_tracking_code": "VARCHAR(120)",
        "courier_assigned_at": "TIMESTAMP",
    }
    with engine.begin() as connection:
        for column_name, definition in definitions.items():
            if column_name not in existing_columns:
                connection.execute(text(
                    f"ALTER TABLE orders ADD COLUMN {column_name} {definition}"
                ))

def ensure_seller_application_business_categories_column(engine):
    """Add seller business categories without deleting existing applications."""
    inspector = inspect(engine)

    if "seller_applications" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("seller_applications")
    }

    if "business_categories" in existing_columns:
        return

    with engine.begin() as connection:
        if engine.dialect.name == "postgresql":
            connection.execute(text(
                "ALTER TABLE seller_applications "
                "ADD COLUMN business_categories JSONB NOT NULL DEFAULT '[]'::jsonb"
            ))
        else:
            connection.execute(text(
                "ALTER TABLE seller_applications "
                "ADD COLUMN business_categories TEXT NOT NULL DEFAULT '[]'"
            ))


def ensure_order_confirmed_status(engine):
    """
    Rename the historical commercial order status PAID to CONFIRMED.

    PAID was previously used to mean that the seller had confirmed
    the order. Real financial payment status is handled separately.
    Existing orders are preserved.
    """
    inspector = inspect(engine)

    if "orders" not in inspector.get_table_names():
        return

    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            labels = {
                row[0]
                for row in connection.execute(text("""
                    SELECT e.enumlabel
                    FROM pg_type t
                    JOIN pg_enum e
                      ON t.oid = e.enumtypid
                    WHERE t.typname = 'orderstatus'
                """))
            }

            if "PAID" in labels and "CONFIRMED" not in labels:
                connection.execute(text(
                    "ALTER TYPE orderstatus "
                    "RENAME VALUE 'PAID' TO 'CONFIRMED'"
                ))

        return

    with engine.begin() as connection:
        connection.execute(text(
            "UPDATE orders "
            "SET status = 'CONFIRMED' "
            "WHERE status = 'PAID'"
        ))



def ensure_order_financial_snapshot_columns(engine):
    """
    Add financial/store snapshot fields for new orders.

    Existing orders are deliberately preserved with NULL values.
    No historical monetary values are inferred or fabricated.

    Existing SQLite databases receive the store_id index but are
    not rebuilt only to retrofit a foreign-key declaration.
    PostgreSQL receives both the index and the real FK constraint.
    Fresh databases created from SQLAlchemy metadata already contain
    the model-level FK and index.
    """
    inspector = inspect(engine)

    if "orders" not in inspector.get_table_names():
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("orders")
    }

    definitions = {
        "store_id": "UUID",
        "fulfillment_method": "VARCHAR(20)",
        "items_subtotal": "NUMERIC(14, 2)",
        "shipping_amount": "NUMERIC(14, 2)",
        "discount_amount": "NUMERIC(14, 2)",
        "payable_amount": "NUMERIC(14, 2)",
        "currency": "VARCHAR(3)",
    }

    with engine.begin() as connection:
        for column_name, definition in definitions.items():
            if column_name not in existing_columns:
                connection.execute(text(
                    f"ALTER TABLE orders "
                    f"ADD COLUMN {column_name} {definition}"
                ))

        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS "
            "ix_orders_store_id "
            "ON orders (store_id)"
        ))

    # SQLite cannot add a new FK constraint to an existing table
    # without rebuilding the complete table. Do not perform that
    # invasive operation on the local historical database.
    if engine.dialect.name != "postgresql":
        return

    refreshed_inspector = inspect(engine)

    store_fk_exists = any(
        foreign_key.get("referred_table") == "stores"
        and foreign_key.get("constrained_columns") == ["store_id"]
        for foreign_key
        in refreshed_inspector.get_foreign_keys("orders")
    )

    if store_fk_exists:
        return

    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE orders "
            "ADD CONSTRAINT fk_orders_store_id_stores "
            "FOREIGN KEY (store_id) "
            "REFERENCES stores(id)"
        ))
