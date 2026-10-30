"""Étape 4 « Les relances » : envoi des invitations sur WhatsApp, relances et suivi."""

import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentAuth, DbSession
from app.config import get_settings
from app.messaging import (
    MAX_REMINDER_DATES,
    now,
    queue_invitations,
    queue_reminders,
    reminder_dates,
    reminder_moment,
)
from app.models import (
    Call,
    Event,
    Guest,
    InboundMessage,
    Invitation,
    Message,
    MessageKind,
    MessageStatus,
    RsvpStatus,
    User,
)
from app.routers.events import owned_event
from app.routers.invitations import responses_until
from app.schemas import (
    InboundOut,
    MessageCounts,
    MessageOut,
    QueueResult,
    WhatsAppOverview,
    WhatsAppSettingsIn,
)
from app.whatsapp import get_provider

router = APIRouter(tags=["whatsapp"])

_DONE = (MessageStatus.sent, MessageStatus.delivered, MessageStatus.read)


async def _overview(db: AsyncSession, event: Event, owner: User) -> WhatsAppOverview:
    provider = get_provider()
    counts = {
        MessageKind.invitation: MessageCounts(),
        MessageKind.reminder: MessageCounts(),
    }
    for kind, state, n in (
        await db.execute(
            select(Message.kind, Message.status, func.count())
            .join(Guest, Guest.id == Message.guest_id)
            .where(Guest.event_id == event.id)
            .group_by(Message.kind, Message.status)
        )
    ).all():
        field = "scheduled" if state == MessageStatus.sending else state.value
        setattr(counts[kind], field, getattr(counts[kind], field) + n)

    guests = (
        await db.execute(
            select(
                Guest.id,
                Guest.phone_valid,
                Guest.rsvp_status,
                Invitation.id,
                select(func.array_agg(Message.status))
                .where(
                    Message.guest_id == Guest.id, Message.kind == MessageKind.invitation
                )
                .scalar_subquery(),
            )
            .outerjoin(Invitation, Invitation.guest_id == Guest.id)
            .where(Guest.event_id == event.id)
        )
    ).all()
    ready = without_phone = without_card = to_remind = 0
    for _, phone_valid, rsvp, invitation_id, statuses in guests:
        statuses = [
            s
            for s in statuses or []
            if s not in (MessageStatus.failed, MessageStatus.canceled)
        ]
        if invitation_id is None:
            without_card += 1
        elif not phone_valid:
            without_phone += 1
        elif not statuses:
            ready += 1
        elif rsvp == RsvpStatus.pending and any(s in _DONE for s in statuses):
            to_remind += 1

    recent = (
        await db.execute(
            select(Message, Guest.display_name)
            .join(Guest, Guest.id == Message.guest_id)
            .where(Guest.event_id == event.id)
            .order_by(func.coalesce(Message.sent_at, Message.scheduled_at).desc())
            .limit(30)
        )
    ).all()
    inbound = (
        await db.execute(
            select(InboundMessage, Guest.display_name)
            .join(Guest, Guest.id == InboundMessage.guest_id)
            .where(Guest.event_id == event.id)
            .order_by(InboundMessage.received_at.desc())
            .limit(20)
        )
    ).all()
    calls = await db.scalar(
        select(func.count())
        .select_from(Call)
        .join(Guest, Guest.id == Call.guest_id)
        .where(Guest.event_id == event.id, Call.called_at.is_(None))
    )
    settings = get_settings()
    return WhatsAppOverview(
        provider=provider.name,
        configured=provider.configured,
        reminders_enabled=event.whatsapp_reminders_enabled,
        reminder_days_before=settings.reminder_days_before,
        reminder_dates=reminder_dates(event.starts_at, event.reminder_dates),
        reminder_dates_chosen=event.reminder_dates is not None,
        max_reminder_dates=MAX_REMINDER_DATES,
        calls_enabled=event.call_reminders_enabled,
        on_demand_reminders=_on_demand(owner),
        ready=ready,
        without_phone=without_phone,
        without_card=without_card,
        to_remind=to_remind,
        calls_scheduled=calls or 0,
        invitations_opened=await db.scalar(
            select(func.count())
            .select_from(Invitation)
            .join(Guest, Guest.id == Invitation.guest_id)
            .where(Guest.event_id == event.id, Invitation.opened_at.is_not(None))
        )
        or 0,
        invitations=counts[MessageKind.invitation],
        reminders=counts[MessageKind.reminder],
        recent=[
            MessageOut(
                id=m.id,
                guest_name=name,
                kind=m.kind,
                status=m.status,
                scheduled_at=m.scheduled_at,
                sent_at=m.sent_at,
                error=m.error,
            )
            for m, name in recent
        ],
        inbound=[
            InboundOut(id=i.id, guest_name=name, body=i.body, received_at=i.received_at)
            for i, name in inbound
        ],
    )


@router.get("/events/{event_id}/whatsapp")
async def whatsapp_overview(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> WhatsAppOverview:
    return await _overview(db, await owned_event(db, event_id, auth.user.id), auth.user)


@router.patch("/events/{event_id}/whatsapp")
async def whatsapp_settings(
    event_id: uuid.UUID, body: WhatsAppSettingsIn, auth: CurrentAuth, db: DbSession
) -> WhatsAppOverview:
    """Relances automatiques sur WhatsApp et appels de la conseillère après la dernière relance."""
    event = await owned_event(db, event_id, auth.user.id)
    if body.reminders_enabled is not None:
        event.whatsapp_reminders_enabled = body.reminders_enabled
    if body.calls_enabled is not None:
        event.call_reminders_enabled = body.calls_enabled
    if "reminder_dates" in body.model_fields_set:
        event.reminder_dates = _checked_reminder_dates(event, body.reminder_dates)
    await db.commit()
    return await _overview(db, event, auth.user)


def _on_demand(user: User) -> bool:
    """Relances à la demande : activées sur le compte (portail admin), ou pour tous (WHATSAPP_ON_DEMAND_REMINDERS)."""
    return user.on_demand_reminders or get_settings().whatsapp_on_demand_reminders


def _checked_reminder_dates(event: Event, days: list[date] | None) -> list[date] | None:
    """Dates de relance choisies : seules les nouvelles sont contrôlées (une date déjà enregistrée
    peut être passée, ou se retrouver après l'événement s'il a été avancé : on peut la retirer)."""
    if days is None:
        return None
    chosen = sorted(set(days))
    if len(chosen) > MAX_REMINDER_DATES:
        raise _refused(f"{MAX_REMINDER_DATES} dates de relance au maximum.")
    current = set(reminder_dates(event.starts_at, event.reminder_dates))
    stop = timedelta(hours=get_settings().whatsapp_reminder_stop_hours)
    for day in set(chosen) - current:
        if day < now().date():
            raise _refused("Cette date est passée. Choisissez une date à venir.")
        if reminder_moment(day) > event.starts_at - stop:
            raise _refused("Choisissez une date au plus tard la veille de l'événement.")
        if event.rsvp_deadline and reminder_moment(day) > event.rsvp_deadline:
            raise _refused(
                "Choisissez une date avant la date limite de réponse : "
                "après, vos invités ne peuvent plus répondre."
            )
    return chosen


def _refused(message: str) -> HTTPException:
    return HTTPException(
        status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"message": message}
    )


@router.post(
    "/events/{event_id}/whatsapp/invitations", status_code=status.HTTP_202_ACCEPTED
)
async def send_invitations(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> QueueResult:
    """Met en file l'invitation de chaque invité prêt. Le worker les envoie une à une."""
    event = await owned_event(db, event_id, auth.user.id)
    has_cards = await db.scalar(
        select(func.count())
        .select_from(Invitation)
        .join(Guest, Guest.id == Invitation.guest_id)
        .where(Guest.event_id == event.id)
    )
    if not has_cards:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"message": "Préparez d'abord les cartes de vos invités (étape 3)."},
        )
    queued, without_phone = await queue_invitations(db, event)
    if not queued:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "message": "Toutes les invitations sont déjà envoyées ou en cours d'envoi."
            },
        )
    await db.commit()
    return QueueResult(queued=queued, without_phone=without_phone)


@router.post(
    "/events/{event_id}/whatsapp/reminders", status_code=status.HTTP_202_ACCEPTED
)
async def send_reminders(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> QueueResult:
    """Relance à la demande des invités sans réponse. Option payante, activée par compte (portail admin)."""
    if not _on_demand(auth.user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Les relances à la demande sont une option, non activée sur votre compte."
            },
        )
    event = await owned_event(db, event_id, auth.user.id)
    if responses_until(event) <= datetime.now(UTC):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "message": "La date limite de réponse est passée : vos invités ne peuvent plus répondre."
            },
        )
    queued = await queue_reminders(db, event)
    if not queued:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "message": "Aucun invité à relancer : tous ont répondu, ou une relance est déjà en cours."
            },
        )
    await db.commit()
    return QueueResult(queued=queued)
