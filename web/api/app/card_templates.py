"""Modèles de cartes par type d'événement : définition JSON d'un modèle et pré-remplissage depuis l'événement.

Une définition décrit les formats proposés, le thème (palettes, paires de polices), les champs que l'organisateur
remplit, leur correspondance avec l'événement, et les calques posés sur la carte. Elle est validée ici à l'enregistrement
(portail admin) ; le rendu est fait par le moteur du frontend (web/frontend/src/lib/card/templates).

Positions en pourcentage de la carte (zone de coupe pour l'A5) ; tailles de texte en pixels d'une carte de 1080 de large.
Les textes citent les champs entre accolades : « {maries} », « Le {date} à {heure} » ; « {invite.nom} » et
« {invite.table} » sont propres à chaque invité. Un texte dont un champ cité est vide n'est pas affiché.
"""

import re
from datetime import datetime
from typing import Annotated, Literal, Self
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models import CardFormat

EVENT_TZ = ZoneInfo("Africa/Abidjan")

Slug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9][a-z0-9-]{0,39}$")]
FieldKey = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]{0,29}$")]
Label = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)
]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]
# Couleur du thème (suit la palette choisie) ou couleur fixe.
ColorRef = Literal["primary", "secondary", "accent", "background", "text"] | HexColor
FontFamily = Literal["Playfair Display", "Poppins", "Inter"]
Percent = Annotated[float, Field(ge=0, le=100)]

GUEST_PLACEHOLDERS = {"invite.nom", "invite.table"}
PLACEHOLDER = re.compile(r"\{([a-z][a-z0-9_.]*)\}")

# Zone de sécurité de l'A5 : 5 mm à l'intérieur de la coupe (148 × 210 mm).
PRINT_SAFE_X = 5 / 148 * 100
PRINT_SAFE_Y = 5 / 210 * 100

# Données de l'événement que l'on peut reprendre dans un champ, avec le type de champ attendu.
EventSource = Literal[
    "title",
    "date",
    "time",
    "location_name",
    "location_address",
    "dress_code",
    "description",
    "rsvp_deadline",
]
SOURCE_TYPES: dict[str, set[str]] = {
    "date": {"date"},
    "rsvp_deadline": {"date"},
    "time": {"time"},
}


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Box(Strict):
    x: Percent
    y: Percent
    w: Annotated[float, Field(gt=0, le=100)]
    h: Annotated[float, Field(gt=0, le=100)]

    @model_validator(mode="after")
    def inside(self) -> Self:
        if self.x + self.w > 100.001 or self.y + self.h > 100.001:
            raise ValueError("Le calque dépasse de la carte.")
        return self

    def in_print_safe_area(self) -> bool:
        return (
            self.x >= PRINT_SAFE_X - 0.001
            and self.y >= PRINT_SAFE_Y - 0.001
            and self.x + self.w <= 100 - PRINT_SAFE_X + 0.001
            and self.y + self.h <= 100 - PRINT_SAFE_Y + 0.001
        )


class FormatOverride(Strict):
    """Réglage d'un calque pour un format : autre position, ou masqué."""

    box: Box | None = None
    hidden: bool = False


class LayerBase(Strict):
    id: Slug
    box: Box
    locked: bool = True  # non modifiable par l'organisateur
    movable: bool = False  # l'organisateur peut le déplacer
    hidden: bool = False
    formats: dict[CardFormat, FormatOverride] = {}

    def boxes(self) -> list[Box]:
        return [self.box, *(o.box for o in self.formats.values() if o.box)]


class ImageLayer(LayerBase):
    type: Literal["image"]
    asset: Slug  # clé de l'image dans card_assets
    fit: Literal["cover", "contain"] = "cover"
    ornament: bool = False  # l'organisateur peut l'afficher ou le masquer
    tint: ColorRef | None = None  # SVG : currentColor prend cette couleur
    opacity: Annotated[float, Field(ge=0, le=1)] = 1


class TextSize(Strict):
    min: Annotated[int, Field(ge=8, le=240)]
    max: Annotated[int, Field(ge=8, le=240)]

    @model_validator(mode="after")
    def ordered(self) -> Self:
        if self.min > self.max:
            raise ValueError("La taille minimale dépasse la taille maximale.")
        return self


class TextLayer(LayerBase):
    type: Literal["text"]
    text: Annotated[str, StringConstraints(min_length=1, max_length=300)]
    font: Literal["heading", "body"] = "body"
    weight: Literal[400, 500, 600, 700, 800] = 400
    italic: bool = False
    uppercase: bool = False
    letter_spacing: Annotated[float, Field(ge=-0.05, le=0.5)] = 0  # en em
    align: Literal["left", "center", "right"] = "center"
    valign: Literal["top", "middle", "bottom"] = "middle"
    size: TextSize
    max_lines: Annotated[int, Field(ge=1, le=8)] = 2
    line_height: Annotated[float, Field(ge=0.9, le=2)] = 1.2
    color: ColorRef = "text"
    backdrop: ColorRef = (
        "background"  # couleur derrière le texte, pour vérifier le contraste
    )

    def placeholders(self) -> set[str]:
        return set(PLACEHOLDER.findall(self.text))


class ShapeLayer(LayerBase):
    type: Literal["shape"]
    shape: Literal["rect", "ellipse", "line"]
    fill: ColorRef | None = None
    stroke: ColorRef | None = None
    stroke_width: Annotated[float, Field(ge=0, le=40)] = 0
    radius: Annotated[float, Field(ge=0, le=540)] = 0
    opacity: Annotated[float, Field(ge=0, le=1)] = 1


class PhotoLayer(LayerBase):
    """Zone où l'organisateur ajoute sa photo ; masquée tant qu'il n'en a pas mis."""

    type: Literal["photo"]
    mask: Literal["circle", "arch", "rect"] = "rect"
    border: ColorRef | None = None
    border_width: Annotated[float, Field(ge=0, le=40)] = 0


class QrLayer(LayerBase):
    """Sceau Here! compact (QR code de l'invité sur blanc) ; seulement sur la carte envoyée à un invité."""

    type: Literal["qr"]


Layer = Annotated[
    ImageLayer | TextLayer | ShapeLayer | PhotoLayer | QrLayer,
    Field(discriminator="type"),
]


class Colors(Strict):
    primary: HexColor
    secondary: HexColor
    accent: HexColor
    background: HexColor
    text: HexColor


class Palette(Strict):
    id: Slug
    label: Label
    colors: Colors


class FontPair(Strict):
    id: Slug
    label: Label
    heading: FontFamily
    body: FontFamily


class Theme(Strict):
    palettes: Annotated[list[Palette], Field(min_length=3, max_length=5)]
    fonts: Annotated[list[FontPair], Field(min_length=1, max_length=4)]


class TemplateField(Strict):
    key: FieldKey
    label: Label
    type: Literal["text", "multiline", "date", "time"] = "text"
    required: bool = False
    max_length: Annotated[int, Field(ge=1, le=300)] = 60
    default: Annotated[str, StringConstraints(max_length=300)] | None = None
    example: Annotated[str, StringConstraints(max_length=300)] | None = (
        None  # pour l'aperçu de la galerie, jamais sur la carte de l'organisateur
    )

    @model_validator(mode="after")
    def default_fits(self) -> Self:
        if self.default and len(self.default) > self.max_length:
            raise ValueError(
                f"« {self.label} » : la valeur par défaut dépasse {self.max_length} caractères."
            )
        return self


class CardDefinition(Strict):
    version: Literal[1] = 1
    formats: Annotated[list[CardFormat], Field(min_length=1)]
    theme: Theme
    fields: Annotated[list[TemplateField], Field(min_length=1, max_length=20)]
    field_mapping: dict[FieldKey, EventSource] = {}
    layers: Annotated[list[Layer], Field(min_length=1, max_length=40)]

    @model_validator(mode="after")
    def consistent(self) -> Self:
        errors: list[str] = []

        def unique(values: list[str], what: str) -> None:
            seen = {v for v in values if values.count(v) > 1}
            if seen:
                errors.append(f"{what} en double : {', '.join(sorted(seen))}.")

        unique([str(f) for f in self.formats], "Format")
        unique([p.id for p in self.theme.palettes], "Palette")
        unique([f.id for f in self.theme.fonts], "Paire de polices")
        unique([f.key for f in self.fields], "Champ")
        unique([layer.id for layer in self.layers], "Calque")

        if CardFormat.whatsapp_4_5 not in self.formats:
            errors.append(
                "Le format WhatsApp 4:5 est obligatoire : c'est la carte envoyée aux invités."
            )

        fields = {f.key: f for f in self.fields}
        for key, source in self.field_mapping.items():
            field = fields.get(key)
            if field is None:
                errors.append(f"Correspondance : le champ « {key} » n'existe pas.")
            elif field.type not in SOURCE_TYPES.get(source, {"text", "multiline"}):
                errors.append(
                    f"Correspondance : « {key} » ({field.type}) ne peut pas recevoir « {source} »."
                )

        known = set(fields) | GUEST_PLACEHOLDERS
        texts = [layer for layer in self.layers if isinstance(layer, TextLayer)]
        for layer in texts:
            unknown = layer.placeholders() - known
            if unknown:
                errors.append(
                    f"Calque « {layer.id} » : champ inconnu {', '.join(sorted(unknown))}."
                )
        if not any("invite.nom" in layer.placeholders() for layer in texts):
            errors.append("Il faut un texte avec le nom de l'invité ({invite.nom}).")
        if sum(isinstance(layer, QrLayer) for layer in self.layers) != 1:
            errors.append("Il faut exactement un calque QR code.")

        for layer in self.layers:
            for fmt in layer.formats:
                if fmt not in self.formats:
                    errors.append(
                        f"Calque « {layer.id} » : réglage pour un format non proposé ({fmt})."
                    )

        # À l'impression, textes, photo et QR code restent à 5 mm de la coupe.
        if CardFormat.print_a5 in self.formats:
            for layer in self.layers:
                if isinstance(layer, ImageLayer | ShapeLayer):
                    continue
                print_box = layer.formats.get(CardFormat.print_a5)
                box = print_box.box if print_box and print_box.box else layer.box
                hidden = bool(print_box and print_box.hidden) or layer.hidden
                if not hidden and not box.in_print_safe_area():
                    errors.append(
                        f"Calque « {layer.id} » : hors de la zone de sécurité de l'impression (5 mm)."
                    )

        if errors:
            raise ValueError(" ".join(errors))
        return self


# --- Pré-remplissage -------------------------------------------------------------------------------


def event_values(event: object) -> dict[str, str]:
    """Données de l'événement reprises dans les cartes (dates à l'heure d'Abidjan, au format ISO).

    `event` : un Event, ou tout objet qui en a les attributs.
    """

    def local(value: datetime | None) -> datetime | None:
        return value.astimezone(EVENT_TZ) if value else None

    starts = local(getattr(event, "starts_at", None))
    deadline = local(getattr(event, "rsvp_deadline", None))
    values = {
        "title": getattr(event, "title", None),
        "date": starts.date().isoformat() if starts else None,
        "time": starts.strftime("%H:%M") if starts else None,
        "location_name": getattr(event, "location_name", None),
        "location_address": getattr(event, "location_address", None),
        "dress_code": getattr(event, "dress_code", None),
        "description": getattr(event, "description", None),
        "rsvp_deadline": deadline.date().isoformat() if deadline else None,
    }
    return {k: v.strip() for k, v in values.items() if isinstance(v, str) and v.strip()}


def resolve_values(
    definition: CardDefinition, stored: dict[str, str], event: object
) -> dict[str, str]:
    """Valeur de chaque champ : celle saisie par l'organisateur, sinon l'événement, sinon la valeur par défaut.

    Seules les saisies de l'organisateur sont enregistrées : un champ repris de l'événement suit ses changements
    (nouvelle date, autre lieu) tant que l'organisateur ne l'a pas réécrit.
    """
    facts = event_values(event)
    resolved: dict[str, str] = {}
    for field in definition.fields:
        own = (stored.get(field.key) or "").strip()
        source = definition.field_mapping.get(field.key)
        resolved[field.key] = (
            own or (facts.get(source, "") if source else "") or (field.default or "")
        )
    return resolved


def problems(definition: CardDefinition, values: dict[str, str]) -> list[str]:
    """Ce qui empêche de finaliser la carte : champs obligatoires vides, textes trop longs."""
    found = []
    for field in definition.fields:
        value = values.get(field.key, "")
        if field.required and not value:
            found.append(f"« {field.label} » est obligatoire.")
        elif len(value) > field.max_length:
            found.append(f"« {field.label} » : {field.max_length} caractères au plus.")
    return found
