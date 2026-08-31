from datetime import date, datetime, time, timezone
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from backend.app.models.pharmacy_duty import (
    Pharmacy,
    PharmacyDutyArea,
    PharmacyDutyAssignment,
    PharmacyDutyReplacement,
)
from backend.app.models.store import Store


def _normalize_text(value, max_length: int):
    normalized = " ".join(str(value or "").strip().split())

    if not normalized:
        return None

    if len(normalized) > max_length:
        raise ValueError(
            f"El texto puede tener hasta {max_length} caracteres."
        )

    return normalized


def _normalize_country_code(value):
    normalized = str(value or "").strip().upper()

    if not normalized:
        return None

    if len(normalized) != 2:
        raise ValueError(
            "El codigo de pais debe tener 2 caracteres."
        )

    return normalized


def _validate_timezone(timezone_name: str) -> str:
    value = str(timezone_name or "").strip()

    if not value:
        raise ValueError("Selecciona una zona horaria.")

    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError:
        raise ValueError(
            "La zona horaria seleccionada no es valida."
        )

    return value


def _to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError(
            "La fecha y hora debe incluir su zona horaria."
        )

    return value.astimezone(timezone.utc)


def _db_datetime_as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def _validate_range(
    starts_at: datetime,
    ends_at: datetime,
):
    starts_utc = _to_utc(starts_at)
    ends_utc = _to_utc(ends_at)

    if ends_utc <= starts_utc:
        raise ValueError(
            "La fecha final debe ser posterior a la inicial."
        )

    return starts_utc, ends_utc


def _pharmacy_payload_values(data, *, partial: bool):
    values = data.model_dump(exclude_unset=partial)

    if "name" in values:
        name = _normalize_text(values["name"], 160)

        if not name:
            raise ValueError(
                "La farmacia necesita un nombre."
            )

        values["name"] = name

    for field, max_length in (
        ("phone", 40),
        ("whatsapp", 40),
        ("email", 200),
        ("address", 250),
        ("locality", 120),
        ("region", 120),
    ):
        if field in values:
            values[field] = _normalize_text(
                values[field],
                max_length,
            )

    if "country_code" in values:
        values["country_code"] = _normalize_country_code(
            values["country_code"]
        )

    if "timezone" in values:
        values["timezone"] = _validate_timezone(
            values["timezone"]
        )

    return values


def _area_payload_values(data, *, partial: bool):
    values = data.model_dump(exclude_unset=partial)

    if "name" in values:
        name = _normalize_text(values["name"], 160)

        if not name:
            raise ValueError(
                "La zona de turnos necesita un nombre."
            )

        values["name"] = name

    for field, max_length in (
        ("locality", 120),
        ("region", 120),
    ):
        if field in values:
            values[field] = _normalize_text(
                values[field],
                max_length,
            )

    if "country_code" in values:
        values["country_code"] = _normalize_country_code(
            values["country_code"]
        )

    if "timezone" in values:
        values["timezone"] = _validate_timezone(
            values["timezone"]
        )

    return values


def get_pharmacy(
    db: Session,
    pharmacy_id: UUID,
):
    return (
        db.query(Pharmacy)
        .filter(Pharmacy.id == pharmacy_id)
        .first()
    )


def get_pharmacy_by_store(
    db: Session,
    store_id: UUID,
):
    return (
        db.query(Pharmacy)
        .filter(Pharmacy.store_id == store_id)
        .first()
    )


def get_pharmacy_by_owner(
    db: Session,
    owner_id: UUID,
):
    return (
        db.query(Pharmacy)
        .join(
            Store,
            Pharmacy.store_id == Store.id,
        )
        .filter(Store.owner_id == owner_id)
        .first()
    )


def list_pharmacies(
    db: Session,
    *,
    include_inactive: bool = False,
):
    query = db.query(Pharmacy)

    if not include_inactive:
        query = query.filter(
            Pharmacy.is_active.is_(True)
        )

    return query.order_by(
        Pharmacy.name.asc()
    ).all()


def create_pharmacy(
    db: Session,
    data,
    *,
    created_by_user_id: UUID | None = None,
):
    values = _pharmacy_payload_values(
        data,
        partial=False,
    )

    store_id = values.get("store_id")

    if store_id is not None:
        store = (
            db.query(Store)
            .filter(Store.id == store_id)
            .first()
        )

        if not store:
            raise ValueError(
                "La tienda vinculada no existe."
            )

        existing = get_pharmacy_by_store(
            db,
            store_id,
        )

        if existing:
            raise ValueError(
                "Esa tienda ya esta vinculada "
                "a una farmacia."
            )

    pharmacy = Pharmacy(
        **values,
        created_by_user_id=created_by_user_id,
    )

    db.add(pharmacy)
    db.commit()
    db.refresh(pharmacy)

    return pharmacy


def update_pharmacy(
    db: Session,
    pharmacy_id: UUID,
    data,
):
    pharmacy = get_pharmacy(
        db,
        pharmacy_id,
    )

    if not pharmacy:
        raise ValueError(
            "Farmacia no encontrada."
        )

    values = _pharmacy_payload_values(
        data,
        partial=True,
    )

    if "store_id" in values:
        store_id = values["store_id"]

        if store_id is not None:
            store = (
                db.query(Store)
                .filter(Store.id == store_id)
                .first()
            )

            if not store:
                raise ValueError(
                    "La tienda vinculada no existe."
                )

            existing = get_pharmacy_by_store(
                db,
                store_id,
            )

            if (
                existing
                and existing.id != pharmacy.id
            ):
                raise ValueError(
                    "Esa tienda ya esta vinculada "
                    "a otra farmacia."
                )

    for field, value in values.items():
        setattr(pharmacy, field, value)

    db.commit()
    db.refresh(pharmacy)

    return pharmacy


def get_duty_area(
    db: Session,
    area_id: UUID,
):
    return (
        db.query(PharmacyDutyArea)
        .filter(PharmacyDutyArea.id == area_id)
        .first()
    )


def list_duty_areas(
    db: Session,
    *,
    include_inactive: bool = False,
):
    query = db.query(PharmacyDutyArea)

    if not include_inactive:
        query = query.filter(
            PharmacyDutyArea.is_active.is_(True)
        )

    return query.order_by(
        PharmacyDutyArea.name.asc()
    ).all()


def create_duty_area(
    db: Session,
    data,
):
    values = _area_payload_values(
        data,
        partial=False,
    )

    area = PharmacyDutyArea(**values)

    db.add(area)
    db.commit()
    db.refresh(area)

    return area


def update_duty_area(
    db: Session,
    area_id: UUID,
    data,
):
    area = get_duty_area(
        db,
        area_id,
    )

    if not area:
        raise ValueError(
            "Zona de turnos no encontrada."
        )

    values = _area_payload_values(
        data,
        partial=True,
    )

    for field, value in values.items():
        setattr(area, field, value)

    db.commit()
    db.refresh(area)

    return area


def get_assignment(
    db: Session,
    assignment_id: UUID,
):
    return (
        db.query(PharmacyDutyAssignment)
        .filter(
            PharmacyDutyAssignment.id
            == assignment_id
        )
        .first()
    )


def list_assignments(
    db: Session,
    *,
    area_id: UUID | None = None,
):
    query = db.query(
        PharmacyDutyAssignment
    )

    if area_id is not None:
        query = query.filter(
            PharmacyDutyAssignment.area_id
            == area_id
        )

    return query.order_by(
        PharmacyDutyAssignment.starts_at.asc()
    ).all()


def create_assignment(
    db: Session,
    data,
    *,
    published_by_user_id: UUID | None = None,
):
    pharmacy = get_pharmacy(
        db,
        data.pharmacy_id,
    )

    if not pharmacy or not pharmacy.is_active:
        raise ValueError(
            "La farmacia seleccionada no esta disponible."
        )

    area = get_duty_area(
        db,
        data.area_id,
    )

    if not area or not area.is_active:
        raise ValueError(
            "La zona de turnos no esta disponible."
        )

    starts_at, ends_at = _validate_range(
        data.starts_at,
        data.ends_at,
    )

    assignment = PharmacyDutyAssignment(
        pharmacy_id=data.pharmacy_id,
        area_id=data.area_id,
        starts_at=starts_at,
        ends_at=ends_at,
        status="SCHEDULED",
        public_note=_normalize_text(
            data.public_note,
            1000,
        ),
        published_by_user_id=published_by_user_id,
    )

    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    return assignment


def update_assignment(
    db: Session,
    assignment_id: UUID,
    data,
):
    assignment = get_assignment(
        db,
        assignment_id,
    )

    if not assignment:
        raise ValueError(
            "Turno no encontrado."
        )

    values = data.model_dump(
        exclude_unset=True
    )

    starts_at = values.get(
        "starts_at",
        _db_datetime_as_utc(
            assignment.starts_at
        ),
    )
    ends_at = values.get(
        "ends_at",
        _db_datetime_as_utc(
            assignment.ends_at
        ),
    )

    starts_at, ends_at = _validate_range(
        starts_at,
        ends_at,
    )

    assignment.starts_at = starts_at
    assignment.ends_at = ends_at

    if "status" in values:
        assignment.status = values["status"]

    if "public_note" in values:
        assignment.public_note = _normalize_text(
            values["public_note"],
            1000,
        )

    active_replacements = (
        db.query(PharmacyDutyReplacement)
        .filter(
            PharmacyDutyReplacement.assignment_id
            == assignment.id,
            PharmacyDutyReplacement.status
            == "ACTIVE",
        )
        .all()
    )

    for replacement in active_replacements:
        replacement_start = _db_datetime_as_utc(
            replacement.starts_at
        )
        replacement_end = _db_datetime_as_utc(
            replacement.ends_at
        )

        if (
            replacement_start < starts_at
            or replacement_end > ends_at
        ):
            raise ValueError(
                "El nuevo horario del turno deja "
                "un reemplazo fuera de su rango."
            )

    db.commit()
    db.refresh(assignment)

    return assignment


def get_replacement(
    db: Session,
    replacement_id: UUID,
):
    return (
        db.query(PharmacyDutyReplacement)
        .filter(
            PharmacyDutyReplacement.id
            == replacement_id
        )
        .first()
    )


def list_replacements(
    db: Session,
    assignment_id: UUID,
):
    return (
        db.query(PharmacyDutyReplacement)
        .filter(
            PharmacyDutyReplacement.assignment_id
            == assignment_id
        )
        .order_by(
            PharmacyDutyReplacement.starts_at.asc()
        )
        .all()
    )


def _validate_replacement_overlap(
    db: Session,
    *,
    assignment_id: UUID,
    starts_at: datetime,
    ends_at: datetime,
    exclude_replacement_id: UUID | None = None,
):
    query = (
        db.query(PharmacyDutyReplacement)
        .filter(
            PharmacyDutyReplacement.assignment_id
            == assignment_id,
            PharmacyDutyReplacement.status
            == "ACTIVE",
        )
    )

    if exclude_replacement_id is not None:
        query = query.filter(
            PharmacyDutyReplacement.id
            != exclude_replacement_id
        )

    for replacement in query.all():
        current_start = _db_datetime_as_utc(
            replacement.starts_at
        )
        current_end = _db_datetime_as_utc(
            replacement.ends_at
        )

        if (
            starts_at < current_end
            and current_start < ends_at
        ):
            raise ValueError(
                "Hay otro reemplazo activo "
                "superpuesto en ese turno."
            )


def create_replacement(
    db: Session,
    assignment_id: UUID,
    data,
    *,
    published_by_user_id: UUID | None = None,
):
    assignment = get_assignment(
        db,
        assignment_id,
    )

    if not assignment:
        raise ValueError(
            "Turno no encontrado."
        )

    if assignment.status != "SCHEDULED":
        raise ValueError(
            "No se puede reemplazar un turno cancelado."
        )

    pharmacy = get_pharmacy(
        db,
        data.replacement_pharmacy_id,
    )

    if not pharmacy or not pharmacy.is_active:
        raise ValueError(
            "La farmacia reemplazante "
            "no esta disponible."
        )

    if pharmacy.id == assignment.pharmacy_id:
        raise ValueError(
            "La farmacia reemplazante debe ser "
            "distinta de la originalmente asignada."
        )

    starts_at, ends_at = _validate_range(
        data.starts_at,
        data.ends_at,
    )

    assignment_start = _db_datetime_as_utc(
        assignment.starts_at
    )
    assignment_end = _db_datetime_as_utc(
        assignment.ends_at
    )

    if (
        starts_at < assignment_start
        or ends_at > assignment_end
    ):
        raise ValueError(
            "El reemplazo debe quedar dentro "
            "del horario del turno original."
        )

    _validate_replacement_overlap(
        db,
        assignment_id=assignment.id,
        starts_at=starts_at,
        ends_at=ends_at,
    )

    replacement = PharmacyDutyReplacement(
        assignment_id=assignment.id,
        replacement_pharmacy_id=(
            data.replacement_pharmacy_id
        ),
        starts_at=starts_at,
        ends_at=ends_at,
        status="ACTIVE",
        reason=_normalize_text(
            data.reason,
            250,
        ),
        public_note=_normalize_text(
            data.public_note,
            1000,
        ),
        published_by_user_id=published_by_user_id,
    )

    db.add(replacement)
    db.commit()
    db.refresh(replacement)

    return replacement


def update_replacement(
    db: Session,
    replacement_id: UUID,
    data,
):
    replacement = get_replacement(
        db,
        replacement_id,
    )

    if not replacement:
        raise ValueError(
            "Reemplazo no encontrado."
        )

    assignment = get_assignment(
        db,
        replacement.assignment_id,
    )

    if not assignment:
        raise ValueError(
            "Turno original no encontrado."
        )

    values = data.model_dump(
        exclude_unset=True
    )

    starts_at = values.get(
        "starts_at",
        _db_datetime_as_utc(
            replacement.starts_at
        ),
    )
    ends_at = values.get(
        "ends_at",
        _db_datetime_as_utc(
            replacement.ends_at
        ),
    )

    starts_at, ends_at = _validate_range(
        starts_at,
        ends_at,
    )

    assignment_start = _db_datetime_as_utc(
        assignment.starts_at
    )
    assignment_end = _db_datetime_as_utc(
        assignment.ends_at
    )

    if (
        starts_at < assignment_start
        or ends_at > assignment_end
    ):
        raise ValueError(
            "El reemplazo debe quedar dentro "
            "del horario del turno original."
        )

    new_status = values.get(
        "status",
        replacement.status,
    )

    if new_status == "ACTIVE":
        _validate_replacement_overlap(
            db,
            assignment_id=assignment.id,
            starts_at=starts_at,
            ends_at=ends_at,
            exclude_replacement_id=replacement.id,
        )

    replacement.starts_at = starts_at
    replacement.ends_at = ends_at

    if "status" in values:
        replacement.status = values["status"]

    if "reason" in values:
        replacement.reason = _normalize_text(
            values["reason"],
            250,
        )

    if "public_note" in values:
        replacement.public_note = _normalize_text(
            values["public_note"],
            1000,
        )

    db.commit()
    db.refresh(replacement)

    return replacement


def _day_bounds_utc(
    target_date: date,
    timezone_name: str,
):
    zone = ZoneInfo(
        _validate_timezone(timezone_name)
    )

    local_start = datetime.combine(
        target_date,
        time.min,
        tzinfo=zone,
    )

    local_end = datetime.combine(
        target_date,
        time.max,
        tzinfo=zone,
    )

    return (
        local_start.astimezone(timezone.utc),
        local_end.astimezone(timezone.utc),
    )


def _assignment_public_segments(
    db: Session,
    assignment,
    area,
    day_start: datetime,
    day_end: datetime,
):
    original_pharmacy = get_pharmacy(
        db,
        assignment.pharmacy_id,
    )

    if (
        not original_pharmacy
        or not original_pharmacy.is_active
    ):
        return []

    assignment_start = max(
        _db_datetime_as_utc(
            assignment.starts_at
        ),
        day_start,
    )

    assignment_end = min(
        _db_datetime_as_utc(
            assignment.ends_at
        ),
        day_end,
    )

    if assignment_end <= assignment_start:
        return []

    replacements = (
        db.query(PharmacyDutyReplacement)
        .filter(
            PharmacyDutyReplacement.assignment_id
            == assignment.id,
            PharmacyDutyReplacement.status
            == "ACTIVE",
        )
        .order_by(
            PharmacyDutyReplacement.starts_at.asc()
        )
        .all()
    )

    segments = []
    cursor = assignment_start

    for replacement in replacements:
        replacement_start = max(
            _db_datetime_as_utc(
                replacement.starts_at
            ),
            assignment_start,
        )

        replacement_end = min(
            _db_datetime_as_utc(
                replacement.ends_at
            ),
            assignment_end,
        )

        if replacement_end <= replacement_start:
            continue

        if cursor < replacement_start:
            segments.append(
                {
                    "assignment_id": assignment.id,
                    "area": area,
                    "starts_at": cursor,
                    "ends_at": replacement_start,
                    "original_pharmacy": original_pharmacy,
                    "effective_pharmacy": original_pharmacy,
                    "is_replacement": False,
                    "public_note": assignment.public_note,
                }
            )

        replacement_pharmacy = get_pharmacy(
            db,
            replacement.replacement_pharmacy_id,
        )

        if (
            replacement_pharmacy
            and replacement_pharmacy.is_active
        ):
            segments.append(
                {
                    "assignment_id": assignment.id,
                    "area": area,
                    "starts_at": replacement_start,
                    "ends_at": replacement_end,
                    "original_pharmacy": original_pharmacy,
                    "effective_pharmacy": replacement_pharmacy,
                    "is_replacement": True,
                    "public_note": (
                        replacement.public_note
                        or assignment.public_note
                    ),
                }
            )
        else:
            segments.append(
                {
                    "assignment_id": assignment.id,
                    "area": area,
                    "starts_at": replacement_start,
                    "ends_at": replacement_end,
                    "original_pharmacy": original_pharmacy,
                    "effective_pharmacy": original_pharmacy,
                    "is_replacement": False,
                    "public_note": assignment.public_note,
                }
            )

        cursor = max(
            cursor,
            replacement_end,
        )

    if cursor < assignment_end:
        segments.append(
            {
                "assignment_id": assignment.id,
                "area": area,
                "starts_at": cursor,
                "ends_at": assignment_end,
                "original_pharmacy": original_pharmacy,
                "effective_pharmacy": original_pharmacy,
                "is_replacement": False,
                "public_note": assignment.public_note,
            }
        )

    return segments


def get_public_duties_for_date(
    db: Session,
    target_date: date,
    *,
    area_id: UUID | None = None,
):
    if area_id is not None:
        area = get_duty_area(
            db,
            area_id,
        )

        if not area or not area.is_active:
            raise ValueError(
                "Zona de turnos no encontrada."
            )

        areas = [area]
    else:
        areas = list_duty_areas(
            db,
            include_inactive=False,
        )

    result = []

    for area in areas:
        day_start, day_end = _day_bounds_utc(
            target_date,
            area.timezone,
        )

        assignments = (
            db.query(PharmacyDutyAssignment)
            .filter(
                PharmacyDutyAssignment.area_id
                == area.id,
                PharmacyDutyAssignment.status
                == "SCHEDULED",
            )
            .order_by(
                PharmacyDutyAssignment.starts_at.asc()
            )
            .all()
        )

        for assignment in assignments:
            assignment_start = _db_datetime_as_utc(
                assignment.starts_at
            )
            assignment_end = _db_datetime_as_utc(
                assignment.ends_at
            )

            if not (
                assignment_start < day_end
                and day_start < assignment_end
            ):
                continue

            result.extend(
                _assignment_public_segments(
                    db,
                    assignment,
                    area,
                    day_start,
                    day_end,
                )
            )

    result.sort(
        key=lambda item: (
            item["starts_at"],
            str(item["effective_pharmacy"].name).lower(),
        )
    )

    return result


def get_public_duties_today(
    db: Session,
    *,
    area_id: UUID | None = None,
):
    now_utc = datetime.now(timezone.utc)

    if area_id is not None:
        area = get_duty_area(
            db,
            area_id,
        )

        if not area or not area.is_active:
            raise ValueError(
                "Zona de turnos no encontrada."
            )

        target_date = now_utc.astimezone(
            ZoneInfo(area.timezone)
        ).date()

        return get_public_duties_for_date(
            db,
            target_date,
            area_id=area.id,
        )

    result = []

    for area in list_duty_areas(
        db,
        include_inactive=False,
    ):
        target_date = now_utc.astimezone(
            ZoneInfo(area.timezone)
        ).date()

        result.extend(
            get_public_duties_for_date(
                db,
                target_date,
                area_id=area.id,
            )
        )

    result.sort(
        key=lambda item: (
            str(item["area"].name).lower(),
            item["starts_at"],
            str(item["effective_pharmacy"].name).lower(),
        )
    )

    return result
