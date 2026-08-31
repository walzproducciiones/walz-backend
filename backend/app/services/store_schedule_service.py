from datetime import date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from backend.app.models.store_schedule import (
    StoreScheduleException,
    StoreScheduleExceptionInterval,
    StoreScheduleInterval,
    StoreSchedulePeriod,
    StoreScheduleSetting,
)
from backend.app.schemas.store_schedule import StoreScheduleUpdate
from backend.app.services.store_service import get_store_by_owner


def _validate_timezone(timezone_name: str) -> str:
    value = str(timezone_name or "").strip()

    if not value:
        raise ValueError("Selecciona una zona horaria.")

    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError:
        raise ValueError("La zona horaria seleccionada no es valida.")

    return value


def _normalize_text(value, max_length: int):
    normalized = " ".join(str(value or "").strip().split())

    if not normalized:
        return None

    if len(normalized) > max_length:
        raise ValueError(
            f"El texto puede tener hasta {max_length} caracteres."
        )

    return normalized


def _validate_intervals(intervals, *, include_weekday: bool):
    seen = set()
    segments_by_day = {}

    for interval in intervals:
        opens_at = interval.opens_at
        closes_at = interval.closes_at

        if opens_at == closes_at:
            raise ValueError(
                "La hora de apertura y cierre no pueden ser iguales."
            )

        weekday = interval.weekday if include_weekday else 0

        key = (
            weekday,
            opens_at.isoformat(),
            closes_at.isoformat(),
        )

        if key in seen:
            raise ValueError("Hay una franja horaria repetida.")

        seen.add(key)

        start_minutes = (
            opens_at.hour * 60
            + opens_at.minute
            + opens_at.second / 60
        )

        end_minutes = (
            closes_at.hour * 60
            + closes_at.minute
            + closes_at.second / 60
        )

        if end_minutes > start_minutes:
            segments_by_day.setdefault(
                weekday,
                [],
            ).append((start_minutes, end_minutes))
        else:
            segments_by_day.setdefault(
                weekday,
                [],
            ).append((start_minutes, 24 * 60))

            next_day = (
                (weekday + 1) % 7
                if include_weekday
                else weekday
            )

            segments_by_day.setdefault(
                next_day,
                [],
            ).append((0, end_minutes))

    for weekday, rows in segments_by_day.items():
        rows.sort()

        for previous, current in zip(rows, rows[1:]):
            if current[0] < previous[1]:
                day_label = (
                    f" en el dia {weekday}"
                    if include_weekday
                    else ""
                )

                raise ValueError(
                    "Hay franjas horarias superpuestas"
                    f"{day_label}."
                )


def _dates_overlap(
    start_a: date,
    end_a: date,
    start_b: date,
    end_b: date,
) -> bool:
    return start_a <= end_b and start_b <= end_a


def _annual_range_segments(
    start_date: date,
    end_date: date,
):
    reference_year = 2000

    start_day = date(
        reference_year,
        start_date.month,
        start_date.day,
    ).timetuple().tm_yday

    end_day = date(
        reference_year,
        end_date.month,
        end_date.day,
    ).timetuple().tm_yday

    if start_day <= end_day:
        return [(start_day, end_day)]

    return [
        (start_day, 366),
        (1, end_day),
    ]


def _annual_segments_overlap(
    first,
    second,
) -> bool:
    first_segments = _annual_range_segments(
        first.valid_from,
        first.valid_until,
    )

    second_segments = _annual_range_segments(
        second.valid_from,
        second.valid_until,
    )

    for start_a, end_a in first_segments:
        for start_b, end_b in second_segments:
            if start_a <= end_b and start_b <= end_a:
                return True

    return False


def _seasonal_period_matches_date(
    period,
    target_date: date,
) -> bool:
    if (
        period.valid_from is None
        or period.valid_until is None
    ):
        return False

    if not bool(period.recurs_annually):
        return (
            period.valid_from
            <= target_date
            <= period.valid_until
        )

    target_day = date(
        2000,
        target_date.month,
        target_date.day,
    ).timetuple().tm_yday

    return any(
        start_day <= target_day <= end_day
        for start_day, end_day in _annual_range_segments(
            period.valid_from,
            period.valid_until,
        )
    )


def _validate_schedule_payload(data: StoreScheduleUpdate):
    timezone_name = _validate_timezone(data.timezone_name)

    regular_periods = [
        period
        for period in data.periods
        if period.period_type == "REGULAR"
        and period.is_active
    ]

    if len(regular_periods) > 1:
        raise ValueError(
            "Solo puede haber un horario habitual activo."
        )

    seasonal_periods = []

    for period in data.periods:
        period.name = (
            _normalize_text(period.name, 120)
            or "Horario"
        )

        _validate_intervals(
            period.intervals,
            include_weekday=True,
        )

        if period.period_type == "REGULAR":
            period.recurs_annually = False

            if (
                period.valid_from is not None
                or period.valid_until is not None
            ):
                raise ValueError(
                    "El horario habitual no lleva fechas "
                    "de inicio o fin."
                )

        if period.period_type == "SEASONAL":
            if (
                period.valid_from is None
                or period.valid_until is None
            ):
                raise ValueError(
                    "Un horario de temporada necesita "
                    "fecha desde y hasta."
                )

            if period.valid_from > period.valid_until:
                raise ValueError(
                    "La fecha inicial de una temporada "
                    "no puede ser posterior a la final."
                )

            if period.is_active:
                seasonal_periods.append(period)

    for index, first in enumerate(seasonal_periods):
        for second in seasonal_periods[index + 1:]:
            if (
                bool(first.recurs_annually)
                and bool(second.recurs_annually)
            ):
                overlaps = _annual_segments_overlap(
                    first,
                    second,
                )
            elif (
                not bool(first.recurs_annually)
                and not bool(second.recurs_annually)
            ):
                overlaps = _dates_overlap(
                    first.valid_from,
                    first.valid_until,
                    second.valid_from,
                    second.valid_until,
                )
            else:
                # Una temporada puntual puede reemplazar
                # temporalmente a una temporada anual.
                overlaps = False

            if overlaps:
                raise ValueError(
                    "Hay temporadas activas con fechas superpuestas."
                )

    active_exceptions = []

    for exception in data.exceptions:
        if exception.start_date > exception.end_date:
            raise ValueError(
                "La fecha inicial de una excepcion "
                "no puede ser posterior a la final."
            )

        exception.label = _normalize_text(
            exception.label,
            120,
        )
        exception.public_message = _normalize_text(
            exception.public_message,
            500,
        )

        _validate_intervals(
            exception.intervals,
            include_weekday=False,
        )

        if exception.mode == "CLOSED":
            if exception.intervals:
                raise ValueError(
                    "Un cierre temporal no puede tener "
                    "franjas de apertura."
                )

        if exception.mode == "SPECIAL_HOURS":
            if not exception.intervals:
                raise ValueError(
                    "Un horario especial necesita "
                    "al menos una franja."
                )

        active_exceptions.append(exception)

    for index, first in enumerate(active_exceptions):
        for second in active_exceptions[index + 1:]:
            if _dates_overlap(
                first.start_date,
                first.end_date,
                second.start_date,
                second.end_date,
            ):
                raise ValueError(
                    "Hay excepciones con fechas superpuestas."
                )

    return timezone_name


def _serialize_store_schedule(db: Session, store):
    setting = (
        db.query(StoreScheduleSetting)
        .filter(StoreScheduleSetting.store_id == store.id)
        .first()
    )

    if not setting:
        return {
            "store_id": store.id,
            "timezone_name": "America/Argentina/Buenos_Aires",
            "online_order_mode": "ALWAYS",
            "periods": [],
            "exceptions": [],
            "created_at": None,
            "updated_at": None,
        }

    periods = (
        db.query(StoreSchedulePeriod)
        .filter(StoreSchedulePeriod.store_id == store.id)
        .order_by(
            StoreSchedulePeriod.period_type.asc(),
            StoreSchedulePeriod.valid_from.asc(),
            StoreSchedulePeriod.name.asc(),
        )
        .all()
    )

    period_ids = [period.id for period in periods]

    interval_rows = []

    if period_ids:
        interval_rows = (
            db.query(StoreScheduleInterval)
            .filter(
                StoreScheduleInterval.period_id.in_(period_ids)
            )
            .order_by(
                StoreScheduleInterval.weekday.asc(),
                StoreScheduleInterval.opens_at.asc(),
            )
            .all()
        )

    intervals_by_period = {}

    for row in interval_rows:
        intervals_by_period.setdefault(
            row.period_id,
            [],
        ).append({
            "id": row.id,
            "weekday": row.weekday,
            "opens_at": row.opens_at,
            "closes_at": row.closes_at,
        })

    exceptions = (
        db.query(StoreScheduleException)
        .filter(
            StoreScheduleException.store_id == store.id
        )
        .order_by(
            StoreScheduleException.start_date.asc(),
            StoreScheduleException.end_date.asc(),
        )
        .all()
    )

    exception_ids = [
        exception.id
        for exception in exceptions
    ]

    exception_interval_rows = []

    if exception_ids:
        exception_interval_rows = (
            db.query(StoreScheduleExceptionInterval)
            .filter(
                StoreScheduleExceptionInterval.exception_id.in_(
                    exception_ids
                )
            )
            .order_by(
                StoreScheduleExceptionInterval.opens_at.asc(),
            )
            .all()
        )

    intervals_by_exception = {}

    for row in exception_interval_rows:
        intervals_by_exception.setdefault(
            row.exception_id,
            [],
        ).append({
            "id": row.id,
            "opens_at": row.opens_at,
            "closes_at": row.closes_at,
        })

    return {
        "store_id": store.id,
        "timezone_name": setting.timezone_name,
        "online_order_mode": setting.online_order_mode,
        "periods": [
            {
                "id": period.id,
                "period_type": period.period_type,
                "name": period.name,
                "valid_from": period.valid_from,
                "valid_until": period.valid_until,
                "recurs_annually": period.recurs_annually,
                "is_active": period.is_active,
                "intervals": intervals_by_period.get(
                    period.id,
                    [],
                ),
            }
            for period in periods
        ],
        "exceptions": [
            {
                "id": exception.id,
                "start_date": exception.start_date,
                "end_date": exception.end_date,
                "mode": exception.mode,
                "label": exception.label,
                "public_message": exception.public_message,
                "online_order_override": (
                    exception.online_order_override
                ),
                "intervals": intervals_by_exception.get(
                    exception.id,
                    [],
                ),
            }
            for exception in exceptions
        ],
        "created_at": setting.created_at,
        "updated_at": setting.updated_at,
    }


def get_store_schedule_by_owner(
    db: Session,
    owner_id: UUID,
):
    store = get_store_by_owner(db, owner_id)

    if not store:
        raise ValueError("Tienda no encontrada.")

    return _serialize_store_schedule(db, store)


def get_store_schedule_by_store(
    db: Session,
    store,
):
    if not store:
        raise ValueError("Tienda no encontrada.")

    return _serialize_store_schedule(db, store)


def save_store_schedule(
    db: Session,
    owner_id: UUID,
    data: StoreScheduleUpdate,
):
    store = get_store_by_owner(db, owner_id)

    if not store:
        raise ValueError("Tienda no encontrada.")

    timezone_name = _validate_schedule_payload(data)

    try:
        setting = (
            db.query(StoreScheduleSetting)
            .filter(
                StoreScheduleSetting.store_id == store.id
            )
            .first()
        )

        if not setting:
            setting = StoreScheduleSetting(
                store_id=store.id,
            )
            db.add(setting)

        setting.timezone_name = timezone_name
        setting.online_order_mode = data.online_order_mode

        existing_periods = (
            db.query(StoreSchedulePeriod)
            .filter(
                StoreSchedulePeriod.store_id == store.id
            )
            .all()
        )

        existing_period_ids = [
            period.id
            for period in existing_periods
        ]

        if existing_period_ids:
            (
                db.query(StoreScheduleInterval)
                .filter(
                    StoreScheduleInterval.period_id.in_(
                        existing_period_ids
                    )
                )
                .delete(synchronize_session=False)
            )

        (
            db.query(StoreSchedulePeriod)
            .filter(
                StoreSchedulePeriod.store_id == store.id
            )
            .delete(synchronize_session=False)
        )

        existing_exceptions = (
            db.query(StoreScheduleException)
            .filter(
                StoreScheduleException.store_id == store.id
            )
            .all()
        )

        existing_exception_ids = [
            exception.id
            for exception in existing_exceptions
        ]

        if existing_exception_ids:
            (
                db.query(StoreScheduleExceptionInterval)
                .filter(
                    StoreScheduleExceptionInterval.exception_id.in_(
                        existing_exception_ids
                    )
                )
                .delete(synchronize_session=False)
            )

        (
            db.query(StoreScheduleException)
            .filter(
                StoreScheduleException.store_id == store.id
            )
            .delete(synchronize_session=False)
        )

        for period_data in data.periods:
            period = StoreSchedulePeriod(
                store_id=store.id,
                period_type=period_data.period_type,
                name=period_data.name,
                valid_from=period_data.valid_from,
                valid_until=period_data.valid_until,
                recurs_annually=period_data.recurs_annually,
                is_active=period_data.is_active,
            )

            db.add(period)
            db.flush()

            for interval_data in period_data.intervals:
                db.add(StoreScheduleInterval(
                    period_id=period.id,
                    weekday=interval_data.weekday,
                    opens_at=interval_data.opens_at,
                    closes_at=interval_data.closes_at,
                ))

        for exception_data in data.exceptions:
            exception = StoreScheduleException(
                store_id=store.id,
                start_date=exception_data.start_date,
                end_date=exception_data.end_date,
                mode=exception_data.mode,
                label=exception_data.label,
                public_message=exception_data.public_message,
                online_order_override=(
                    exception_data.online_order_override
                ),
            )

            db.add(exception)
            db.flush()

            for interval_data in exception_data.intervals:
                db.add(StoreScheduleExceptionInterval(
                    exception_id=exception.id,
                    opens_at=interval_data.opens_at,
                    closes_at=interval_data.closes_at,
                ))

        db.commit()

        return _serialize_store_schedule(db, store)

    except Exception:
        db.rollback()
        raise



def _effective_schedule_for_date(
    db: Session,
    store_id: UUID,
    target_date: date,
):
    exception = (
        db.query(StoreScheduleException)
        .filter(
            StoreScheduleException.store_id == store_id,
            StoreScheduleException.start_date <= target_date,
            StoreScheduleException.end_date >= target_date,
        )
        .order_by(
            StoreScheduleException.start_date.desc(),
            StoreScheduleException.created_at.desc(),
        )
        .first()
    )

    if exception:
        intervals = []

        if exception.mode == "SPECIAL_HOURS":
            intervals = (
                db.query(StoreScheduleExceptionInterval)
                .filter(
                    StoreScheduleExceptionInterval.exception_id
                    == exception.id
                )
                .order_by(
                    StoreScheduleExceptionInterval.opens_at.asc()
                )
                .all()
            )

        return {
            "source": "EXCEPTION",
            "source_label": exception.label,
            "public_message": exception.public_message,
            "online_order_override": (
                exception.online_order_override
            ),
            "intervals": intervals,
            "exception_mode": exception.mode,
        }

    seasonal_rows = (
        db.query(StoreSchedulePeriod)
        .filter(
            StoreSchedulePeriod.store_id == store_id,
            StoreSchedulePeriod.period_type == "SEASONAL",
            StoreSchedulePeriod.is_active.is_(True),
        )
        .all()
    )

    matching_one_time = [
        period
        for period in seasonal_rows
        if not bool(period.recurs_annually)
        and _seasonal_period_matches_date(
            period,
            target_date,
        )
    ]

    matching_recurring = [
        period
        for period in seasonal_rows
        if bool(period.recurs_annually)
        and _seasonal_period_matches_date(
            period,
            target_date,
        )
    ]

    seasonal = None

    if matching_one_time:
        seasonal = sorted(
            matching_one_time,
            key=lambda period: (
                period.valid_from,
                period.name,
            ),
            reverse=True,
        )[0]
    elif matching_recurring:
        seasonal = sorted(
            matching_recurring,
            key=lambda period: (
                period.valid_from,
                period.name,
            ),
            reverse=True,
        )[0]

    if seasonal:
        intervals = (
            db.query(StoreScheduleInterval)
            .filter(
                StoreScheduleInterval.period_id == seasonal.id,
                StoreScheduleInterval.weekday
                == target_date.weekday(),
            )
            .order_by(
                StoreScheduleInterval.opens_at.asc()
            )
            .all()
        )

        return {
            "source": "SEASONAL",
            "source_label": seasonal.name,
            "public_message": None,
            "online_order_override": None,
            "intervals": intervals,
            "exception_mode": None,
        }

    regular = (
        db.query(StoreSchedulePeriod)
        .filter(
            StoreSchedulePeriod.store_id == store_id,
            StoreSchedulePeriod.period_type == "REGULAR",
            StoreSchedulePeriod.is_active.is_(True),
        )
        .order_by(
            StoreSchedulePeriod.created_at.asc()
        )
        .first()
    )

    if regular:
        intervals = (
            db.query(StoreScheduleInterval)
            .filter(
                StoreScheduleInterval.period_id == regular.id,
                StoreScheduleInterval.weekday
                == target_date.weekday(),
            )
            .order_by(
                StoreScheduleInterval.opens_at.asc()
            )
            .all()
        )

        return {
            "source": "REGULAR",
            "source_label": regular.name,
            "public_message": None,
            "online_order_override": None,
            "intervals": intervals,
            "exception_mode": None,
        }

    return {
        "source": "NO_ACTIVE_SCHEDULE",
        "source_label": None,
        "public_message": None,
        "online_order_override": None,
        "intervals": [],
        "exception_mode": None,
    }


def _time_to_minutes(value):
    return (
        value.hour * 60
        + value.minute
        + value.second / 60
    )


def _is_open_in_day_definition(
    definition,
    local_datetime: datetime,
):
    current_minutes = (
        local_datetime.hour * 60
        + local_datetime.minute
        + local_datetime.second / 60
    )

    for interval in definition["intervals"]:
        opens = _time_to_minutes(interval.opens_at)
        closes = _time_to_minutes(interval.closes_at)

        if closes > opens:
            if opens <= current_minutes < closes:
                return True
        else:
            if current_minutes >= opens:
                return True

    return False


def _is_open_from_previous_day(
    definition,
    local_datetime: datetime,
):
    current_minutes = (
        local_datetime.hour * 60
        + local_datetime.minute
        + local_datetime.second / 60
    )

    for interval in definition["intervals"]:
        opens = _time_to_minutes(interval.opens_at)
        closes = _time_to_minutes(interval.closes_at)

        if closes <= opens and current_minutes < closes:
            return True

    return False


def _next_open_datetime(
    db: Session,
    store_id: UUID,
    local_datetime: datetime,
    timezone,
):
    for offset in range(0, 731):
        target_date = local_datetime.date() + timedelta(days=offset)
        definition = _effective_schedule_for_date(
            db,
            store_id,
            target_date,
        )

        if (
            definition["source"] == "EXCEPTION"
            and definition["exception_mode"] == "CLOSED"
        ):
            continue

        for interval in definition["intervals"]:
            candidate = datetime.combine(
                target_date,
                interval.opens_at,
                tzinfo=timezone,
            )

            if candidate > local_datetime:
                return candidate

    return None


def get_store_schedule_status(
    db: Session,
    store,
    now: datetime | None = None,
):
    if not store:
        raise ValueError("Tienda no encontrada.")

    setting = (
        db.query(StoreScheduleSetting)
        .filter(
            StoreScheduleSetting.store_id == store.id
        )
        .first()
    )

    if not setting:
        timezone_name = "America/Argentina/Buenos_Aires"
        timezone = ZoneInfo(timezone_name)

        local_datetime = (
            now.replace(tzinfo=timezone)
            if now is not None and now.tzinfo is None
            else (
                now.astimezone(timezone)
                if now is not None
                else datetime.now(timezone)
            )
        )

        return {
            "store_id": store.id,
            "timezone_name": timezone_name,
            "local_datetime": local_datetime,
            "is_configured": False,
            "is_open": None,
            "source": "UNCONFIGURED",
            "source_label": None,
            "public_message": None,
            "online_orders_allowed": True,
            "effective_online_order_mode": "ALWAYS",
            "next_open_at": None,
        }

    timezone_name = _validate_timezone(
        setting.timezone_name
    )
    timezone = ZoneInfo(timezone_name)

    local_datetime = (
        now.replace(tzinfo=timezone)
        if now is not None and now.tzinfo is None
        else (
            now.astimezone(timezone)
            if now is not None
            else datetime.now(timezone)
        )
    )

    today_definition = _effective_schedule_for_date(
        db,
        store.id,
        local_datetime.date(),
    )

    is_open = False
    active_definition = today_definition

    if not (
        today_definition["source"] == "EXCEPTION"
        and today_definition["exception_mode"] == "CLOSED"
    ):
        is_open = _is_open_in_day_definition(
            today_definition,
            local_datetime,
        )

        if (
            not is_open
            and today_definition["source"] != "EXCEPTION"
        ):
            previous_definition = _effective_schedule_for_date(
                db,
                store.id,
                local_datetime.date() - timedelta(days=1),
            )

            if _is_open_from_previous_day(
                previous_definition,
                local_datetime,
            ):
                is_open = True
                active_definition = previous_definition

    effective_online_order_mode = (
        today_definition["online_order_override"]
        or setting.online_order_mode
    )

    if (
        is_open
        and active_definition["source"] == "EXCEPTION"
        and active_definition["online_order_override"] is not None
        and today_definition["source"] != "EXCEPTION"
    ):
        effective_online_order_mode = (
            active_definition["online_order_override"]
        )

    if effective_online_order_mode == "DISABLED":
        online_orders_allowed = False
    elif effective_online_order_mode == "OPEN_ONLY":
        online_orders_allowed = bool(is_open)
    else:
        online_orders_allowed = True

    next_open_at = None

    if not is_open:
        next_open_at = _next_open_datetime(
            db,
            store.id,
            local_datetime,
            timezone,
        )

    return {
        "store_id": store.id,
        "timezone_name": timezone_name,
        "local_datetime": local_datetime,
        "is_configured": True,
        "is_open": is_open,
        "source": today_definition["source"],
        "source_label": today_definition["source_label"],
        "public_message": today_definition["public_message"],
        "online_orders_allowed": online_orders_allowed,
        "effective_online_order_mode": effective_online_order_mode,
        "next_open_at": next_open_at,
    }
