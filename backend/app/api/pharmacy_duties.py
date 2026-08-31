from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.auth import (
    get_current_user,
    require_admin_user,
)
from backend.app.database.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.pharmacy_duty import (
    PharmacyCreate,
    PharmacyDutyAreaCreate,
    PharmacyDutyAreaResponse,
    PharmacyDutyAreaUpdate,
    PharmacyDutyAssignmentCreate,
    PharmacyDutyAssignmentResponse,
    PharmacyDutyAssignmentUpdate,
    PharmacyDutyPublicItem,
    PharmacyDutyReplacementCreate,
    PharmacyDutyReplacementResponse,
    PharmacyDutyReplacementUpdate,
    PharmacyResponse,
    PharmacyUpdate,
)
from backend.app.services.pharmacy_duty_service import (
    create_assignment,
    create_duty_area,
    create_pharmacy,
    create_replacement,
    get_assignment,
    get_pharmacy_by_owner,
    get_public_duties_for_date,
    get_public_duties_today,
    get_replacement,
    list_assignments,
    list_duty_areas,
    list_pharmacies,
    list_replacements,
    update_assignment,
    update_duty_area,
    update_pharmacy,
    update_replacement,
)


router = APIRouter(
    prefix="/pharmacy-duties",
    tags=["Pharmacy duties"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def _role(current_user: User) -> str:
    return str(current_user.role or "").upper()


def _require_duty_publisher(
    db: Session,
    current_user: User,
):
    role = _role(current_user)

    if role == "ADMIN":
        return None

    if role not in {"VENDEDOR", "SELLER"}:
        raise HTTPException(
            status_code=403,
            detail=(
                "Se requiere una farmacia habilitada "
                "para publicar turnos."
            ),
        )

    pharmacy = get_pharmacy_by_owner(
        db,
        current_user.id,
    )

    if not pharmacy or not pharmacy.is_active:
        raise HTTPException(
            status_code=403,
            detail=(
                "Tu tienda no esta vinculada a una "
                "farmacia habilitada para publicar turnos."
            ),
        )

    return pharmacy


def _require_record_publisher(
    record,
    current_user: User,
):
    if _role(current_user) == "ADMIN":
        return

    if (
        record.published_by_user_id
        != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Solo podes modificar los turnos "
                "que publicaste desde tu cuenta."
            ),
        )


# ============================================================
# PUBLICO
# ============================================================


@router.get(
    "/public/pharmacies",
    response_model=list[PharmacyResponse],
)
def get_public_pharmacies(
    db: Session = Depends(get_db),
):
    return list_pharmacies(
        db,
        include_inactive=False,
    )


@router.get(
    "/public/areas",
    response_model=list[PharmacyDutyAreaResponse],
)
def get_public_duty_areas(
    db: Session = Depends(get_db),
):
    return list_duty_areas(
        db,
        include_inactive=False,
    )


@router.get(
    "/public/today",
    response_model=list[PharmacyDutyPublicItem],
)
def get_public_duties_today_endpoint(
    area_id: UUID | None = None,
    db: Session = Depends(get_db),
):
    try:
        return get_public_duties_today(
            db,
            area_id=area_id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )


@router.get(
    "/public/date/{target_date}",
    response_model=list[PharmacyDutyPublicItem],
)
def get_public_duties_by_date(
    target_date: date,
    area_id: UUID | None = None,
    db: Session = Depends(get_db),
):
    try:
        return get_public_duties_for_date(
            db,
            target_date,
            area_id=area_id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )


# ============================================================
# ADMIN - REGISTRO DE FARMACIAS
# ============================================================


@router.get(
    "/admin/pharmacies",
    response_model=list[PharmacyResponse],
)
def get_admin_pharmacies(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    return list_pharmacies(
        db,
        include_inactive=True,
    )


@router.post(
    "/admin/pharmacies",
    response_model=PharmacyResponse,
)
def create_admin_pharmacy(
    data: PharmacyCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        return create_pharmacy(
            db,
            data,
            created_by_user_id=admin.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@router.patch(
    "/admin/pharmacies/{pharmacy_id}",
    response_model=PharmacyResponse,
)
def update_admin_pharmacy(
    pharmacy_id: UUID,
    data: PharmacyUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        return update_pharmacy(
            db,
            pharmacy_id,
            data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


# ============================================================
# ADMIN - ZONAS DE TURNOS
# ============================================================


@router.get(
    "/admin/areas",
    response_model=list[PharmacyDutyAreaResponse],
)
def get_admin_duty_areas(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    return list_duty_areas(
        db,
        include_inactive=True,
    )


@router.post(
    "/admin/areas",
    response_model=PharmacyDutyAreaResponse,
)
def create_admin_duty_area(
    data: PharmacyDutyAreaCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        return create_duty_area(
            db,
            data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@router.patch(
    "/admin/areas/{area_id}",
    response_model=PharmacyDutyAreaResponse,
)
def update_admin_duty_area(
    area_id: UUID,
    data: PharmacyDutyAreaUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        return update_duty_area(
            db,
            area_id,
            data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


# ============================================================
# PUBLICADORES HABILITADOS
# ============================================================


@router.get(
    "/manage/pharmacies",
    response_model=list[PharmacyResponse],
)
def get_manage_pharmacies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_duty_publisher(
        db,
        current_user,
    )

    return list_pharmacies(
        db,
        include_inactive=False,
    )


@router.get(
    "/manage/areas",
    response_model=list[PharmacyDutyAreaResponse],
)
def get_manage_duty_areas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_duty_publisher(
        db,
        current_user,
    )

    return list_duty_areas(
        db,
        include_inactive=False,
    )


@router.get(
    "/manage/assignments",
    response_model=list[PharmacyDutyAssignmentResponse],
)
def get_manage_assignments(
    area_id: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_duty_publisher(
        db,
        current_user,
    )

    return list_assignments(
        db,
        area_id=area_id,
    )


@router.post(
    "/manage/assignments",
    response_model=PharmacyDutyAssignmentResponse,
)
def create_manage_assignment(
    data: PharmacyDutyAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_duty_publisher(
        db,
        current_user,
    )

    try:
        return create_assignment(
            db,
            data,
            published_by_user_id=current_user.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@router.patch(
    "/manage/assignments/{assignment_id}",
    response_model=PharmacyDutyAssignmentResponse,
)
def update_manage_assignment(
    assignment_id: UUID,
    data: PharmacyDutyAssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_duty_publisher(
        db,
        current_user,
    )

    assignment = get_assignment(
        db,
        assignment_id,
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Turno no encontrado.",
        )

    _require_record_publisher(
        assignment,
        current_user,
    )

    try:
        return update_assignment(
            db,
            assignment_id,
            data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@router.get(
    "/manage/assignments/{assignment_id}/replacements",
    response_model=list[PharmacyDutyReplacementResponse],
)
def get_manage_replacements(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_duty_publisher(
        db,
        current_user,
    )

    assignment = get_assignment(
        db,
        assignment_id,
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Turno no encontrado.",
        )

    return list_replacements(
        db,
        assignment_id,
    )


@router.post(
    "/manage/assignments/{assignment_id}/replacements",
    response_model=PharmacyDutyReplacementResponse,
)
def create_manage_replacement(
    assignment_id: UUID,
    data: PharmacyDutyReplacementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_duty_publisher(
        db,
        current_user,
    )

    assignment = get_assignment(
        db,
        assignment_id,
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Turno no encontrado.",
        )

    _require_record_publisher(
        assignment,
        current_user,
    )

    try:
        return create_replacement(
            db,
            assignment_id,
            data,
            published_by_user_id=current_user.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@router.patch(
    "/manage/replacements/{replacement_id}",
    response_model=PharmacyDutyReplacementResponse,
)
def update_manage_replacement(
    replacement_id: UUID,
    data: PharmacyDutyReplacementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_duty_publisher(
        db,
        current_user,
    )

    replacement = get_replacement(
        db,
        replacement_id,
    )

    if not replacement:
        raise HTTPException(
            status_code=404,
            detail="Reemplazo no encontrado.",
        )

    _require_record_publisher(
        replacement,
        current_user,
    )

    try:
        return update_replacement(
            db,
            replacement_id,
            data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


# ============================================================
# ADMIN - TURNOS
# ============================================================


@router.get(
    "/admin/assignments",
    response_model=list[PharmacyDutyAssignmentResponse],
)
def get_admin_assignments(
    area_id: UUID | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    return list_assignments(
        db,
        area_id=area_id,
    )


@router.post(
    "/admin/assignments",
    response_model=PharmacyDutyAssignmentResponse,
)
def create_admin_assignment(
    data: PharmacyDutyAssignmentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        return create_assignment(
            db,
            data,
            published_by_user_id=admin.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@router.patch(
    "/admin/assignments/{assignment_id}",
    response_model=PharmacyDutyAssignmentResponse,
)
def update_admin_assignment(
    assignment_id: UUID,
    data: PharmacyDutyAssignmentUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        return update_assignment(
            db,
            assignment_id,
            data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@router.get(
    "/admin/assignments/{assignment_id}/replacements",
    response_model=list[PharmacyDutyReplacementResponse],
)
def get_admin_replacements(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    assignment = get_assignment(
        db,
        assignment_id,
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Turno no encontrado.",
        )

    return list_replacements(
        db,
        assignment_id,
    )


@router.post(
    "/admin/assignments/{assignment_id}/replacements",
    response_model=PharmacyDutyReplacementResponse,
)
def create_admin_replacement(
    assignment_id: UUID,
    data: PharmacyDutyReplacementCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        return create_replacement(
            db,
            assignment_id,
            data,
            published_by_user_id=admin.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@router.patch(
    "/admin/replacements/{replacement_id}",
    response_model=PharmacyDutyReplacementResponse,
)
def update_admin_replacement(
    replacement_id: UUID,
    data: PharmacyDutyReplacementUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        return update_replacement(
            db,
            replacement_id,
            data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )
