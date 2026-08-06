from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.app.api import auth, products, orders, payments
from backend.app.database.session import engine
from backend.app.models import user, product, order

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
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

# --- Incluir los routers ---
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(payments.router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "WalZ One API is running"}