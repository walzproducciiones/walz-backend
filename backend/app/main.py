from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api import auth
from app.database.session import engine
from app.models import user
from app.api import auth, products, orders

# Crear las tablas en la base de datos (si no existen)
user.Base.metadata.create_all(bind=engine)

app = FastAPI(title="WalZ One API")

# Configuración CORS (Permite conexiones desde tu frontend)
origins = ["*", "null"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir las rutas de autenticación
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(orders.router)

@app.get("/")
def read_root():
    return {"message": "¡WalZ One está funcionando! 🚀"}