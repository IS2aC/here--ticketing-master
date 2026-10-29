"""Étape 4 « Les relances » : envoi des invitations sur WhatsApp, relances et suivi."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentAuth, DbSession
from app.config import get_settings
from app.messaging import queue_invitations, queue_reminders
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
)
from app.routers.events import owned_event
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


async def _overview(db: AsyncSession, event: Event) -> WhatsAppOverview:
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
        # Seulement les dates encore à venir : un événement dans moins de 7 jours n'a plus de relance gratuite.
        reminder_dates=[
            date
            for d in settings.reminder_days_before
            if (date := event.starts_at - timedelta(days=d)) > datetime.now(UTC)
        ],
        calls_enabled=event.call_reminders_enabled,
        on_demand_reminders=settings.whatsapp_on_demand_reminders,
        ready=ready,
        without_phone=without_phone,
        without_card=without_card,
        to_remind=to_remind,
        calls_scheduled=calls or 0,
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
    return await _overview(db, await owned_event(db, event_id, auth.user.id))


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
    await db.commit()
    return await _overview(db, event)


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
    """Relance à la demande des invités sans réponse. Option payante (WHATSAPP_ON_DEMAND_REMINDERS)."""
    if not get_settings().whatsapp_on_demand_reminders:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Les relances à la demande sont une option, non activée sur votre compte."
            },
        )
    event = await owned_event(db, event_id, auth.user.id)
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
