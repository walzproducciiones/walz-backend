from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.auth import require_admin_user
from backend.app.database.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.institutional_setting import (
    InstitutionalSettingPublicResponse,
    InstitutionalSettingResponse,
    InstitutionalSettingUpdate,
)
from backend.app.services.institutional_setting_service import (
    get_institutional_setting,
    save_institutional_setting,
)


router = APIRouter(
    prefix="/institutional-settings",
    tags=["Institutional Settings"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



@router.get("/public", response_model=InstitutionalSettingPublicResponse | None)
def get_public_institutional_setting(
    db: Session = Depends(get_db),
):
    return get_institutional_setting(db)


@router.get("/admin", response_model=InstitutionalSettingResponse | None)
def get_admin_institutional_setting(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    return get_institutional_setting(db)


@router.put("/admin", response_model=InstitutionalSettingResponse)
def update_admin_institutional_setting(
    data: InstitutionalSettingUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        return save_institutional_setting(db, data)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
