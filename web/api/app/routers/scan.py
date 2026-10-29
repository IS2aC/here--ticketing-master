"""Scan à l'entrée : l'organisateur crée des liens de scan ; les agents d'accueil les ouvrent sur leur téléphone.

Un lien de scan ne donne que le droit de vérifier une invitation et d'enregistrer une entrée :
ni tableau de bord, ni numéros de téléphone, ni liste complète des invités (recherche par nom limitée).
"""

import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentAuth, DbSession
from app.models import (
    Checkin,
    Event,
    EventStatus,
    Guest,
    GuestCategory,
    Invitation,
    RsvpStatus,
    ScanLink,
)
from app.routers.events import owned_event
from app.routers.invitations import invitation_code
from app.schemas import (
    ScanCheckIn,
    ScanEvent,
    ScanGuest,
    ScanLinkIn,
    ScanLinkOut,
    ScanResult,
)

router = APIRouter(tags=["scan"])

# Le lien reste valable 12 h après la fin prévue de l'événement.
LINK_GRACE = timedelta(hours=12)
_INVITATION_URL = re.compile(r"/i/([A-Za-z0-9_-]{16,})")
_CODE = re.compile(r"^INV-[A-Z2-7]{4}-[A-Z2-7]{4}$")


def _active(link: ScanLink) -> bool:
    return link.revoked_at is None and link.expires_at > datetime.now(UTC)


# --- Organisateur ---------------------------------------------------------------------------


async def _links_out(db: AsyncSession, event_id: uuid.UUID) -> list[ScanLinkOut]:
    counts = dict(
        (
            await db.execute(
                select(Checkin.scan_link_id, func.count())
                .join(ScanLink, ScanLink.id == Checkin.scan_link_id)
                .where(ScanLink.event_id == event_id)
                .group_by(Checkin.scan_link_id)
            )
        ).all()
    )
    links = await db.scalars(
        select(ScanLink)
        .where(ScanLink.event_id == event_id)
        .order_by(ScanLink.created_at)
    )
    return [
        ScanLinkOut(
            id=link.id,
            label=link.label,
            token=link.token,
            created_at=link.created_at,
            expires_at=link.expires_at,
            revoked_at=link.revoked_at,
            active=_active(link),
            checkins=counts.get(link.id, 0),
        )
        for link in links
    ]


@router.get("/events/{event_id}/scan-links")
async def list_scan_links(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> list[ScanLinkOut]:
    event = await owned_event(db, event_id, auth.user.id)
    return await _links_out(db, event.id)


@router.post("/events/{event_id}/scan-links", status_code=status.HTTP_201_CREATED)
async def create_scan_link(
    event_id: uuid.UUID, body: ScanLinkIn, auth: CurrentAuth, db: DbSession
) -> ScanLinkOut:
    event = await owned_event(db, event_id, auth.user.id)
    end = event.starts_at + timedelta(minutes=event.duration_minutes or 0)
    link = ScanLink(
        event_id=event.id,
        label=body.label,
        token=secrets.token_urlsafe(24),
        expires_at=end + LINK_GRACE,
    )
    db.add(link)
    await db.commit()
    return next(out for out in await _links_out(db, event.id) if out.id == link.id)


@router.post("/events/{event_id}/scan-links/{link_id}/revoke")
async def revoke_scan_link(
    event_id: uuid.UUID, link_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> ScanLinkOut:
    event = await owned_event(db, event_id, auth.user.id)
    link = await db.scalar(
        select(ScanLink).where(ScanLink.id == link_id, ScanLink.event_id == event.id)
    )
    if link is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Lien de scan introuvable."
        )
    link.revoked_at = link.revoked_at or datetime.now(UTC)
    await db.commit()
    return next(out for out in await _links_out(db, event.id) if out.id == link.id)


# --- Agents d'accueil (publics : le jeton du lien est la seule clé) ---------------------------


async def _link(db: AsyncSession, token: str) -> tuple[ScanLink, Event]:
    row = (
        await db.execute(
            select(ScanLink, Event)
            .join(Event, Event.id == ScanLink.event_id)
            .where(ScanLink.token == token)
        )
    ).one_or_none()
    if row is None or not _active(row[0]):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Ce lien de scan n'est plus valide. Demandez un nouveau lien à l'organisateur."
            },
        )
    if row[1].status == EventStatus.cancelled:
        raise HTTPException(
            status.HTTP_410_GONE,
            detail={
                "message": "Cet événement a été annulé : aucune entrée n'est enregistrée."
            },
        )
    return row[0], row[1]


async def _scan_event(db: AsyncSession, link: ScanLink, event: Event) -> ScanEvent:
    arrived = await db.scalar(
        select(func.coalesce(func.sum(Checkin.seats), 0))
        .join(Invitation, Invitation.id == Checkin.invitation_id)
        .join(Guest, Guest.id == Invitation.guest_id)
        .where(Guest.event_id == event.id)
    )
    # Attendus : les invités qui ont confirmé (sans réponse ou « non » : comptés absents).
    expected = await db.scalar(
        select(
            func.coalesce(
                func.sum(func.coalesce(Guest.attending_seats, Guest.seats)), 0
            )
        ).where(Guest.event_id == event.id, Guest.rsvp_status == RsvpStatus.confirmed)
    )
    return ScanEvent(
        title=event.title,
        event_type=event.type,
        starts_at=event.starts_at,
        label=link.label,
        arrived=arrived or 0,
        expected=expected or 0,
    )


def _guest_query(event_id: uuid.UUID):
    return (
        select(Guest, GuestCategory.name, Invitation, Checkin, ScanLink.label)
        .join(GuestCategory, GuestCategory.id == Guest.category_id)
        .join(Invitation, Invitation.guest_id == Guest.id)
        .outerjoin(Checkin, Checkin.invitation_id == Invitation.id)
        .outerjoin(ScanLink, ScanLink.id == Checkin.scan_link_id)
        .where(Guest.event_id == event_id)
    )


def _scan_guest(
    guest: Guest, category: str, invitation: Invitation, checkin: Checkin | None
) -> ScanGuest:
    return ScanGuest(
        guest_id=guest.id,
        name=guest.display_name,
        category=category,
        seat=guest.seat,
        seats=guest.attending_seats or guest.seats,
        rsvp_status=guest.rsvp_status,
        code=invitation_code(invitation.token),
        entered_at=checkin.scanned_at if checkin else None,
    )


@router.get("/scan/{token}")
async def scan_event(token: str, db: DbSession) -> ScanEvent:
    link, event = await _link(db, token)
    return await _scan_event(db, link, event)


@router.post("/scan/{token}/check")
async def check_in(token: str, body: ScanCheckIn, db: DbSession) -> ScanResult:
    """Vérifie une invitation (QR code lu, code saisi ou invité choisi par nom) et enregistre l'entrée."""
    link, event = await _link(db, token)
    query = _guest_query(event.id)
    read_code: str | None = None
    if body.guest_id:
        query = query.where(Guest.id == body.guest_id)
    elif body.value:
        value = body.value.strip()
        if match := _INVITATION_URL.search(value):
            invitation_token = match.group(1)
            read_code = invitation_code(invitation_token)
            query = query.where(Invitation.token == invitation_token)
        elif _CODE.match(value.upper()):
            # Code imprimé sur la carte : dérivé du jeton, on le recalcule pour les invitations de l'événement.
            read_code = value.upper()
            tokens = await db.scalars(
                select(Invitation.token)
                .join(Guest, Guest.id == Invitation.guest_id)
                .where(Guest.event_id == event.id)
            )
            match_token = next(
                (t for t in tokens if invitation_code(t) == read_code), None
            )
            query = query.where(Invitation.token == (match_token or ""))
        else:
            query = query.where(Invitation.token == value)
    else:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"message": "Rien à vérifier."},
        )

    row = (await db.execute(query)).first()
    if row is None:
        return ScanResult(
            result="unknown",
            code=read_code,
            guest=None,
            entered_at=None,
            entered_by=None,
            event=await _scan_event(db, link, event),
        )

    guest, category, invitation, checkin, entered_by = row
    if checkin is None and guest.rsvp_status != RsvpStatus.confirmed:
        # Règle d'entrée : seuls les invités qui ont confirmé entrent. « Non » ou sans réponse : refusé.
        return ScanResult(
            result="refused",
            code=invitation_code(invitation.token),
            guest=_scan_guest(guest, category, invitation, checkin),
            entered_at=None,
            entered_by=None,
            event=await _scan_event(db, link, event),
        )
    if checkin is None:
        # Une seule entrée par invitation, même si deux agents scannent en même temps.
        inserted = await db.scalar(
            insert(Checkin)
            .values(
                invitation_id=invitation.id,
                scan_link_id=link.id,
                seats=guest.attending_seats or guest.seats,
            )
            .on_conflict_do_nothing(index_elements=["invitation_id"])
            .returning(Checkin.id)
        )
        await db.commit()
        if inserted is not None:
            guest, category, invitation, checkin, entered_by = (
                await db.execute(_guest_query(event.id).where(Guest.id == guest.id))
            ).one()
            return ScanResult(
                result="admitted",
                code=invitation_code(invitation.token),
                guest=_scan_guest(guest, category, invitation, checkin),
                entered_at=checkin.scanned_at,
                entered_by=entered_by,
                event=await _scan_event(db, link, event),
            )
        guest, category, invitation, checkin, entered_by = (
            await db.execute(_guest_query(event.id).where(Guest.id == guest.id))
        ).one()

    return ScanResult(
        result="already",
        code=invitation_code(invitation.token),
        guest=_scan_guest(guest, category, invitation, checkin),
        entered_at=checkin.scanned_at,
        entered_by=entered_by,
        event=await _scan_event(db, link, event),
    )


@router.get("/scan/{token}/guests")
async def search_guests(token: str, db: DbSession, q: str = "") -> list[ScanGuest]:
    """« Chercher par nom » : 2 lettres au moins, 20 résultats au plus, sans numéro de téléphone."""
    _, event = await _link(db, token)
    words = [w for w in q.strip().split() if w]
    if sum(len(w) for w in words) < 2:
        return []
    query = _guest_query(event.id)
    for word in words:
        escaped = word.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")
        query = query.where(Guest.display_name.ilike(f"%{escaped}%"))
    rows = await db.execute(query.order_by(Guest.display_name).limit(20))
    return [_scan_guest(g, c, i, ch) for g, c, i, ch, _ in rows]
