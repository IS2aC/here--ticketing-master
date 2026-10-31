"""Canvas des cartes : la carte dessinée dans l'éditeur (Doory) devient le fond et la mise en page de la carte."""

import io
import uuid

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import card_editor
from app.card_editor import Render, layout_from_fields
from tests.test_custom_card import image, upload
from tests.test_guest_response import invited

NAME = {
    "left": 100, "top": 700, "width": 880, "height": 90, "angle": 0, "font_size": 72, "color": "#7D2335",
    "font_family": "Playfair Display", "bold": True, "italic": False, "align": "center",
}  # fmt: skip


def test_layout_from_the_fields_placed_in_the_editor() -> None:
    layout = layout_from_fields(
        {
            "nom_invite": NAME,
            "table_invite": {**NAME, "top": 820, "font_family": "Inter", "font_size": 300, "align": "left"},
            "qr_code": {"left": 780, "top": 1050, "width": 240, "height": 240},
        }
    )  # fmt: skip
    name = layout["name"]
    assert (name["x"], name["y"], name["size"], name["font"], name["bold"]) == (
        540,
        745,
        72,
        "serif",
        True,
    )
    assert name["box"] == {"left": 100, "top": 700, "width": 880, "height": 90}
    table = layout["table"]
    assert (table["font"], table["size"], table["align"]) == (
        "sans",
        160,
        "left",
    )  # taille plafonnée
    assert layout["qr"] == {"x": 900, "y": 1170}


def test_layout_without_fields_keeps_the_usual_places() -> None:
    layout = layout_from_fields(
        {"nom_invite": {**NAME, "left": 2000, "color": "rouge"}}
    )
    assert layout["table"] is None and layout["qr"] == "bas-droite"
    assert (
        layout["name"]["box"]["left"] == 1079 and layout["name"]["color"] == "#0B0B0B"
    )
    assert layout_from_fields({})["name"]["y"] == 700


class FakeEditor:
    def __init__(self) -> None:
        self.created: list[tuple[str, str | None]] = []
        self.design = uuid.uuid4()

    async def templates(self, category: str | None) -> list[dict]:
        return [
            {
                "slug": "invitation-doree",
                "title": "Invitation dorée",
                "thumbnail": None,
                "category": category,
            }
        ]

    async def create_design(
        self, organizer_id, organizer_name, title, template
    ) -> uuid.UUID:
        self.created.append((title, template))
        self.design = uuid.uuid4()
        return self.design

    async def session_link(self, design_id, organizer_id, return_url) -> str:
        assert design_id == self.design and "/carte?editeur=1" in return_url
        return f"https://studio.example.com/api/v1/here/session/?t={design_id}"

    async def render(self, design_id, organizer_id) -> Render:
        out = io.BytesIO()
        Image.new("RGB", (1080, 1350), (250, 240, 230)).save(out, "JPEG")
        return Render(out.getvalue(), 1080, 1350, {"nom_invite": NAME})


@pytest.fixture
def editor(monkeypatch: pytest.MonkeyPatch) -> FakeEditor:
    fake = FakeEditor()
    monkeypatch.setattr(card_editor, "enabled", lambda: True)
    for name in ("templates", "create_design", "session_link", "render"):
        monkeypatch.setattr(card_editor, name, getattr(fake, name))
    return fake


@pytest.mark.db
def test_editor_off_without_its_secret(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id, _ = invited(client, organizer)
    assert (
        client.get(f"/v1/events/{event_id}/card", headers=organizer).json()[
            "editor_enabled"
        ]
        is False
    )
    assert (
        client.post(
            f"/v1/events/{event_id}/card/editor", json={}, headers=organizer
        ).status_code
        == 404
    )


@pytest.mark.db
def test_card_drawn_in_the_editor(
    client: TestClient, organizer: dict[str, str], editor: FakeEditor
) -> None:
    event_id, guests = invited(client, organizer)
    url = f"/v1/events/{event_id}/card"

    templates = client.get(f"{url}/editor/templates", headers=organizer).json()
    assert templates[0]["slug"] == "invitation-doree"

    # Valider avant d'avoir une carte dans l'éditeur : refusé.
    assert client.post(f"{url}/editor/validate", headers=organizer).status_code == 409

    # Première ouverture : une carte est créée d'après le modèle ; ensuite, la même carte est rouverte.
    link = client.post(
        f"{url}/editor", json={"template": "invitation-doree"}, headers=organizer
    ).json()
    assert link["url"].startswith("https://studio.example.com/")
    client.post(f"{url}/editor", json={}, headers=organizer)
    assert len(editor.created) == 1 and editor.created[0][1] == "invitation-doree"
    settings = client.get(url, headers=organizer).json()
    assert settings["editor"] is True and settings["custom"] is False

    # Validée : le rendu devient le fond, la place des champs la mise en page.
    valid = client.post(f"{url}/editor/validate", headers=organizer).json()
    assert valid["custom"] is True and valid["editor"] is True
    assert (
        valid["layout"]["name"]["box"]["top"] == 700
        and valid["layout"]["qr"] == "bas-droite"
    )
    stored = client.get(f"{url}/background", headers=organizer)
    assert Image.open(io.BytesIO(stored.content)).size == (1080, 1350)
    token = guests["Jean Konan"]["invitation_token"]
    assert (
        client.get(f"/v1/invitations/{token}").json()["card_layout"]["name"]["align"]
        == "center"
    )

    # Nouvelle carte vierge : une autre carte dans l'éditeur.
    client.post(f"{url}/editor", json={"new": True}, headers=organizer)
    assert editor.created[-1][1] is None and len(editor.created) == 2

    # Un fond importé remplace la carte de l'éditeur et sa mise en page.
    imported = upload(client, organizer, event_id, image(800, 1000)).json()
    assert imported["editor"] is False and imported["layout"]["name"]["box"] is None


@pytest.mark.db
def test_editor_card_locked_after_sending(
    client: TestClient, organizer: dict[str, str], editor: FakeEditor
) -> None:
    event_id, _ = invited(client, organizer)
    url = f"/v1/events/{event_id}/card"
    client.post(f"{url}/editor", json={}, headers=organizer)
    client.post(f"{url}/editor/validate", headers=organizer)
    client.post(f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer)
    assert client.post(f"{url}/editor", json={}, headers=organizer).status_code == 409
    assert client.post(f"{url}/editor/validate", headers=organizer).status_code == 409
