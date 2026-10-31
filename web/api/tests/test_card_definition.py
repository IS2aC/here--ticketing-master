"""Définition d'un modèle de carte : validation du JSON et pré-remplissage depuis l'événement."""

import copy
import json
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.card_templates import CardDefinition, problems, resolve_values
from app.catalog import CATALOG_DIR

SAMPLE = CATALOG_DIR / "dot-wax" / "definition.json"


@pytest.fixture
def raw() -> dict:
    return json.loads(SAMPLE.read_text())


def layer(raw: dict, layer_id: str) -> dict:
    return next(item for item in raw["layers"] if item["id"] == layer_id)


def error_of(raw: dict) -> str:
    with pytest.raises(ValidationError) as caught:
        CardDefinition.model_validate(raw)
    return str(caught.value)


def test_sample_template_is_valid(raw: dict) -> None:
    definition = CardDefinition.model_validate(raw)
    assert [p.id for p in definition.theme.palettes][:2] == ["terre-or", "indigo"]
    assert definition.field_mapping == {
        "date": "date",
        "heure": "time",
        "lieu": "location_name",
    }
    assert {item.type for item in definition.layers} == {
        "image",
        "shape",
        "text",
        "photo",
        "qr",
    }


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda d: d.update(formats=["story_9_16"]), "WhatsApp 4:5 est obligatoire"),
        (lambda d: d["layers"].remove(layer(d, "qr")), "exactement un calque QR code"),
        (
            lambda d: d["layers"].append({**layer(d, "qr"), "id": "qr-2"}),
            "exactement un calque QR code",
        ),
        (lambda d: d["layers"].remove(layer(d, "invite")), "{invite.nom}"),
        (lambda d: layer(d, "lieu").update(text="{adresse}"), "champ inconnu adresse"),
        (
            lambda d: d["field_mapping"].update(inconnu="title"),
            "le champ « inconnu » n'existe pas",
        ),
        (
            lambda d: d["field_mapping"].update(fiances="date"),
            "« fiances » (text) ne peut pas recevoir « date »",
        ),
        (lambda d: d["theme"].update(palettes=d["theme"]["palettes"][:2]), "palettes"),
        (
            lambda d: d["layers"].append(copy.deepcopy(layer(d, "cadre"))),
            "Calque en double",
        ),
        (
            lambda d: layer(d, "date")["box"].update(x=1),
            "« date » : hors de la zone de sécurité",
        ),
        (lambda d: layer(d, "photo")["box"].update(x=80), "dépasse de la carte"),
        (
            lambda d: layer(d, "qr")["box"].update(x=77),
            "« qr » : hors de la zone de sécurité",
        ),
        (
            lambda d: layer(d, "fiances").update(size={"min": 90, "max": 60}),
            "taille minimale",
        ),
        (lambda d: layer(d, "fond").update(couleur="rouge"), "Extra inputs"),
        (lambda d: layer(d, "fond").update(tint="rouge"), "tint"),
        (
            lambda d: d["fields"][0].update(default="x" * 61),
            "la valeur par défaut dépasse 60",
        ),
        (
            lambda d: (
                layer(d, "photo")["formats"].update(story_9_16={"hidden": True})
                or d.update(formats=["whatsapp_4_5", "square_1_1"])
            ),
            "format non proposé (story_9_16)",
        ),
    ],
)
def test_invalid_templates_are_refused(raw: dict, change, message: str) -> None:
    change(raw)
    assert message in error_of(raw)


def test_print_safe_area_only_for_print(raw: dict) -> None:
    layer(raw, "date")["box"].update(x=1)
    # Sans l'A5, pas de zone de sécurité ; masqué à l'impression, permis aussi.
    CardDefinition.model_validate(
        {**raw, "formats": ["whatsapp_4_5", "story_9_16", "square_1_1"]}
    )
    layer(raw, "date")["formats"]["print_a5"] = {"hidden": True}
    CardDefinition.model_validate(raw)
    # Les fonds et les formes vont jusqu'au bord (fond perdu).
    assert layer(raw, "fond")["box"] == {"x": 0, "y": 0, "w": 100, "h": 100}


def test_prefill_from_event(raw: dict) -> None:
    definition = CardDefinition.model_validate(raw)
    event = SimpleNamespace(
        title="Dot d'Aya",
        starts_at=datetime(2026, 12, 12, 15, 30, tzinfo=UTC),
        location_name="  Domicile Konan, Angré ",
        location_address=None,
        dress_code=None,
        description="",
        rsvp_deadline=None,
    )
    values = resolve_values(definition, {}, event)
    assert values == {
        "fiances": "",
        "familles": "",
        "date": "2026-12-12",
        "heure": "15:30",
        "lieu": "Domicile Konan, Angré",
        "programme": "",
    }
    # La saisie de l'organisateur l'emporte ; un champ vide reprend l'événement.
    values = resolve_values(
        definition,
        {"lieu": "Chez les Yao", "date": "  ", "fiances": "Aya & Koffi"},
        event,
    )
    assert (values["lieu"], values["date"], values["fiances"]) == (
        "Chez les Yao",
        "2026-12-12",
        "Aya & Koffi",
    )
    # Le champ repris suit l'événement quand il change.
    event.starts_at = datetime(2027, 1, 9, 10, 0, tzinfo=UTC)
    assert resolve_values(definition, {}, event)["date"] == "2027-01-09"


def test_prefill_defaults_and_problems(raw: dict) -> None:
    raw["fields"][1]["default"] = "Konan et Yao"
    definition = CardDefinition.model_validate(raw)
    event = SimpleNamespace(starts_at=datetime(2026, 12, 12, 9, 0, tzinfo=UTC))
    values = resolve_values(definition, {}, event)
    assert values["familles"] == "Konan et Yao"
    assert values["heure"] == "09:00"
    assert problems(definition, values) == [
        "« Noms des fiancés » est obligatoire.",
        "« Lieu (domicile familial) » est obligatoire.",
    ]
    values.update(fiances="Aya & Koffi", lieu="x" * 91)
    assert problems(definition, values) == [
        "« Lieu (domicile familial) » : 90 caractères au plus."
    ]
