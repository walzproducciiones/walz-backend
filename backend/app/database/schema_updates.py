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