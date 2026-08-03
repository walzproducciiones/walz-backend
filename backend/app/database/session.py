from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Lectura de la variable de entorno
DATABASE_URL = os.getenv("DATABASE_URL")

# Si estás en local sin variable, usas SQLite (para pruebas rápidas)
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./walz_local.db"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()