from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from backend.app.api import auth, products, orders, payments
from backend.app.database.session import engine
from backend.app.database.schema_updates import (
    ensure_admin_user,
    ensure_product_promotion_columns,
)

from backend.app.models import user, product, order


# ============================================================
# CREAR TABLAS
# ============================================================

user.Base.metadata.create_all(bind=engine)
product.Base.metadata.create_all(bind=engine)
order.Base.metadata.create_all(bind=engine)
ensure_product_promotion_columns(engine)
ensure_admin_user(engine, os.getenv("WALZ_ADMIN_EMAIL"))


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="WalZ One API",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

origins = [
    "https://walz-frontend.onrender.com",
    "https://walz-backend.onrender.com",
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROUTERS
# ============================================================

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(payments.router)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "message": "WalZ One API is running"
    }


# ============================================================
# FRONTEND
# ============================================================

app.mount(
    "/",
    StaticFiles(
        directory="frontend",
        html=True
    ),
    name="frontend"
)