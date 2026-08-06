from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from backend.app.api import auth, products, orders, payments
from backend.app.models import user, product, order

# --- Configuración de la base de datos (SQLite) ---
# Con SQLite no necesitas URL externa, Render no tiene conflictos de conexión.
DATABASE_URL = "sqlite:///./walz_local.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Crear las tablas en la base de datos (si no existen)
user.Base.metadata.create_all(bind=engine)
product.Base.metadata.create_all(bind=engine)
order.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WalZ One API")

# Configuración CORS
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "https://walz-backend.onrender.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Servir el frontend desde la raíz ---
# FastAPI servirá index.html, app.js, style.css, order-success.html

# --- Incluir los routers ---
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "WalZ One API is running"}