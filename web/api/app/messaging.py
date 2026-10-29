"""Invitations et relances WhatsApp : file d'envoi (table messages), envoi, relances, webhooks.

La file est lue par le worker (app/worker.py), un message à la fois. L'organisateur ne fait que
mettre des messages en file ; l'envoi réel dépend de WHATSAPP_PROVIDER (voir app/whatsapp).
"""

import asyncio
import logging
import random
import uuid
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import and_, exists, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import (
    Call,
    ContactStatus,
    Event,
    EventStatus,
    Guest,
    InboundMessage,
    Invitation,
    Message,
    MessageKind,
    MessageStatus,
    RsvpStatus,
)
from app.whatsapp import ProviderError, WhatsAppProvider
from app.whatsapp.texts import answer_from_option, message_content

log = logging.getLogger("here.messaging")

MAX_ATTEMPTS = 5
# Statut d'un message : ne recule jamais (un « lu » ne redevient pas « livré »).
_RANK = {
    MessageStatus.sent: 1,
    MessageStatus.delivered: 2,
    MessageStatus.read: 3,
}
_ACTIVE = (MessageStatus.scheduled, MessageStatus.sending)
_DONE = (MessageStatus.sent, MessageStatus.delivered, MessageStatus.read)


def guest_link(token: str) -> str:
    return f"{get_settings().public_app_url.rstrip('/')}/i/{token}"


def card_image_url(token: str) -> str:
    return f"{guest_link(token)}/carte.png"


def now() -> datetime:
    return datetime.now(UTC)


MAX_REMINDER_DATES = 5


def reminder_dates(starts_at: datetime, chosen: list[date] | None) -> list[date]:
    """Dates de relance d'un événement : celles choisies par l'organisateur, sinon le calendrier proposé
    (WHATSAPP_REMINDER_DAYS_BEFORE, « 7 » par défaut), qui suit la date de l'événement."""
    if chosen is not None:
        return sorted(set(chosen))
    # Heure d'Abidjan = UTC : le jour UTC est le jour local.
    return sorted(
        {
            (starts_at - timedelta(days=d)).date()
            for d in get_settings().reminder_days_before
        }
    )


def reminder_moment(day: date) -> datetime:
    """Une relance part le jour prévu, dès l'ouverture des envois (heure d'Abidjan = UTC)."""
    return datetime.combine(day, time(get_settings().whatsapp_send_start_hour), UTC)


# ---------------------------------------------------------------------------
# Mise en file (organisateur)
# ---------------------------------------------------------------------------


def _has_message(kinds: tuple[MessageKind, ...], statuses: tuple[MessageStatus, ...]):
    return exists().where(
        Message.guest_id == Guest.id,
        Message.kind.in_(kinds),
        Message.status.in_(statuses),
    )


async def queue_invitations(db: AsyncSession, event: Event) -> tuple[int, int]:
    """Met en file l'invitation de chaque invité qui a sa carte et un numéro valide, et qui ne l'a pas
    encore reçue (ni en file). Renvoie (mis en file, sans numéro valide)."""
    rows = (
        await db.execute(
            select(Guest.id, Guest.phone_valid)
            .join(Invitation, Invitation.guest_id == Guest.id)
            .where(
                Guest.event_id == event.id,
                ~_has_message((MessageKind.invitation,), (*_ACTIVE, *_DONE)),
            )
        )
    ).all()
    ready = [guest_id for guest_id, valid in rows if valid]
    db.add_all(Message(guest_id=g, kind=MessageKind.invitation) for g in ready)
    if ready and event.status == EventStatus.draft:
        event.status = EventStatus.active
    return len(ready), sum(not valid for _, valid in rows)


async def queue_reminders(db: AsyncSession, event: Event) -> int:
    """Relance tout de suite les invités sans réponse qui ont reçu leur invitation."""
    guest_ids = (
        await db.scalars(
            select(Guest.id).where(
                Guest.event_id == event.id,
                Guest.rsvp_status == RsvpStatus.pending,
                Guest.phone_valid.is_(True),
                _has_message((MessageKind.invitation,), _DONE),
                ~_has_message((MessageKind.invitation, MessageKind.reminder), _ACTIVE),
            )
        )
    ).all()
    db.add_all(Message(guest_id=g, kind=MessageKind.reminder) for g in guest_ids)
    return len(guest_ids)


async def cancel_reminders(db: AsyncSession, guest_id: uuid.UUID) -> None:
    """L'invité a répondu : ses relances en attente ne partiront pas."""
    await db.execute(
        update(Message)
        .where(
            Message.guest_id == guest_id,
            Message.kind == MessageKind.reminder,
            Message.status == MessageStatus.scheduled,
        )
        .values(status=MessageStatus.canceled)
    )


# ---------------------------------------------------------------------------
# Relances automatiques et file d'appels (worker, toutes les quelques minutes)
# ---------------------------------------------------------------------------


async def plan_follow_ups(db: AsyncSession) -> tuple[int, int]:
    """Programme les relances dues et, après la dernière, un appel de la conseillère.

    Relances aux dates de l'événement (voir reminder_dates : choisies par l'organisateur, sinon
    7 jours avant). Une relance n'est due que si l'invitation est partie avant ce moment, que l'invité
    n'a pas répondu, et jamais dans les WHATSAPP_REMINDER_STOP_HOURS avant l'événement. Appel : WHATSAPP_CALL_DELAY_DAYS après la dernière relance restée sans réponse.
    Renvoie (relances programmées, appels programmés)."""
    settings = get_settings()
    current = now()
    invited_at = (
        select(func.min(Message.sent_at))
        .where(
            Message.guest_id == Guest.id,
            Message.kind == MessageKind.invitation,
            Message.status.in_(_DONE),
        )
        .scalar_subquery()
    )
    last_sent = (
        select(func.max(Message.sent_at))
        .where(Message.guest_id == Guest.id, Message.status.in_(_DONE))
        .scalar_subquery()
    )
    reminders_sent = (
        select(func.count())
        .where(
            Message.guest_id == Guest.id,
            Message.kind == MessageKind.reminder,
            Message.status.in_(_DONE),
        )
        .scalar_subquery()
    )
    has_call = exists().where(Call.guest_id == Guest.id)
    candidates = (
        await db.execute(
            select(
                Guest.id,
                Guest.contact_status,
                Event.starts_at,
                Event.reminder_dates,
                Event.whatsapp_reminders_enabled,
                Event.call_reminders_enabled,
                invited_at,
                last_sent,
                reminders_sent,
                has_call,
            )
            .join(Event, Event.id == Guest.event_id)
            .where(
                Guest.rsvp_status == RsvpStatus.pending,
                Guest.phone_valid.is_(True),
                Event.status != EventStatus.cancelled,
                Event.starts_at > current,
                or_(
                    Event.whatsapp_reminders_enabled.is_(True),
                    Event.call_reminders_enabled.is_(True),
                ),
                invited_at.is_not(None),
                ~_has_message((MessageKind.invitation, MessageKind.reminder), _ACTIVE),
            )
        )
    ).all()

    due_reminders: list[uuid.UUID] = []
    due_calls: list[uuid.UUID] = []
    stop = timedelta(hours=settings.whatsapp_reminder_stop_hours)
    for (
        guest_id,
        contact,
        starts_at,
        chosen,
        reminders_on,
        calls_on,
        invited,
        last,
        sent,
        called,
    ) in candidates:
        # Relances prévues pour cet invité : après son invitation, et avant l'arrêt des relances.
        planned = [
            moment
            for day in reminder_dates(starts_at, chosen)
            if invited < (moment := reminder_moment(day)) <= starts_at - stop
        ]
        due = sum(moment <= current for moment in planned)
        if reminders_on and sent < due and starts_at - current > stop:
            due_reminders.append(guest_id)
        elif (
            calls_on
            and not called
            and contact != ContactStatus.unreachable
            and (not reminders_on or sent >= len(planned))
            and last <= current - timedelta(days=settings.whatsapp_call_delay_days)
        ):
            due_calls.append(guest_id)

    db.add_all(Message(guest_id=g, kind=MessageKind.reminder) for g in due_reminders)
    db.add_all(Call(guest_id=g, scheduled_at=current) for g in due_calls)
    if due_calls:
        await db.execute(
            update(Guest)
            .where(Guest.id.in_(due_calls))
            .values(contact_status=ContactStatus.call_scheduled)
        )
    await db.commit()
    return len(due_reminders), len(due_calls)


# ---------------------------------------------------------------------------
# Envoi (worker)
# ---------------------------------------------------------------------------


async def claim_next(db: AsyncSession) -> uuid.UUID | None:
    """Prend le prochain message dû (un seul worker à la fois peut le prendre)."""
    message = await db.scalar(
        select(Message)
        .where(Message.status == MessageStatus.scheduled, Message.scheduled_at <= now())
        .order_by(Message.scheduled_at, Message.created_at)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    if message is None:
        return None
    message.status = MessageStatus.sending
    message.attempts += 1
    await db.commit()
    return message.id


async def send_message(
    db: AsyncSession,
    provider: WhatsAppProvider,
    message_id: uuid.UUID,
    *,
    poll_delay: tuple[float, float] = (3, 7),
) -> MessageStatus:
    """Envoie un message pris par `claim_next` : la carte avec sa légende (ou le texte d'une relance).

    Un sondage n'est envoyé que si le contenu en prévoit un (plus le cas aujourd'hui). Un message en file
    dont la carte est déjà partie (sondage en attente d'une reprise) passe donc à « envoyé » sans rien renvoyer.
    """
    row = (
        await db.execute(
            select(Message, Guest, Event, Invitation)
            .join(Guest, Guest.id == Message.guest_id)
            .join(Event, Event.id == Guest.event_id)
            .join(Invitation, Invitation.guest_id == Guest.id)
            .where(Message.id == message_id)
        )
    ).one_or_none()
    if row is None:  # invité supprimé, ou plus d'invitation
        await db.execute(
            update(Message)
            .where(Message.id == message_id)
            .values(status=MessageStatus.canceled)
        )
        await db.commit()
        return MessageStatus.canceled
    message, guest, event, invitation = row

    reason = None
    if event.status == EventStatus.cancelled or event.starts_at <= now():
        reason = "Événement annulé ou passé."
    elif not guest.phone_valid or not guest.phone:
        reason = "Numéro à vérifier."
    elif (
        message.kind == MessageKind.reminder and guest.rsvp_status != RsvpStatus.pending
    ):
        reason = "L'invité a déjà répondu."
    if reason:
        message.status, message.error = MessageStatus.canceled, reason
        await db.commit()
        return message.status

    content = message_content(message.kind, event, guest, guest_link(invitation.token))
    message.body = content.text
    try:
        if (
            message.provider_message_id is None
        ):  # une reprise ne renvoie pas la carte déjà partie
            sent = (
                await provider.send_image(
                    guest.phone, card_image_url(invitation.token), content.text
                )
                if content.with_card
                else await provider.send_text(guest.phone, content.text)
            )
            message.provider_message_id, message.whatsapp_id = (
                sent.provider_id,
                sent.whatsapp_id,
            )
            await db.commit()
        if content.poll and message.poll_provider_message_id is None:
            await asyncio.sleep(random.uniform(*poll_delay))
            poll = await provider.send_poll(
                guest.phone, content.poll.question, content.poll.options
            )
            message.poll_provider_message_id = poll.provider_id
            message.poll_whatsapp_id = poll.whatsapp_id
    except ProviderError as error:
        message.error = str(error)[:500]
        if error.retry and message.attempts < MAX_ATTEMPTS:
            message.status = MessageStatus.scheduled
            message.scheduled_at = now() + timedelta(minutes=5 * message.attempts)
        elif (
            message.provider_message_id
        ):  # la carte est partie, seul le sondage a échoué
            message.status, message.sent_at = (
                MessageStatus.sent,
                message.sent_at or now(),
            )
        else:
            message.status = MessageStatus.failed
            if guest.rsvp_status == RsvpStatus.pending:
                guest.contact_status = ContactStatus.unreachable
        await db.commit()
        return message.status

    message.status, message.sent_at, message.error = MessageStatus.sent, now(), None
    if message.kind == MessageKind.invitation and invitation.sent_at is None:
        invitation.sent_at = message.sent_at
    if (
        message.kind == MessageKind.reminder
        and guest.contact_status == ContactStatus.none
    ):
        guest.contact_status = ContactStatus.reminded
    await db.commit()
    return message.status


async def resolve_whatsapp_ids(db: AsyncSession, provider: WhatsAppProvider) -> int:
    """Complète les key.id WhatsApp des messages récents (nécessaires pour relier les webhooks)."""
    messages = (
        await db.scalars(
            select(Message).where(
                Message.sent_at > now() - timedelta(days=2),
                or_(
                    and_(
                        Message.provider_message_id.is_not(None),
                        Message.whatsapp_id.is_(None),
                    ),
                    and_(
                        Message.poll_provider_message_id.is_not(None),
                        Message.poll_whatsapp_id.is_(None),
                    ),
                ),
            )
        )
    ).all()
    resolved = 0
    for message in messages:
        try:
            if message.provider_message_id and not message.whatsapp_id:
                message.whatsapp_id = await provider.whatsapp_id(
                    message.provider_message_id
                )
            if message.poll_provider_message_id and not message.poll_whatsapp_id:
                message.poll_whatsapp_id = await provider.whatsapp_id(
                    message.poll_provider_message_id
                )
            resolved += 1
        except ProviderError as error:
            log.warning("key.id introuvable pour %s : %s", message.id, error)
    await db.commit()
    return resolved


# ---------------------------------------------------------------------------
# Webhooks (statuts, votes, messages des invités)
# ---------------------------------------------------------------------------


async def record_status(
    db: AsyncSession, whatsapp_id: str, status: MessageStatus
) -> bool:
    message = await db.scalar(select(Message).where(Message.whatsapp_id == whatsapp_id))
    if message is None:
        return False
    if status == MessageStatus.failed:
        if message.status not in _DONE:
            message.status = MessageStatus.failed
    elif _RANK.get(status, 0) > _RANK.get(message.status, 0):
        message.status = status
        if status in (MessageStatus.delivered, MessageStatus.read):
            message.delivered_at = message.delivered_at or now()
        if status == MessageStatus.read:
            message.read_at = message.read_at or now()
    await db.commit()
    return True


def _responses_open(event: Event) -> bool:
    return event.status != EventStatus.cancelled and event.starts_at > now()


async def record_vote(db: AsyncSession, poll_whatsapp_id: str, option: str) -> bool:
    """Vote au sondage « Oui / Non » : même effet qu'une réponse sur la page invité (toutes les places)."""
    attending = answer_from_option(option)
    row = (
        await db.execute(
            select(Guest, Event)
            .join(Message, Message.guest_id == Guest.id)
            .join(Event, Event.id == Guest.event_id)
            .where(Message.poll_whatsapp_id == poll_whatsapp_id)
            .with_for_update(of=Guest)
        )
    ).one_or_none()
    if row is None or attending is None:
        return False
    guest, event = row
    if not _responses_open(event):
        return False
    guest.rsvp_status = RsvpStatus.confirmed if attending else RsvpStatus.declined
    guest.attending_seats = guest.seats if attending else 0
    guest.responded_at = now()
    await cancel_reminders(db, guest.id)
    await db.commit()
    return True


async def record_inbound(
    db: AsyncSession, phone: str, body: str, whatsapp_id: str | None
) -> InboundMessage | None:
    """Message libre d'un invité : rattaché à l'invité de ce numéro le plus récemment contacté."""
    if whatsapp_id and await db.scalar(
        select(InboundMessage.id).where(InboundMessage.whatsapp_id == whatsapp_id)
    ):
        return None  # webhook reçu deux fois
    guest_id = await db.scalar(
        select(Guest.id)
        .join(Message, Message.guest_id == Guest.id)
        .where(Guest.phone == phone, Message.sent_at.is_not(None))
        .order_by(Message.sent_at.desc())
        .limit(1)
    )
    inbound = InboundMessage(
        guest_id=guest_id, phone=phone, body=body, whatsapp_id=whatsapp_id
    )
    db.add(inbound)
    await db.commit()
    return inbound
