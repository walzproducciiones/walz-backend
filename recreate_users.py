import os
from sqlalchemy import create_engine, text
from backend.app.models.user import User
from backend.app.database.session import Base

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

print("⚠️ Eliminando y recreando la tabla users con el esquema actual...")
with engine.connect() as conn:
    conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
    Base.metadata.create_all(engine)
print("✅ Tabla users recreada correctamente con first_name y last_name.")