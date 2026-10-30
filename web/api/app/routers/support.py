"""Écran de la conseillère (rôles admin et support) : file d'appels et messages des invités à traiter."""

import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import aliased

from app.auth import DbSession, StaffAuth
from app.messaging import cancel_reminders
from app.models import (
    Call,
    CallOutcome,
    ContactStatus,
    Event,
    Guest,
    GuestCategory,
    InboundMessage,
    Message,
    MessageKind,
    MessageStatus,
    RsvpStatus,
    User,
)
from app.schemas import (
    CallResultIn,
    HandledIn,
    StaffCall,
    StaffCallPage,
    StaffMessage,
    StaffMessagePage,
)

router = APIRouter(prefix="/admin", tags=["conseillère"])

_DONE = (MessageStatus.sent, MessageStatus.delivered, MessageStatus.read)
Agent = aliased(User)
Host = aliased(User)


def _calls_query():
    reminders = (
        select(func.count())
        .where(
            Message.guest_id == Guest.id,
            Message.kind == MessageKind.reminder,
            Message.status.in_(_DONE),
        )
        .scalar_subquery()
    )
    return (
        select(
            Call,
            Guest,
            GuestCategory.name,
            Event,
            Host.first_name + " " + Host.last_name,
            Agent.first_name,
            reminders,
        )
        .join(Guest, Guest.id == Call.guest_id)
        .join(GuestCategory, GuestCategory.id == Guest.category_id)
        .join(Event, Event.id == Guest.event_id)
        .join(Host, Host.id == Event.user_id)
        .outerjoin(Agent, Agent.id == Call.agent_id)
    )


def _call_out(row) -> StaffCall:
    call, guest, category, event, host, agent, reminders = row
    return StaffCall(
        id=call.id,
        guest_id=guest.id,
        guest_name=guest.display_name,
        phone=guest.phone,
        phone_valid=guest.phone_valid,
        category=category,
        seats=guest.seats,
        rsvp_status=guest.rsvp_status,
        event_id=event.id,
        event_title=event.title,
        event_type=event.type,
        event_starts_at=event.starts_at,
        host=host,
        reminders_sent=reminders or 0,
        scheduled_at=call.scheduled_at,
        called_at=call.called_at,
        outcome=call.outcome,
        notes=call.notes,
        agent_name=agent,
    )


@router.get("/calls")
async def calls(
    _: StaffAuth,
    db: DbSession,
    state: Literal["a-faire", "faits"] = "a-faire",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> StaffCallPage:
    """À faire : l'événement le plus proche d'abord. Faits : les plus récents d'abord."""
    to_do = await db.scalar(select(func.count()).where(Call.called_at.is_(None)))
    done = await db.scalar(select(func.count()).where(Call.called_at.is_not(None)))
    query = _calls_query()
    if state == "a-faire":
        query = query.where(Call.called_at.is_(None)).order_by(
            Event.starts_at, Call.scheduled_at
        )
    else:
        query = query.where(Call.called_at.is_not(None)).order_by(Call.called_at.desc())
    rows = (await db.execute(query.limit(limit))).all()
    return StaffCallPage(
        to_do=to_do or 0, done=done or 0, items=[_call_out(r) for r in rows]
    )


@router.post("/calls/{call_id}/result")
async def call_result(
    call_id: uuid.UUID, body: CallResultIn, auth: StaffAuth, db: DbSession
) -> StaffCall:
    """Résultat de l'appel. Confirmé ou décliné : la réponse de l'invité est mise à jour ;
    pas de réponse ou mauvais numéro : il passe en « Injoignable »."""
    call = await db.get(Call, call_id)
    if call is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Appel introuvable.")
    guest = await db.get(Guest, call.guest_id)
    now = datetime.now(UTC)
    call.called_at, call.outcome, call.notes = now, body.outcome, body.notes or None
    call.agent_id = auth.user.id
    if body.outcome in (CallOutcome.confirmed, CallOutcome.declined):
        attending = body.outcome == CallOutcome.confirmed
        guest.rsvp_status = RsvpStatus.confirmed if attending else RsvpStatus.declined
        guest.attending_seats = guest.seats if attending else 0
        guest.responded_at = now
        await cancel_reminders(db, guest.id)
    else:
        guest.contact_status = ContactStatus.unreachable
        if body.outcome == CallOutcome.wrong_number:
            guest.phone_valid = False  # à corriger par l'organisateur
    await db.commit()
    row = (await db.execute(_calls_query().where(Call.id == call_id))).one()
    return _call_out(row)


@router.get("/inbound")
async def inbound(
    _: StaffAuth,
    db: DbSession,
    state: Literal["a-traiter", "traites"] = "a-traiter",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> StaffMessagePage:
    """Messages libres des invités sur WhatsApp (« On sera 3 »…), les plus récents d'abord."""
    to_do = await db.scalar(
        select(func.count()).where(InboundMessage.handled_at.is_(None))
    )
    done = await db.scalar(
        select(func.count()).where(InboundMessage.handled_at.is_not(None))
    )
    query = (
        select(InboundMessage, Guest.display_name, Guest.rsvp_status, Event.title)
        .outerjoin(Guest, Guest.id == InboundMessage.guest_id)
        .outerjoin(Event, Event.id == Guest.event_id)
        .where(
            InboundMessage.handled_at.is_(None)
            if state == "a-traiter"
            else InboundMessage.handled_at.is_not(None)
        )
        .order_by(InboundMessage.received_at.desc())
        .limit(limit)
    )
    items = [
        StaffMessage(
            id=m.id,
            body=m.body,
            phone=m.phone,
            received_at=m.received_at,
            handled_at=m.handled_at,
            guest_id=m.guest_id,
            guest_name=name,
            rsvp_status=rsvp,
            event_title=title,
        )
        for m, name, rsvp, title in (await db.execute(query)).all()
    ]
    return StaffMessagePage(to_do=to_do or 0, done=done or 0, items=items)


@router.post("/inbound/{message_id}/handled", status_code=status.HTTP_204_NO_CONTENT)
async def mark_handled(
    message_id: uuid.UUID, body: HandledIn, _: StaffAuth, db: DbSession
) -> None:
    message = await db.get(InboundMessage, message_id)
    if message is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Message introuvable.")
    message.handled_at = datetime.now(UTC) if body.handled else None
    await db.commit()
