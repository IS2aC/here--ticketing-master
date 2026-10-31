"""Éditeur des cartes d'invitation : Doory (dossier doory/, services here-doory-*), appelé sur le réseau interne.

L'organisateur dessine sa carte dans l'éditeur, comme sur Canva. Le nom de l'invité, sa table et le QR code y
sont des champs (« nom_invite », « table_invite », « qr_code ») qu'il place et habille ; Here! les remplit
pour chaque invité. À la validation, l'éditeur rend la carte sans ces champs : ce rendu devient le fond de la
carte (card_backgrounds) et la place des champs sa mise en page (`layout_from_fields`), dessinée ensuite par
le rendu habituel (lib/card/render.tsx) pour chaque invité.
"""

import base64
import uuid
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import get_settings

NAME, TABLE, QR = "nom_invite", "table_invite", "qr_code"
CARD_WIDTH, CARD_HEIGHT = 1080, 1350

# Polices à empattement : le nom de l'invité est alors dessiné en Playfair Display, sinon en Poppins.
SERIF_HINTS = (
    "serif",
    "playfair",
    "garamond",
    "georgia",
    "times",
    "lora",
    "merriweather",
    "cormorant",
    "bodoni",
    "didot",
    "fraunces",
    "libre baskerville",
    "baskerville",
    "dm serif",
    "prata",
    "cinzel",
    "abril",
    "great vibes",
    "parisienne",
    "allura",
    "dancing script",
    "pinyon",
    "tangerine",
    "alex brush",
)


class EditorError(Exception):
    """L'éditeur ne répond pas ou refuse : le message est affiché tel quel à l'organisateur."""


def enabled() -> bool:
    return bool(get_settings().doory_secret)


@dataclass(frozen=True)
class Render:
    image: bytes  # JPEG, 1080 de large
    width: int
    height: int
    fields: dict[str, dict[str, Any]]


async def _call(method: str, path: str, **kwargs: Any) -> Any:
    settings = get_settings()
    try:
        async with httpx.AsyncClient(
            base_url=f"{settings.doory_api_url.rstrip('/')}/api/v1/here",
            headers={"Authorization": f"Bearer {settings.doory_secret}"},
            timeout=settings.doory_timeout_seconds,
        ) as client:
            response = await client.request(method, path, **kwargs)
    except httpx.HTTPError as error:
        raise EditorError(
            "L'éditeur de cartes est momentanément indisponible. Réessayez dans un instant."
        ) from error
    if response.status_code == 404:
        raise EditorError(
            "Cette carte n'existe plus dans l'éditeur. Créez-en une nouvelle."
        )
    if response.status_code >= 400:
        raise EditorError(
            "L'éditeur de cartes est momentanément indisponible. Réessayez dans un instant."
        )
    return response.json()


async def templates(category: str | None) -> list[dict[str, Any]]:
    """Modèles de l'éditeur : ceux de la catégorie (le type d'événement), sinon tous."""
    found = await _call(
        "GET", "/templates/", params={"category": category} if category else None
    )
    if not found and category:
        found = await _call("GET", "/templates/")
    return found


async def create_design(
    organizer_id: uuid.UUID, organizer_name: str, title: str, template: str | None
) -> uuid.UUID:
    created = await _call(
        "POST",
        "/designs/",
        json={
            "organizer": {"id": str(organizer_id), "name": organizer_name},
            "title": title[:200],
            "template": template,
        },
    )
    return uuid.UUID(created["id"])


async def session_link(
    design_id: uuid.UUID, organizer_id: uuid.UUID, return_url: str
) -> str:
    """Lien qui ouvre la carte dans l'éditeur, connecté : à ouvrir tout de suite (valable 2 minutes)."""
    link = await _call(
        "POST",
        f"/designs/{design_id}/session/",
        json={"organizer_id": str(organizer_id), "return_url": return_url},
    )
    return link["url"]


async def render(design_id: uuid.UUID, organizer_id: uuid.UUID) -> Render:
    drawn = await _call(
        "POST",
        f"/designs/{design_id}/render/",
        json={"organizer_id": str(organizer_id)},
    )
    return Render(
        image=base64.b64decode(drawn["image"]),
        width=int(drawn["width"]),
        height=int(drawn["height"]),
        fields=drawn.get("fields") or {},
    )


def _clamp(value: float, low: int, high: int) -> int:
    return max(low, min(high, round(value)))


def _text(field: dict[str, Any] | None, fallback_y: int) -> dict[str, Any] | None:
    if field is None:
        return None
    left = _clamp(field.get("left", 0), 0, CARD_WIDTH - 1)
    top = _clamp(field.get("top", fallback_y), 0, CARD_HEIGHT - 1)
    width = _clamp(field.get("width", CARD_WIDTH), 1, CARD_WIDTH - left)
    height = _clamp(field.get("height", 80), 1, CARD_HEIGHT - top)
    family = str(field.get("font_family") or "").lower()
    color = str(field.get("color") or "#0B0B0B")
    return {
        "x": left + width // 2,
        "y": top + height // 2,
        "size": _clamp(field.get("font_size", 48), 18, 160),
        "color": color[:7] if len(color) >= 7 and color.startswith("#") else "#0B0B0B",
        "font": "serif" if any(hint in family for hint in SERIF_HINTS) else "sans",
        "bold": bool(field.get("bold")),
        "box": {"left": left, "top": top, "width": width, "height": height},
        "align": field.get("align")
        if field.get("align") in ("left", "center", "right")
        else "center",
    }


def layout_from_fields(fields: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Mise en page de la carte (schemas.CardLayout) d'après la place des champs dans l'éditeur. Un nom absent
    garde la place proposée par défaut ; sans QR code placé, le sceau va en bas à droite."""
    name = _text(fields.get(NAME), 700) or {
        "x": 540,
        "y": 700,
        "size": 64,
        "color": "#0B0B0B",
        "font": "serif",
        "bold": False,
    }
    qr: dict[str, int] | str = "bas-droite"
    if box := fields.get(QR):
        qr = {
            "x": _clamp(box.get("left", 0) + box.get("width", 0) / 2, 0, CARD_WIDTH),
            "y": _clamp(box.get("top", 0) + box.get("height", 0) / 2, 0, CARD_HEIGHT),
        }
    return {"name": name, "table": _text(fields.get(TABLE), 790), "qr": qr}
