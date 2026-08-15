from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


# Esquema base (campos comunes)
class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    phone: Optional[str] = None
    role: str = "COMPRADOR"


# Esquema para recibir datos al REGISTRARSE
class UserCreate(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    phone: Optional[str] = None
    password: str = Field(..., min_length=8)


# Esquema para devolver datos al FRONTEND
# NUNCA devolvemos la contraseña
class UserResponse(UserBase):
    id: UUID
    is_active: bool
    email_verified: bool
    created_at: datetime
    avatar: Optional[str] = None

    class Config:
        from_attributes = True


# Esquema para el LOGIN
class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=32, max_length=200)
    new_password: str = Field(..., min_length=8, max_length=128)