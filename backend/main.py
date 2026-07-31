from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Text, UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext  # ✅ ESTE IMPORT FALTABA
import bcrypt
import uuid
from pydantic import BaseModel

# Configuración de la base de datos
DATABASE_URL = "postgresql://postgres:admin@localhost:5432/walz_db"
SECRET_KEY = "MI_CLAVE_SECRETA_CAMBIALA"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

# Crear la aplicación FastAPI
app = FastAPI(title="WalZ One")

# CORS para permitir conexión desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración de la base de datos
Base = declarative_base()
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Seguridad
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Modelos de base de datos
class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    business_name = Column(String, nullable=False)
    phone = Column(String)
    created_at = Column(DateTime, default=datetime.now)

class Product(Base):
    __tablename__ = "products"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    stock = Column(Integer, default=0)
    image_url = Column(String)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

# Modelos Pydantic
class UserCreate(BaseModel):
    email: str
    password: str
    business_name: str

class ProductCreate(BaseModel):
    name: str
    price: float
    description: str = ""
    stock: int = 0

# Crear tablas
Base.metadata.create_all(bind=engine)

# Funciones de autenticación
def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    plain_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_bytes, hashed_bytes)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
        if user is None:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

# Endpoints
@app.get("/")
def root():
    return {"message": "¡WalZ One está funcionando! 🚀"}

@app.post("/api/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(User).filter(User.email == user.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email ya registrado")
        hashed = hash_password(user.password)
        new_user = User(
            email=user.email,
            password_hash=hashed,
            business_name=user.business_name
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {"message": "Usuario creado", "user_id": str(new_user.id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer", "user_id": str(user.id)}

@app.get("/api/products")
def get_products(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.user_id == current_user.id).all()
    return products

@app.post("/api/products")
def create_product(
    product: ProductCreate,
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    new_product = Product(
        user_id=current_user.id,
        name=product.name,
        description=product.description,
        price=product.price,
        stock=product.stock,
        status="active"
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return {"message": "Producto creado", "product_id": str(new_product.id), "product": new_product}