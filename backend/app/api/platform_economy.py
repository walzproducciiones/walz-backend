from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.api.auth import require_admin_user
from backend.app.database.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.economic_ledger import (
    EconomicLedgerAdminResponse,
    EconomicLedgerAdminSummaryResponse,
)
from backend.app.schemas.platform_economy_setting import (
    PlatformEconomySettingResponse,
    PlatformEconomySettingUpdate,
)
from backend.app.services.economic_ledger_admin_service import (
    get_economic_ledger_for_admin,
    get_economic_ledger_summary_for_admin,
)
from backend.app.services.platform_economy_service import (
    get_platform_economy_setting,
    save_platform_economy_setting,
)


router = APIRouter(
    prefix="/economy",
    tags=["Economy"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get(
    "/admin",
    response_model=PlatformEconomySettingResponse | None,
)
def get_admin_economy_setting(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    return get_platform_economy_setting(db)


@router.put(
    "/admin",
    response_model=PlatformEconomySettingResponse,
)
def update_admin_economy_setting(
    data: PlatformEconomySettingUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        return save_platform_economy_setting(
            db,
            data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

@router.get(
    "/admin/summary",
    response_model=EconomicLedgerAdminSummaryResponse,
)
def get_admin_economic_summary(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    return get_economic_ledger_summary_for_admin(db)


@router.get(
    "/admin/ledger",
    response_model=list[EconomicLedgerAdminResponse],
)
def get_admin_economic_ledger(
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    return get_economic_ledger_for_admin(
        db,
        limit=limit,
        offset=offset,
    )
