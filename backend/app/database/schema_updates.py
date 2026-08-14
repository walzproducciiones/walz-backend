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