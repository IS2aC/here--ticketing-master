import base64
import hashlib
import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Response, UploadFile, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app import card_editor
from app.auth import CurrentAuth, DbSession
from app.card_image import BackgroundError, prepare_background
from app.config import get_settings
from app.messaging import cancel_reminders
from app.models import (
    CardBackground,
    CardTemplate,
    Event,
    EventCard,
    EventStatus,
    EventType,
    Guest,
    GuestCategory,
    Invitation,
    Message,
    MessageKind,
    MessageStatus,
    RsvpStatus,
)
from app.routers.events import owned_event
from app.schemas import (
    CardLayout,
    CardSettings,
    CardSettingsIn,
    EditorLink,
    EditorOpenIn,
    EditorTemplate,
    InvitationResponse,
    InvitationsResult,
    PublicCard,
)

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


async def card_locked(db: AsyncSession, event_id: uuid.UUID) -> bool:
    """La carte ne change plus dès que des invitations sont parties ou en file (décision du 30/10)."""
    return bool(
        await db.scalar(
            select(Message.id)
            .join(Guest, Guest.id == Message.guest_id)
            .where(
                Guest.event_id == event_id,
                Message.kind == MessageKind.invitation,
                Message.status.in_(
                    (
                        MessageStatus.scheduled,
                        MessageStatus.sending,
                        MessageStatus.sent,
                        MessageStatus.delivered,
                        MessageStatus.read,
                    )
                ),
            )
            .limit(1)
        )
    )


async def _event_card(db: AsyncSession, event: Event) -> EventCard:
    """Carte de l'événement (une seule, choisie d'après le type ; mise à jour si le type a changé,
    sauf une fois les invitations parties : la carte est alors figée)."""
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
    elif not await card_locked(db, event.id):
        card.template_id = template_id
    return card


# Mise en page proposée au premier import : nom au centre, table dessous, QR code en bas à droite.
DEFAULT_LAYOUT = {
    "name": {
        "x": 540,
        "y": 700,
        "size": 64,
        "color": "#0B0B0B",
        "font": "serif",
        "bold": False,
    },
    "table": {
        "x": 540,
        "y": 790,
        "size": 34,
        "color": "#0B0B0B",
        "font": "sans",
        "bold": False,
    },
    "qr": "bas-droite",
}

LOCKED = HTTPException(
    status.HTTP_409_CONFLICT,
    detail={
        "message": "Les invitations sont parties : la carte ne peut plus être modifiée."
    },
)


def _settings(
    card: EventCard | None, locked: bool, cropped: bool = False
) -> CardSettings:
    return CardSettings(
        title=card.title if card else None,
        palette=(card.palette or {}).get("preset") if card else None,
        locked=locked,
        custom=bool(card and card.layout),
        layout=CardLayout.model_validate(card.layout) if card and card.layout else None,
        cropped=cropped,
        editor=bool(card and card.editor_design_id),
        editor_enabled=card_editor.enabled(),
    )


async def _default_card(db: AsyncSession, event: Event) -> EventCard | None:
    return await db.scalar(
        select(EventCard).where(
            EventCard.event_id == event.id, EventCard.category_id.is_(None)
        )
    )


@router.get("/events/{event_id}/card")
async def card_settings(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> CardSettings:
    """Intitulé et palette de la carte de l'événement."""
    event = await owned_event(db, event_id, auth.user.id)
    return _settings(await _default_card(db, event), await card_locked(db, event.id))


@router.patch("/events/{event_id}/card")
async def update_card(
    event_id: uuid.UUID, body: CardSettingsIn, auth: CurrentAuth, db: DbSession
) -> CardSettings:
    """Personnalise la carte (intitulé, palette). Refusé une fois les invitations parties."""
    event = await owned_event(db, event_id, auth.user.id)
    if await card_locked(db, event.id):
        raise LOCKED
    card = await _event_card(db, event)
    if "layout" in body.model_fields_set and body.layout is not None:
        if card.layout is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail={"message": "Importez d'abord le fond de votre carte."},
            )
        card.layout = body.layout.model_dump()
    if "title" in body.model_fields_set:
        card.title = body.title
    if "palette" in body.model_fields_set:
        card.palette = {"preset": body.palette} if body.palette else {}
    # La couverture du tableau de bord suit la carte.
    event.updated_at = datetime.now(UTC)
    await db.commit()
    return _settings(card, False)


@router.put("/events/{event_id}/card/background")
async def upload_background(
    event_id: uuid.UUID, file: UploadFile, auth: CurrentAuth, db: DbSession
) -> CardSettings:
    """« Mon propre modèle » : fond importé (JPEG, PNG ou WebP), recadré en 1080 × 1350.
    Au premier import, une mise en page est proposée ; la carte de l'événement passe sur ce fond."""
    event = await owned_event(db, event_id, auth.user.id)
    if await card_locked(db, event.id):
        raise LOCKED
    try:
        content, cropped = prepare_background(await file.read(8 * 1024 * 1024 + 1))
    except BackgroundError as error:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"message": str(error)}
        ) from None
    card = await _event_card(db, event)
    await _store_background(db, card, content)
    # Un fond importé remplace la carte dessinée dans l'éditeur (et sa mise en page).
    card.layout = None if card.editor_design_id else card.layout
    card.editor_design_id = None
    card.layout = card.layout or DEFAULT_LAYOUT
    event.updated_at = datetime.now(UTC)
    await db.commit()
    return _settings(card, False, cropped)


async def _store_background(db: AsyncSession, card: EventCard, content: bytes) -> None:
    background = await db.get(CardBackground, card.id)
    if background is None:
        db.add(CardBackground(event_card_id=card.id, content=content))
    else:
        background.content = content


def _editor_error(error: card_editor.EditorError) -> HTTPException:
    return HTTPException(status.HTTP_502_BAD_GATEWAY, detail={"message": str(error)})


EDITOR_OFF = HTTPException(
    status.HTTP_404_NOT_FOUND,
    detail={"message": "L'éditeur de cartes n'est pas disponible."},
)


@router.get("/events/{event_id}/card/editor/templates")
async def editor_templates(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> list[EditorTemplate]:
    """Modèles de l'éditeur proposés pour le type de l'événement (sinon tous)."""
    event = await owned_event(db, event_id, auth.user.id)
    if not card_editor.enabled():
        raise EDITOR_OFF
    try:
        found = await card_editor.templates(event.type.value)
    except card_editor.EditorError as error:
        raise _editor_error(error) from None
    return [EditorTemplate.model_validate(t) for t in found]


@router.post("/events/{event_id}/card/editor")
async def open_editor(
    event_id: uuid.UUID, body: EditorOpenIn, auth: CurrentAuth, db: DbSession
) -> EditorLink:
    """Ouvre la carte dans l'éditeur (lien à suivre tout de suite). Sans carte en cours, ou avec `new`, une
    nouvelle carte est créée : d'après le modèle choisi, ou vierge."""
    event = await owned_event(db, event_id, auth.user.id)
    if not card_editor.enabled():
        raise EDITOR_OFF
    if await card_locked(db, event.id):
        raise LOCKED
    card = await _event_card(db, event)
    user = auth.user
    try:
        if card.editor_design_id is None or body.new:
            card.editor_design_id = await card_editor.create_design(
                user.id,
                f"{user.first_name} {user.last_name}".strip(),
                event.title,
                body.template,
            )
            await db.commit()
        back = f"{get_settings().public_app_url.rstrip('/')}/tableau-de-bord/evenements/{event.id}/carte?editeur=1"
        url = await card_editor.session_link(card.editor_design_id, user.id, back)
    except card_editor.EditorError as error:
        raise _editor_error(error) from None
    return EditorLink(url=url)


@router.post("/events/{event_id}/card/editor/validate")
async def validate_editor_card(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> CardSettings:
    """Valide la carte dessinée dans l'éditeur : son rendu (sans le nom, la table ni le QR code) devient le
    fond de la carte, et la place de ces champs sa mise en page. Chaque invité a ensuite sa carte."""
    event = await owned_event(db, event_id, auth.user.id)
    if not card_editor.enabled():
        raise EDITOR_OFF
    if await card_locked(db, event.id):
        raise LOCKED
    card = await _default_card(db, event)
    if card is None or card.editor_design_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"message": "Créez d'abord votre carte dans l'éditeur."},
        )
    try:
        drawn = await card_editor.render(card.editor_design_id, auth.user.id)
        content, cropped = prepare_background(drawn.image)
    except card_editor.EditorError as error:
        raise _editor_error(error) from None
    except BackgroundError as error:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"message": str(error)}
        ) from None
    await _store_background(db, card, content)
    card.layout = card_editor.layout_from_fields(drawn.fields)
    event.updated_at = datetime.now(UTC)
    await db.commit()
    return _settings(card, False, cropped)


@router.delete("/events/{event_id}/card/background")
async def remove_background(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> CardSettings:
    """Retour à la carte automatique (le fond importé est supprimé)."""
    event = await owned_event(db, event_id, auth.user.id)
    if await card_locked(db, event.id):
        raise LOCKED
    card = await _default_card(db, event)
    if card is not None:
        background = await db.get(CardBackground, card.id)
        if background is not None:
            await db.delete(background)
        card.layout = None
        card.editor_design_id = None
        event.updated_at = datetime.now(UTC)
        await db.commit()
    return _settings(card, False)


def _jpeg(content: bytes, cache: str) -> Response:
    return Response(content, media_type="image/jpeg", headers={"Cache-Control": cache})


@router.get("/events/{event_id}/card/background")
async def background(event_id: uuid.UUID, auth: CurrentAuth, db: DbSession) -> Response:
    event = await owned_event(db, event_id, auth.user.id)
    card = await _default_card(db, event)
    found = await db.get(CardBackground, card.id) if card else None
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Pas de fond importé.")
    return _jpeg(found.content, "private, no-store")


@router.get("/invitations/{token}/background")
async def public_background(token: str, db: DbSession) -> Response:
    """Public (jeton de l'invitation) : fond de la carte, pour dessiner la carte de l'invité."""
    card_id = await db.scalar(
        select(Invitation.event_card_id).where(Invitation.token == token)
    )
    found = await db.get(CardBackground, card_id) if card_id else None
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Pas de fond importé.")
    return _jpeg(found.content, "public, max-age=300")


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


def responses_until(event: Event) -> datetime:
    """Date limite de réponse : celle de l'organisateur, sinon le début de l'événement."""
    return event.rsvp_deadline or event.starts_at


def _responses_open(event: Event) -> bool:
    return event.status != EventStatus.cancelled and responses_until(
        event
    ) > datetime.now(UTC)


async def _by_token(
    db: AsyncSession, token: str, *, lock: bool = False
) -> tuple[Event, Guest, str, EventCard]:
    query = (
        select(Event, Guest, GuestCategory.name, EventCard)
        .join(Guest, Guest.event_id == Event.id)
        .join(GuestCategory, GuestCategory.id == Guest.category_id)
        .join(Invitation, Invitation.guest_id == Guest.id)
        .join(EventCard, EventCard.id == Invitation.event_card_id)
        .where(Invitation.token == token)
    )
    row = (
        await db.execute(query.with_for_update(of=Guest) if lock else query)
    ).one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invitation introuvable.")
    return row[0], row[1], row[2], row[3]


def _public_card(
    token: str, event: Event, guest: Guest, category: str, card: EventCard
) -> PublicCard:
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
        responses_until=responses_until(event),
        card_title=card.title,
        card_palette=(card.palette or {}).get("preset"),
        card_layout=CardLayout.model_validate(card.layout) if card.layout else None,
        rsvp_deadline=event.rsvp_deadline,
    )


@router.get("/invitations/{token}")
async def public_card(token: str, db: DbSession, vue: bool = False) -> PublicCard:
    """Public : le jeton (long et aléatoire) est la seule clé. Ne renvoie que ce qui concerne cet invité.

    `vue` : page ouverte par l'invité dans un navigateur (pas un aperçu de lien) : on note la première ouverture."""
    card = _public_card(token, *await _by_token(db, token))
    if vue:
        await db.execute(
            update(Invitation)
            .where(Invitation.token == token, Invitation.opened_at.is_(None))
            .values(opened_at=datetime.now(UTC))
        )
        await db.commit()
    return card


@router.post("/invitations/{token}/response")
async def respond(token: str, body: InvitationResponse, db: DbSession) -> PublicCard:
    """Réponse de l'invité depuis sa page. Il peut changer d'avis jusqu'à la date limite (ou au début)."""
    event, guest, category, card = await _by_token(db, token, lock=True)
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
    await cancel_reminders(db, guest.id)  # ses relances en attente ne partiront pas
    await db.commit()
    return _public_card(token, event, guest, category, card)
