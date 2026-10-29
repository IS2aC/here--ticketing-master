"""Portail admin (équipe Here!, rôle admin) : suivi des utilisateurs et des événements, réglages."""

import uuid
from datetime import UTC, datetime, timedelta
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
    AdminEvent,
    AdminEventPage,
    AdminOverview,
    AdminUser,
    AdminUserDetail,
    AdminUserPage,
    AdminUserUpdate,
    PlatformSettingsIn,
    PlatformSettingsOut,
    PlatformValues,
    ProviderOption,
)
from app.whatsapp import get_provider

router = APIRouter(prefix="/admin", tags=["admin"])

_DONE = (MessageStatus.sent, MessageStatus.delivered, MessageStatus.read)
_QUEUED = (MessageStatus.scheduled, MessageStatus.sending)


def _like(q: str) -> str:
    escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


# ---------------------------------------------------------------------------
# Vue d'ensemble
# ---------------------------------------------------------------------------


@router.get("/overview")
async def overview(_: AdminAuth, db: DbSession) -> AdminOverview:
    now = datetime.now(UTC)
    organizers = select(func.count()).where(User.role == UserRole.organizer)
    events = dict.fromkeys(EventStatus, 0)
    for state, n in (
        await db.execute(select(Event.status, func.count()).group_by(Event.status))
    ).all():
        events[state] = n
    rsvp = dict.fromkeys(RsvpStatus, 0)
    for state, n in (
        await db.execute(
            select(Guest.rsvp_status, func.count()).group_by(Guest.rsvp_status)
        )
    ).all():
        rsvp[state] = n

    def messages(*where: Any) -> Select[tuple[int]]:
        return select(func.count()).select_from(Message).where(*where)

    provider = get_provider()
    return AdminOverview(
        organizers=await db.scalar(organizers) or 0,
        organizers_last_7_days=await db.scalar(
            organizers.where(User.created_at >= now - timedelta(days=7))
        )
        or 0,
        events=events,
        upcoming_events=await db.scalar(
            select(func.count()).where(
                Event.starts_at > now, Event.status != EventStatus.cancelled
            )
        )
        or 0,
        guests=sum(rsvp.values()),
        rsvp=rsvp,
        invitations_sent=await db.scalar(
            messages(Message.kind == MessageKind.invitation, Message.status.in_(_DONE))
        )
        or 0,
        reminders_sent=await db.scalar(
            messages(Message.kind == MessageKind.reminder, Message.status.in_(_DONE))
        )
        or 0,
        messages_queued=await db.scalar(messages(Message.status.in_(_QUEUED))) or 0,
        messages_failed=await db.scalar(
            messages(Message.status == MessageStatus.failed)
        )
        or 0,
        checkins=await db.scalar(select(func.count()).select_from(Checkin)) or 0,
        calls_scheduled=await db.scalar(
            select(func.count()).where(Call.called_at.is_(None))
        )
        or 0,
        provider=provider.name,
        provider_configured=provider.configured,
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
