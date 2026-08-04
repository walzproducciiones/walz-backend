import os
from sqlalchemy import create_engine, text
from backend.app.models.product import Product
from backend.app.database.session import Base

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

print("🔧 Verificando si la columna seller_id existe...")
with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='products' AND column_name='seller_id'
    """))
    if result.fetchone():
        print("✅ La columna seller_id ya existe.")
    else:
        print("❌ La columna seller_id NO existe. Recreando la tabla...")
        conn.execute(text("DROP TABLE IF EXISTS products CASCADE"))
        Base.metadata.create_all(engine)
        print("✅ Tabla products recreada con seller_id.")