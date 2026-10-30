"""« Mon propre modèle » : fond importé, mise en page, carte de l'invité, blocage après l'envoi."""

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from tests.test_guest_response import invited

pytestmark = pytest.mark.db


def image(width: int, height: int, fmt: str = "PNG") -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (width, height), (240, 220, 200)).save(out, fmt)
    return out.getvalue()


def upload(client: TestClient, headers: dict[str, str], event_id: str, content: bytes):
    return client.put(
        f"/v1/events/{event_id}/card/background",
        files={"file": ("fond.png", content, "image/png")},
        headers=headers,
    )


LAYOUT = {
    "name": {
        "x": 540,
        "y": 600,
        "size": 80,
        "color": "#7D2335",
        "font": "serif",
        "bold": True,
    },
    "table": None,
    "qr": "bas-gauche",
}


def test_own_card_model(client: TestClient, organizer: dict[str, str]) -> None:
    event_id, guests = invited(client, organizer)
    url = f"/v1/events/{event_id}/card"

    # Mise en page avant le fond : refusée.
    assert (
        client.patch(url, json={"layout": LAYOUT}, headers=organizer).status_code == 409
    )

    # Fond refusé : trop petit, ou pas une image.
    small = upload(client, organizer, event_id, image(300, 300))
    assert (
        small.status_code == 422 and "trop petite" in small.json()["detail"]["message"]
    )
    assert upload(client, organizer, event_id, b"pas une image").status_code == 422

    # Fond au bon format : la carte passe sur ce fond, avec une mise en page proposée.
    ok = upload(client, organizer, event_id, image(800, 1000)).json()
    assert ok["custom"] is True and ok["cropped"] is False
    assert ok["layout"]["qr"] == "bas-droite" and ok["layout"]["table"]
    stored = client.get(f"{url}/background", headers=organizer)
    assert stored.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(stored.content)).size == (1080, 1350)

    # Paysage : recadré (signalé).
    assert upload(client, organizer, event_id, image(1600, 900, "JPEG")).json()[
        "cropped"
    ]

    # Mise en page : enregistrée, vérifiée.
    saved = client.patch(url, json={"layout": LAYOUT}, headers=organizer).json()
    assert (
        saved["layout"]["name"]["color"] == "#7D2335"
        and saved["layout"]["table"] is None
    )
    bad = {**LAYOUT, "name": {**LAYOUT["name"], "color": "rouge"}}
    assert client.patch(url, json={"layout": bad}, headers=organizer).status_code == 422

    # Côté invité : la mise en page et le fond (par le jeton de l'invitation).
    token = guests["Jean Konan"]["invitation_token"]
    card = client.get(f"/v1/invitations/{token}").json()
    assert card["card_layout"]["qr"] == "bas-gauche"
    assert client.get(f"/v1/invitations/{token}/background").status_code == 200

    # Retour à la carte automatique.
    back = client.delete(f"{url}/background", headers=organizer).json()
    assert back["custom"] is False and back["layout"] is None
    assert client.get(f"{url}/background", headers=organizer).status_code == 404
    assert client.get(f"/v1/invitations/{token}").json()["card_layout"] is None


def test_own_card_locked_after_sending(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id, _ = invited(client, organizer)
    upload(client, organizer, event_id, image(800, 1000))
    client.post(f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer)
    assert upload(client, organizer, event_id, image(800, 1000)).status_code == 409
    url = f"/v1/events/{event_id}/card"
    assert client.delete(f"{url}/background", headers=organizer).status_code == 409
    assert (
        client.patch(url, json={"layout": LAYOUT}, headers=organizer).status_code == 409
    )
