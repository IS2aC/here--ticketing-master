"""Portail admin (équipe Here!, rôle admin) : tableau de bord, suivi des comptes et des événements, réglages."""

import uuid
from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import Select, delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import AdminAuth, DbSession
from app.config import EDITABLE, Settings, env_settings, get_settings
from app.models import (
    Call,
    Checkin,
    Event,
    EventStatus,
    Guest,
    Invitation,
    Message,
    MessageKind,
    MessageStatus,
    PlatformSetting,
    RsvpStatus,
    Session,
    User,
    UserRole,
)
from app.platform import refresh_settings
from app.schemas import (
    Activity,
    AdminDashboard,
    AdminEvent,
    AdminEventPage,
    AdminProvider,
    AdminUser,
    AdminUserDetail,
    AdminUserPage,
    AdminUserUpdate,
    DayPoint,
    PlatformSettingsIn,
    PlatformSettingsOut,
    PlatformValues,
    ProviderOption,
    SendStats,
    Trend,
)
from app.whatsapp import get_provider

router = APIRouter(prefix="/admin", tags=["admin"])

_DONE = (MessageStatus.sent, MessageStatus.delivered, MessageStatus.read)
_QUEUED = (MessageStatus.scheduled, MessageStatus.sending)
PERIODS = (7, 30, 90)  # jours, tableau de bord


def _like(q: str) -> str:
    escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


# ---------------------------------------------------------------------------
# Tableau de bord
# ---------------------------------------------------------------------------


def _day(column: Any) -> Any:
    # Heure d'Abidjan = UTC : le jour UTC est le jour local.
    return func.date(func.timezone("UTC", column))


def _plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else many or one + 's'}"


async def _trend(
    db: AsyncSession, query: Select[Any], column: Any, since: datetime
) -> Trend:
    total = await db.scalar(query) or 0
    new = await db.scalar(query.where(column >= since)) or 0
    before = total - new
    return Trend(
        total=total, new=new, trend_pct=round(100 * new / before, 1) if before else None
    )


async def _sends(db: AsyncSession, kind: MessageKind, since: datetime) -> SendStats:
    query = select(func.count()).where(Message.kind == kind, Message.status.in_(_DONE))
    trend = await _trend(db, query, Message.sent_at, since)
    delivered = await db.scalar(
        query.where(Message.status.in_((MessageStatus.delivered, MessageStatus.read)))
    )
    read = await db.scalar(query.where(Message.status == MessageStatus.read))
    return SendStats(**trend.model_dump(), delivered=delivered or 0, read=read or 0)


async def _series(db: AsyncSession, since: datetime, days: int) -> list[DayPoint]:
    async def per_day(column: Any, *where: Any) -> dict[date, int]:
        day = _day(column)
        rows = await db.execute(
            select(day, func.count()).where(column >= since, *where).group_by(day)
        )
        return {d: n for d, n in rows.all()}

    organizers = await per_day(User.created_at, User.role == UserRole.organizer)
    guests = await per_day(Guest.created_at)
    sent = await per_day(Message.sent_at, Message.status.in_(_DONE))
    failed = await per_day(Message.scheduled_at, Message.status == MessageStatus.failed)
    first = since.date()
    return [
        DayPoint(
            day=d,
            organizers=organizers.get(d, 0),
            guests=guests.get(d, 0),
            sent=sent.get(d, 0),
            failed=failed.get(d, 0),
        )
        for d in (first + timedelta(days=i) for i in range(days))
    ]


async def _activity(db: AsyncSession, limit: int = 8) -> list[Activity]:
    """Dernières activités, reconstituées à partir des données (pas de journal à part).
    Les envois et les réponses sont regroupés par événement et par jour."""
    items: list[Activity] = []
    for first, last, at in (
        await db.execute(
            select(User.first_name, User.last_name, User.created_at)
            .where(User.role == UserRole.organizer)
            .order_by(User.created_at.desc())
            .limit(limit)
        )
    ).all():
        items.append(
            Activity(
                kind="organizer",
                title="Nouvel organisateur",
                detail=f"Inscription de {first} {last}",
                at=at,
            )
        )
    for title, at in (
        await db.execute(
            select(Event.title, Event.created_at)
            .order_by(Event.created_at.desc())
            .limit(limit)
        )
    ).all():
        items.append(
            Activity(kind="event", title="Nouvel événement", detail=title, at=at)
        )

    async def grouped(
        column: Any, *where: Any, counts: tuple[Any, ...] = ()
    ) -> list[Any]:
        day = _day(column)
        return (
            await db.execute(
                select(Event.title, func.max(column), *(counts or (func.count(),)))
                .select_from(Guest)
                .join(Event, Event.id == Guest.event_id)
                .where(column.is_not(None), *where)
                .group_by(Event.id, Event.title, day)
                .order_by(func.max(column).desc())
                .limit(limit)
            )
        ).all()

    sent = await grouped(
        Message.sent_at,
        Message.guest_id == Guest.id,
        Message.kind == MessageKind.invitation,
        Message.status.in_(_DONE),
    )
    for title, at, n in sent:
        items.append(
            Activity(
                kind="invitations",
                title="Invitations envoyées",
                detail=f"{_plural(n, 'invitation')} ({title})",
                at=at,
            )
        )
    failed = await grouped(
        Message.scheduled_at,
        Message.guest_id == Guest.id,
        Message.status == MessageStatus.failed,
    )
    for title, at, n in failed:
        items.append(
            Activity(
                kind="failures",
                title="Échecs d'envoi",
                detail=f"{_plural(n, 'message')} en échec ({title})",
                at=at,
            )
        )
    responses = await grouped(
        Guest.responded_at,
        Guest.rsvp_status != RsvpStatus.pending,
        counts=(
            func.count().filter(Guest.rsvp_status == RsvpStatus.confirmed),
            func.count().filter(Guest.rsvp_status == RsvpStatus.declined),
        ),
    )
    for title, at, confirmed, declined in responses:
        parts = [
            _plural(confirmed, "confirmation") if confirmed else "",
            _plural(declined, "refus", "refus") if declined else "",
        ]
        items.append(
            Activity(
                kind="responses",
                title="Réponses reçues",
                detail=f"{', '.join(p for p in parts if p)} ({title})",
                at=at,
            )
        )
    return sorted(items, key=lambda a: a.at, reverse=True)[:limit]


@router.get("/dashboard")
async def dashboard(
    _: AdminAuth,
    db: DbSession,
    days: int = 30,
) -> AdminDashboard:
    """Tableau de bord de la plateforme. Les tendances et les courbes portent sur les `days` derniers jours."""
    if days not in PERIODS:
        raise _refused("Période : 7, 30 ou 90 jours.")
    now = datetime.now(UTC)
    since = datetime.combine(now.date() - timedelta(days=days - 1), time(), UTC)
    events_by_status = dict.fromkeys(EventStatus, 0)
    for state, n in (
        await db.execute(select(Event.status, func.count()).group_by(Event.status))
    ).all():
        events_by_status[state] = n
    rsvp = dict.fromkeys(RsvpStatus, 0)
    for state, n in (
        await db.execute(
            select(Guest.rsvp_status, func.count()).group_by(Guest.rsvp_status)
        )
    ).all():
        rsvp[state] = n

    settings = get_settings()
    provider = get_provider()
    return AdminDashboard(
        period_days=days,
        organizers=await _trend(
            db,
            select(func.count()).where(User.role == UserRole.organizer),
            User.created_at,
            since,
        ),
        events=await _trend(
            db, select(func.count()).select_from(Event), Event.created_at, since
        ),
        events_by_status=events_by_status,
        upcoming_events=await db.scalar(
            select(func.count()).where(
                Event.starts_at > now, Event.status != EventStatus.cancelled
            )
        )
        or 0,
        guests=await _trend(
            db, select(func.count()).select_from(Guest), Guest.created_at, since
        ),
        rsvp=rsvp,
        invitations=await _sends(db, MessageKind.invitation, since),
        reminders=await _sends(db, MessageKind.reminder, since),
        messages_queued=await db.scalar(
            select(func.count()).where(Message.status.in_(_QUEUED))
        )
        or 0,
        messages_failed=await _trend(
            db,
            select(func.count()).where(Message.status == MessageStatus.failed),
            Message.scheduled_at,
            since,
        ),
        checkins=await db.scalar(select(func.count()).select_from(Checkin)) or 0,
        calls_scheduled=await db.scalar(
            select(func.count()).where(Call.called_at.is_(None))
        )
        or 0,
        series=await _series(db, since, days),
        activity=await _activity(db),
        provider=AdminProvider(
            name=provider.name,
            configured=provider.configured,
            min_delay_seconds=settings.whatsapp_min_delay_seconds,
            max_delay_seconds=settings.whatsapp_max_delay_seconds,
            send_start_hour=settings.whatsapp_send_start_hour,
            send_end_hour=settings.whatsapp_send_end_hour,
        ),
    )


# ---------------------------------------------------------------------------
# Utilisateurs
# ---------------------------------------------------------------------------


def _users() -> Select[Any]:
    last_login = (
        select(func.max(Session.created_at))
        .where(Session.user_id == User.id)
        .scalar_subquery()
    )
    events = (
        select(func.count())
        .select_from(Event)
        .where(Event.user_id == User.id)
        .scalar_subquery()
    )
    return select(User, last_login, events)


def _user_out(user: User, last_login: datetime | None, events: int) -> dict[str, Any]:
    return {
        **{f: getattr(user, f) for f in AdminUser.model_fields if hasattr(user, f)},
        "last_login_at": last_login,
        "events": events,
    }


@router.get("/users")
async def users(
    _: AdminAuth,
    db: DbSession,
    q: str = "",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminUserPage:
    """Comptes, du plus récent au plus ancien. `q` : nom, téléphone, e-mail ou structure."""
    where = []
    if q.strip():
        pattern = _like(q)
        where.append(
            or_(
                (User.first_name + " " + User.last_name).ilike(pattern),
                (User.last_name + " " + User.first_name).ilike(pattern),
                User.phone.ilike(_like(q.replace(" ", ""))),
                User.email.ilike(pattern),
                User.organization.ilike(pattern),
            )
        )
    total = await db.scalar(select(func.count()).select_from(User).where(*where))
    rows = (
        await db.execute(
            _users()
            .where(*where)
            .order_by(User.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return AdminUserPage(
        total=total or 0,
        items=[AdminUser(**_user_out(*row)) for row in rows],
    )


async def _user_detail(db: AsyncSession, user_id: uuid.UUID) -> AdminUserDetail:
    row = (await db.execute(_users().where(User.id == user_id))).one_or_none()
    if row is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail={"message": "Compte introuvable."}
        )
    user = row[0]
    event_rows = (
        await db.execute(
            _events().where(Event.user_id == user_id).order_by(Event.starts_at.desc())
        )
    ).all()
    return AdminUserDetail(
        **_user_out(*row),
        billing_address=user.billing_address,
        tax_id=user.tax_id,
        event_list=[_event_out(*r) for r in event_rows],
    )


@router.get("/users/{user_id}")
async def user_detail(
    user_id: uuid.UUID, _: AdminAuth, db: DbSession
) -> AdminUserDetail:
    return await _user_detail(db, user_id)


@router.patch("/users/{user_id}")
async def update_user(
    user_id: uuid.UUID, body: AdminUserUpdate, _: AdminAuth, db: DbSession
) -> AdminUserDetail:
    """Options du compte : relances à la demande (option payante)."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail={"message": "Compte introuvable."}
        )
    user.on_demand_reminders = body.on_demand_reminders
    await db.commit()
    return await _user_detail(db, user_id)


# ---------------------------------------------------------------------------
# Événements
# ---------------------------------------------------------------------------


def _events() -> Select[Any]:
    def guests(*where: Any) -> Any:
        return (
            select(func.count())
            .select_from(Guest)
            .where(Guest.event_id == Event.id, *where)
            .scalar_subquery()
        )

    def joined(model: Any, on: Any, *where: Any) -> Any:
        return (
            select(func.count())
            .select_from(model)
            .join(Guest, on)
            .where(Guest.event_id == Event.id, *where)
            .scalar_subquery()
        )

    invited = (
        select(func.count(func.distinct(Message.guest_id)))
        .join(Guest, Guest.id == Message.guest_id)
        .where(
            Guest.event_id == Event.id,
            Message.kind == MessageKind.invitation,
            Message.status.in_(_DONE),
        )
        .scalar_subquery()
    )
    return select(
        Event,
        User.first_name + " " + User.last_name,
        guests(),
        joined(Invitation, Guest.id == Invitation.guest_id),
        invited,
        guests(Guest.rsvp_status == RsvpStatus.confirmed),
        guests(Guest.rsvp_status == RsvpStatus.declined),
        guests(Guest.rsvp_status == RsvpStatus.pending),
        select(func.count())
        .select_from(Checkin)
        .join(Invitation, Invitation.id == Checkin.invitation_id)
        .join(Guest, Guest.id == Invitation.guest_id)
        .where(Guest.event_id == Event.id)
        .scalar_subquery(),
        joined(
            Message,
            Guest.id == Message.guest_id,
            Message.status == MessageStatus.failed,
        ),
    ).join(User, User.id == Event.user_id)


def _event_out(event: Event, organizer: str, *counts: int) -> AdminEvent:
    guests, cards, sent, confirmed, declined, pending, checkins, failed = counts
    return AdminEvent(
        id=event.id,
        title=event.title,
        type=event.type,
        status=event.status,
        starts_at=event.starts_at,
        organizer_id=event.user_id,
        organizer_name=organizer,
        guests=guests,
        cards=cards,
        invitations_sent=sent,
        confirmed=confirmed,
        declined=declined,
        pending=pending,
        checkins=checkins,
        messages_failed=failed,
    )


@router.get("/events")
async def events(
    _: AdminAuth,
    db: DbSession,
    q: str = "",
    status_: Annotated[EventStatus | None, Query(alias="status")] = None,
    period: Literal["upcoming", "past"] | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminEventPage:
    """Événements de tous les comptes. À venir : du plus proche au plus lointain ; sinon, les plus récents d'abord."""
    now = datetime.now(UTC)
    where: list[Any] = []
    if q.strip():
        pattern = _like(q)
        where.append(
            or_(
                Event.title.ilike(pattern),
                (User.first_name + " " + User.last_name).ilike(pattern),
            )
        )
    if status_ is not None:
        where.append(Event.status == status_)
    if period == "upcoming":
        where.append(Event.starts_at > now)
    elif period == "past":
        where.append(Event.starts_at <= now)
    total = await db.scalar(
        select(func.count())
        .select_from(Event)
        .join(User, User.id == Event.user_id)
        .where(*where)
    )
    order = Event.starts_at.asc() if period == "upcoming" else Event.starts_at.desc()
    rows = (
        await db.execute(
            _events().where(*where).order_by(order).limit(limit).offset(offset)
        )
    ).all()
    return AdminEventPage(total=total or 0, items=[_event_out(*r) for r in rows])


# ---------------------------------------------------------------------------
# Réglages de la plateforme
# ---------------------------------------------------------------------------


def _values(settings: Settings) -> PlatformValues:
    values = {key: getattr(settings, key) for key in EDITABLE}
    values["whatsapp_reminder_days_before"] = settings.reminder_days_before
    return PlatformValues(**values)


async def _settings_out(db: AsyncSession) -> PlatformSettingsOut:
    env = env_settings()
    rows = (
        await db.execute(select(PlatformSetting.key, PlatformSetting.updated_at))
    ).all()
    overridden = sorted(key for key, _ in rows if key in EDITABLE)
    return PlatformSettingsOut(
        values=_values(get_settings()),
        defaults=_values(env),
        overridden=overridden,
        providers=[
            ProviderOption(
                value="console",
                label="Mode test (aucun envoi)",
                available=True,
                configured=True,
            ),
            ProviderOption(
                value="wasender",
                label="WasenderAPI",
                available=True,
                configured=bool(env.wasender_api_key),
            ),
            # Connecteurs à écrire (voir TODO) : affichés, mais pas encore sélectionnables.
            ProviderOption(
                value="diffuz", label="Diffuz", available=False, configured=False
            ),
            ProviderOption(
                value="meta",
                label="API officielle Meta",
                available=False,
                configured=False,
            ),
        ],
        updated_at=max((at for _, at in rows), default=None),
    )


@router.get("/settings")
async def platform_settings(_: AdminAuth, db: DbSession) -> PlatformSettingsOut:
    await refresh_settings(db)
    return await _settings_out(db)


@router.patch("/settings")
async def update_platform_settings(
    body: PlatformSettingsIn, auth: AdminAuth, db: DbSession
) -> PlatformSettingsOut:
    """Modifie les réglages : pris en compte par l'API tout de suite, par le worker à son prochain tour."""
    await refresh_settings(db)
    changes: dict[str, Any] = {}
    for key in body.model_fields_set:
        value = getattr(body, key)
        if key == "whatsapp_reminder_days_before" and value is not None:
            value = ",".join(str(d) for d in sorted(set(value), reverse=True))
        changes[key] = value

    # Valeurs en vigueur après la modification, pour les contrôles croisés.
    env = env_settings()
    effective = get_settings().model_copy(
        update={k: getattr(env, k) if v is None else v for k, v in changes.items()}
    )
    if effective.whatsapp_min_delay_seconds > effective.whatsapp_max_delay_seconds:
        raise _refused("Le délai minimum doit être inférieur ou égal au délai maximum.")
    if effective.whatsapp_send_start_hour >= effective.whatsapp_send_end_hour:
        raise _refused("L'heure de fin des envois doit être après l'heure de début.")
    if (
        changes.get("whatsapp_provider") == "wasender"
        and not effective.wasender_api_key
    ):
        raise _refused(
            "WasenderAPI n'est pas configuré : ajoutez WASENDER_API_KEY dans l'environnement."
        )

    for key, value in changes.items():
        if value is None:
            await db.execute(delete(PlatformSetting).where(PlatformSetting.key == key))
        else:
            await db.execute(
                insert(PlatformSetting)
                .values(key=key, value=value, updated_by=auth.user.id)
                .on_conflict_do_update(
                    index_elements=[PlatformSetting.key],
                    set_={
                        "value": value,
                        "updated_by": auth.user.id,
                        "updated_at": func.now(),
                    },
                )
            )
    await db.commit()
    await refresh_settings(db)
    return await _settings_out(db)


def _refused(message: str) -> HTTPException:
    return HTTPException(
        status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"message": message}
    )
