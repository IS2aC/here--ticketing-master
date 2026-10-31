"""Here!: the invitation cards of Here! events are designed in this editor.

Here! keeps the event, the guests and the sending; Doory keeps one design per event card. Each organizer of
Here! is a Doory user (`organizer_user`), created on the first card. The guest's own details are template
fields the organizer places like any other object (`GUEST_FIELDS`); Here! draws them for every guest on the
picture `render_card` returns, which leaves them out.
"""

from __future__ import annotations

import base64
import copy
import uuid
from types import SimpleNamespace
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.designs import services as designs
from apps.designs.doc import builders, fields
from apps.designs.edits import current_document
from apps.designs.models import Design
from apps.exports.services import export_image

CARD_WIDTH, CARD_HEIGHT = 1080, 1350  # portrait 4:5, the best size in WhatsApp
NAME_FIELD = "nom_invite"
TABLE_FIELD = "table_invite"
QR_FIELD = "qr_code"
GUEST_FIELDS = (NAME_FIELD, TABLE_FIELD, QR_FIELD)
EMAIL_DOMAIN = "here.invalid"  # reserved: these accounts never receive mail and can't sign in with a password


def organizer_user(organizer_id: str, name: str = ""):
    """The Doory user of a Here! organizer, created the first time."""
    users = get_user_model()
    email = f"here-{organizer_id}@{EMAIL_DOMAIN}".lower()
    with transaction.atomic():
        user = users.objects.filter(email__iexact=email).first()
        if user is None:
            user = users.objects.create_user(email=email, password=None, is_email_verified=True)
        if name and user.display_name != name[:80]:
            user.display_name = name[:80]
            user.save(update_fields=["display_name"])
    return user


def guest_objects() -> list[dict]:
    """The guest's name, table and QR code, tagged: placeholders the organizer moves and styles."""
    page = builders.Page(CARD_WIDTH, CARD_HEIGHT)
    name = builders.build_text(
        page, text="Prénom Nom de l'invité", y=760, width=880, preset="heading", font_size=64, color="#1a1a2e"
    )
    name["field"] = {"key": NAME_FIELD, "type": "text", "label": "Nom de l'invité"}
    table = builders.build_text(page, text="Table 4 · VIP", y=870, width=700, font_size=40, color="#334155")
    table["field"] = {"key": TABLE_FIELD, "type": "text", "label": "Table et catégorie"}
    qr = builders.build_qr(page, text="https://here.invalid/i/exemple", x=780, y=1050, size=240)
    qr["field"] = {"key": QR_FIELD, "type": "image", "label": "QR code d'entrée"}
    return [name, table, qr]


def create_card_design(user, *, title: str, template: str | None = None) -> Design:
    """A new card: a copy of the template (slug), or a blank 1080 x 1350 page. The guest fields the template
    lacks are added to its first page."""
    if template:
        design = designs.create_from_template(user, template, title=title, folder=None)
        document = copy.deepcopy(design.document)
    else:
        design = None
        document = designs.blank_document(CARD_WIDTH, CARD_HEIGHT)
    present = {tag["key"] for _page, _obj, tag in fields.tagged(document)}
    missing = [obj for obj in guest_objects() if obj["field"]["key"] not in present]
    if design is None:
        document["pages"][0]["objects"].extend(missing)
        return designs.create_design(user, title=title, document=document)
    if missing:
        document["pages"][0]["objects"].extend(missing)
        design.document = document
        design.save(update_fields=["document"])
    return design


def _box(obj: dict) -> dict[str, Any]:
    """Where an object is on the page (its unrotated box, top-left corner) and, for text, how it is drawn."""
    slot = builders.slot_of({key: value for key, value in obj.items() if key != "slot"})
    box: dict[str, Any] = {
        "left": round(slot["cx"] - slot["width"] / 2),
        "top": round(slot["cy"] - slot["height"] / 2),
        "width": round(slot["width"]),
        "height": round(slot["height"]),
        "angle": slot["angle"],
    }
    if obj.get("type") in ("textbox", "text", "i-text"):
        scale = abs(float(obj.get("scaleY", 1) or 1))
        box.update(
            font_size=round(float(obj.get("fitFontSize") or obj.get("fontSize") or 40) * scale),
            color=obj.get("fill") if isinstance(obj.get("fill"), str) else "#000000",
            font_family=builders.primary_family(str(obj.get("fontFamily") or "")),
            bold=int(obj.get("fontWeight") or 400) >= 600,
            italic=obj.get("fontStyle") == "italic",
            align=obj.get("textAlign") if obj.get("textAlign") in ("left", "center", "right") else "center",
        )
    return box


def _without_guest_fields(objects: list) -> list:
    kept = []
    for obj in objects:
        if not isinstance(obj, dict):
            continue
        tag = fields.read_field(obj.get("field"))
        if tag and tag["key"] in GUEST_FIELDS:
            continue
        if isinstance(obj.get("objects"), list):
            obj = {**obj, "objects": _without_guest_fields(obj["objects"])}
        kept.append(obj)
    return kept


def render_card(design: Design) -> dict[str, Any]:
    """The card's first page as a 1080 px wide JPEG without the guest fields, and where those fields are."""
    document = copy.deepcopy(current_document(design))
    page = document["pages"][0]
    boxes = {tag["key"]: _box(obj) for number, obj, tag in fields.tagged(document) if number == 1}
    page["objects"] = _without_guest_fields(page.get("objects") or [])
    document["pages"] = [page]
    # A stand-in for the design: the export reads its document, and with a new id never a live room's state.
    stand_in = SimpleNamespace(
        pk=uuid.uuid4(),
        document=document,
        owner=design.owner,
        owner_id=design.owner_id,
        preset=design.preset,
        title=design.title,
    )
    result = export_image(stand_in, format="jpg", quality=88, size=f"{CARD_WIDTH}w")
    scale = CARD_WIDTH / float(document.get("width") or CARD_WIDTH)
    return {
        "image": base64.b64encode(result.data).decode("ascii"),
        "width": CARD_WIDTH,
        "height": round(float(document.get("height") or CARD_HEIGHT) * scale),
        "fields": {key: _scaled(box, scale) for key, box in boxes.items() if key in GUEST_FIELDS},
        "warnings": list(result.warnings),
    }


def _scaled(box: dict[str, Any], scale: float) -> dict[str, Any]:
    if scale == 1:
        return box
    out = dict(box)
    for key in ("left", "top", "width", "height", "font_size"):
        if key in out:
            out[key] = round(out[key] * scale)
    return out
