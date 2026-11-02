"""Éditeur de cartes (Creative Engine) : document de l'éditeur et ses images.

L'éditeur enregistre son document ici pour qu'on reprenne l'édition, sur tout appareil. La carte envoyée aux
invités ne le lit pas : à la validation, l'éditeur envoie le décor (fond de « Mon propre modèle ») et la
mise en page du nom, de la table et du QR code (routes de la carte, routers/invitations.py).
"""

import hashlib
import io
import json
import re
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, Response, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError

from app.auth import CurrentAuth, DbSession
from app.models import CardDesign, CardDesignAsset
from app.routers.events import owned_event
from app.routers.invitations import LOCKED, _default_card, _event_card, card_locked
from app.schemas import CardDesignIn, CardDesignOut, CardDesignSaved

router = APIRouter(tags=["éditeur de cartes"])

# Mêmes limites que le moteur (creative-engine/persistence/limits.ts).
MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
MAX_IMAGE_BYTES = 10 * 1024 * 1024
FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MAX_SVG_BYTES = 2 * 1024 * 1024
SVG_START = re.compile(
    rb"^\s*(<\?xml[^>]*\?>\s*)?(<!--.*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]",
    re.DOTALL,
)
# Le navigateur nettoie le SVG (DOMPurify) ; l'API refuse en plus ce qui ne devrait plus y être.
SVG_FORBIDDEN = re.compile(
    rb"<script|<foreignObject|<iframe|<object|<embed|javascript:|\bon[a-z]+\s*=|(xlink:)?href\s*=\s*[\"'](?!#)",
    re.IGNORECASE,
)


def _svg_type(content: bytes) -> str | None:
    """« image/svg+xml » pour un SVG sans contenu actif ; None si ce n'en est pas un, ou s'il est refusé."""
    if not SVG_START.match(content[:4096]):
        return None
    if len(content) > MAX_SVG_BYTES or SVG_FORBIDDEN.search(content):
        raise _invalid(
            "Ce SVG contient des scripts ou des liens externes : il n'est pas accepté."
        )
    return "image/svg+xml"


KEY_PREFIX = "sha256-"

NO_DESIGN = HTTPException(
    status.HTTP_404_NOT_FOUND, detail={"message": "Aucune carte créée avec l'éditeur."}
)


def _conflict() -> HTTPException:
    return HTTPException(
        status.HTTP_409_CONFLICT,
        detail={
            "code": "conflict",
            "message": "La carte a été modifiée ailleurs (autre onglet ou autre appareil).",
        },
    )


def _invalid(message: str) -> HTTPException:
    return HTTPException(
        status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"message": message}
    )


@router.get("/events/{event_id}/card/design")
async def get_design(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> CardDesignOut:
    event = await owned_event(db, event_id, auth.user.id)
    card = await _default_card(db, event)
    design = await db.get(CardDesign, card.id) if card else None
    if design is None:
        raise NO_DESIGN
    return CardDesignOut(
        document=design.document, revision=design.revision, saved_at=design.saved_at
    )


@router.put("/events/{event_id}/card/design")
async def save_design(
    event_id: uuid.UUID, body: CardDesignIn, auth: CurrentAuth, db: DbSession
) -> CardDesignSaved:
    """Enregistre le document si personne ne l'a changé depuis `expected_revision`. Refusé une fois les
    invitations parties : la carte est figée."""
    event = await owned_event(db, event_id, auth.user.id)
    if await card_locked(db, event.id):
        raise LOCKED
    if len(json.dumps(body.document, separators=(",", ":"))) > MAX_DOCUMENT_BYTES:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            detail={"message": "Cette carte est trop lourde pour être enregistrée."},
        )
    try:
        document_id = uuid.UUID(str(body.document.get("id")))
    except ValueError:
        raise _invalid("Ce document n'est pas une carte de l'éditeur.") from None
    if not isinstance(body.document.get("schemaVersion"), int):
        raise _invalid("Ce document n'est pas une carte de l'éditeur.")

    card = await _event_card(db, event)
    design = await db.get(CardDesign, card.id, with_for_update=True)
    now = datetime.now(UTC)
    if design is None:
        if body.expected_revision != 0:
            raise _conflict()
        design = CardDesign(
            event_card_id=card.id,
            document_id=document_id,
            document=body.document,
            revision=1,
            saved_at=now,
        )
        db.add(design)
    else:
        # Une seule carte par événement : un autre document ne la remplace que sur demande.
        if design.revision != body.expected_revision or (
            design.document_id != document_id and not body.replace
        ):
            raise _conflict()
        design.document_id = document_id
        design.document = body.document
        design.revision += 1
        design.saved_at = now
    try:
        await db.commit()
    except IntegrityError:
        # Deux premiers enregistrements simultanés (deux onglets) : le second perd, comme une révision dépassée.
        await db.rollback()
        raise _conflict() from None
    return CardDesignSaved(revision=design.revision, saved_at=design.saved_at)


@router.get("/events/{event_id}/card/design/assets")
async def design_assets(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> list[str]:
    """Empreintes des images déjà enregistrées : l'éditeur n'envoie que les nouvelles."""
    event = await owned_event(db, event_id, auth.user.id)
    card = await _default_card(db, event)
    if card is None:
        return []
    return list(
        await db.scalars(
            select(CardDesignAsset.key).where(CardDesignAsset.event_card_id == card.id)
        )
    )


@router.put(
    "/events/{event_id}/card/design/assets/{key}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def put_design_asset(
    event_id: uuid.UUID, key: str, request: Request, auth: CurrentAuth, db: DbSession
) -> None:
    """Image du document (corps de la requête). La clé doit être l'empreinte SHA-256 du contenu."""
    event = await owned_event(db, event_id, auth.user.id)
    if await card_locked(db, event.id):
        raise LOCKED
    content = await request.body()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE,
            detail={"message": "Cette image dépasse 10 Mo."},
        )
    if key != KEY_PREFIX + hashlib.sha256(content).hexdigest():
        raise _invalid("L'image reçue ne correspond pas à sa clé.")
    content_type = _svg_type(content)
    if content_type is None:
        try:
            with Image.open(io.BytesIO(content)) as image:
                content_type = FORMATS.get(image.format or "")
        except (UnidentifiedImageError, OSError):
            content_type = None
    if content_type is None:
        raise _invalid("Utilisez une image JPEG, PNG, WebP ou SVG.")
    card = await _event_card(db, event)
    await db.execute(
        insert(CardDesignAsset)
        .values(
            event_card_id=card.id, key=key, content_type=content_type, content=content
        )
        .on_conflict_do_nothing()
    )
    await db.commit()


@router.get("/events/{event_id}/card/design/assets/{key}")
async def get_design_asset(
    event_id: uuid.UUID, key: str, auth: CurrentAuth, db: DbSession
) -> Response:
    event = await owned_event(db, event_id, auth.user.id)
    card = await _default_card(db, event)
    asset = await db.get(CardDesignAsset, (card.id, key)) if card else None
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Image introuvable.")
    # La clé est l'empreinte du contenu : il ne change jamais.
    return Response(
        asset.content,
        media_type=asset.content_type,
        headers={
            "Cache-Control": "private, max-age=31536000, immutable",
            # Un SVG ouvert seul dans un onglet ne peut rien exécuter ni charger.
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            "X-Content-Type-Options": "nosniff",
        },
    )
