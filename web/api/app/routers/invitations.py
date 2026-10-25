import base64
import hashlib
import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentAuth, DbSession
from app.models import (
    CardTemplate,
    Event,
    EventCard,
    EventStatus,
    EventType,
    Guest,
    GuestCategory,
    Invitation,
    RsvpStatus,
)
from app.routers.events import owned_event
from app.schemas import InvitationResponse, InvitationsResult, PublicCard

router = APIRouter(tags=["invitations"])

# Famille visuelle de la carte selon le type d'événement (modèles de uiux/visual-identity/mockups/carte-*).
TEMPLATE_BY_TYPE: dict[EventType, str] = {
    EventType.mariage: "ceremonie",
    EventType.dot: "ceremonie",
    EventType.bapteme: "ceremonie",
    EventType.funerailles: "hommage",
    EventType.anniversaire: "rendez_vous",
    EventType.brunch: "rendez_vous",
    EventType.retrouvailles: "rendez_vous",
    EventType.reunion: "officiel",
    EventType.seminaire: "officiel",
    EventType.concert_prive: "soiree",
    EventType.festival: "soiree",
    EventType.autre: "rendez_vous",
}


def invitation_code(token: str) -> str:
    """Code lisible imprimé sur la carte (« INV-7KQ2-M4XD »), dérivé du jeton sans le révéler."""
    digest = base64.b32encode(hashlib.sha256(token.encode()).digest()).decode()
    return f"INV-{digest[:4]}-{digest[4:8]}"


async def _event_card(db: AsyncSession, event: Event) -> EventCard:
    """Carte de l'événement (une seule, choisie d'après le type ; mise à jour si le type a changé)."""
    template_id = await db.scalar(
        select(CardTemplate.id).where(CardTemplate.code == TEMPLATE_BY_TYPE[event.type])
    )
    card = await db.scalar(
        select(EventCard).where(
            EventCard.event_id == event.id, EventCard.category_id.is_(None)
        )
    )
    if card is None:
        card = EventCard(event_id=event.id, template_id=template_id)
        db.add(card)
        await db.flush()
    else:
        card.template_id = template_id
    return card


@router.post("/events/{event_id}/invitations")
async def generate_invitations(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> InvitationsResult:
    """Crée une invitation (jeton du QR code) pour chaque invité qui n'en a pas encore. Rien n'est envoyé."""
    event = await owned_event(db, event_id, auth.user.id)
    guests = (
        await db.execute(
            select(Guest.id, Guest.phone_valid, Invitation.id)
            .outerjoin(Invitation, Invitation.guest_id == Guest.id)
            .where(Guest.event_id == event.id)
        )
    ).all()
    if not guests:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"message": "Importez d'abord votre liste d'invités."},
        )
    card = await _event_card(db, event)
    missing = [
        guest_id for guest_id, _, invitation_id in guests if invitation_id is None
    ]
    db.add_all(
        Invitation(guest_id=g, event_card_id=card.id, token=secrets.token_urlsafe(24))
        for g in missing
    )
    await db.commit()
    return InvitationsResult(
        total=len(guests),
        created=len(missing),
        without_phone=sum(not valid for _, valid, _ in guests),
    )


def _responses_open(event: Event) -> bool:
    return event.status != EventStatus.cancelled and event.starts_at > datetime.now(UTC)


async def _by_token(
    db: AsyncSession, token: str, *, lock: bool = False
) -> tuple[Event, Guest, str]:
    query = (
        select(Event, Guest, GuestCategory.name)
        .join(Guest, Guest.event_id == Event.id)
        .join(GuestCategory, GuestCategory.id == Guest.category_id)
        .join(Invitation, Invitation.guest_id == Guest.id)
        .where(Invitation.token == token)
    )
    row = (
        await db.execute(query.with_for_update(of=Guest) if lock else query)
    ).one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invitation introuvable.")
    return row[0], row[1], row[2]


def _public_card(token: str, event: Event, guest: Guest, category: str) -> PublicCard:
    return PublicCard(
        code=invitation_code(token),
        event_type=event.type,
        title=event.title,
        starts_at=event.starts_at,
        duration_minutes=event.duration_minutes,
        location_name=event.location_name,
        location_address=event.location_address,
        dress_code=event.dress_code,
        guest_name=guest.display_name,
        category=category,
        seat=guest.seat,
        seats=guest.seats,
        rsvp_status=guest.rsvp_status,
        attending_seats=guest.attending_seats,
        rsvp_message=guest.rsvp_message,
        responses_open=_responses_open(event),
    )


@router.get("/invitations/{token}")
async def public_card(token: str, db: DbSession) -> PublicCard:
    """Public : le jeton (long et aléatoire) est la seule clé. Ne renvoie que ce qui concerne cet invité."""
    return _public_card(token, *await _by_token(db, token))


@router.post("/invitations/{token}/response")
async def respond(token: str, body: InvitationResponse, db: DbSession) -> PublicCard:
    """Réponse de l'invité depuis sa page. Il peut changer d'avis jusqu'au début de l'événement."""
    event, guest, category = await _by_token(db, token, lock=True)
    if not _responses_open(event):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"message": "Les réponses sont closes pour cet événement."},
        )
    if body.attending:
        seats = body.seats or guest.seats
        if seats > guest.seats:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=[
                    {
                        "loc": ["body", "seats"],
                        "msg": f"Votre invitation compte {guest.seats} place(s).",
                    }
                ],
            )
        guest.rsvp_status = RsvpStatus.confirmed
        guest.attending_seats = seats
    else:
        guest.rsvp_status = RsvpStatus.declined
        guest.attending_seats = 0
    # Un message vide ne remplace pas un mot déjà laissé (ex. : « Finalement, je viendrai »).
    if body.message is not None:
        guest.rsvp_message = body.message
    guest.responded_at = datetime.now(UTC)
    await db.commit()
    return _public_card(token, event, guest, category)
