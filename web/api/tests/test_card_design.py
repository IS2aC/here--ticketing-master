"""Éditeur de cartes : document de l'éditeur (concurrence optimiste) et ses images, figés après l'envoi."""

import hashlib
import uuid

import pytest
from fastapi.testclient import TestClient

from tests.test_custom_card import image
from tests.test_guest_response import invited

pytestmark = pytest.mark.db


def document(document_id: str, title: str = "Carte") -> dict:
    return {"schemaVersion": 1, "id": document_id, "meta": {"title": title}}


def key(content: bytes) -> str:
    return "sha256-" + hashlib.sha256(content).hexdigest()


def test_design_document(client: TestClient, organizer: dict[str, str]) -> None:
    event_id, _ = invited(client, organizer)
    url = f"/v1/events/{event_id}/card/design"
    doc_id = str(uuid.uuid4())

    assert client.get(url, headers=organizer).status_code == 404
    # Premier enregistrement : révision attendue 0.
    assert (
        client.put(
            url,
            json={"document": document(doc_id), "expected_revision": 3},
            headers=organizer,
        ).status_code
        == 409
    )
    first = client.put(
        url,
        json={"document": document(doc_id), "expected_revision": 0},
        headers=organizer,
    )
    assert first.status_code == 200 and first.json()["revision"] == 1

    second = client.put(
        url,
        json={"document": document(doc_id, "Mariage"), "expected_revision": 1},
        headers=organizer,
    ).json()
    assert second["revision"] == 2
    saved = client.get(url, headers=organizer).json()
    assert saved["revision"] == 2 and saved["document"]["meta"]["title"] == "Mariage"

    # Révision dépassée (autre onglet) ou autre document : refusé, rien n'est écrasé.
    stale = client.put(
        url,
        json={"document": document(doc_id, "X"), "expected_revision": 1},
        headers=organizer,
    )
    assert stale.status_code == 409 and stale.json()["detail"]["code"] == "conflict"
    other = client.put(
        url,
        json={"document": document(str(uuid.uuid4())), "expected_revision": 2},
        headers=organizer,
    )
    assert other.status_code == 409
    assert (
        client.get(url, headers=organizer).json()["document"]["meta"]["title"]
        == "Mariage"
    )

    # Nouvelle carte demandée (modèle, document vierge) : elle remplace l'actuelle.
    new_id = str(uuid.uuid4())
    replaced = client.put(
        url,
        json={"document": document(new_id), "expected_revision": 2, "replace": True},
        headers=organizer,
    )
    assert replaced.status_code == 200 and replaced.json()["revision"] == 3
    assert client.get(url, headers=organizer).json()["document"]["id"] == new_id

    # Pas un document de l'éditeur.
    assert (
        client.put(
            url,
            json={"document": {"id": "x"}, "expected_revision": 2},
            headers=organizer,
        ).status_code
        == 422
    )


def test_design_assets(client: TestClient, organizer: dict[str, str]) -> None:
    event_id, _ = invited(client, organizer)
    url = f"/v1/events/{event_id}/card/design/assets"
    png = image(40, 40)

    assert client.get(url, headers=organizer).json() == []
    # La clé doit être l'empreinte du contenu, et le contenu une image.
    wrong = client.put(f"{url}/{key(b'autre')}", content=png, headers=organizer)
    assert wrong.status_code == 422
    text = b"pas une image"
    assert (
        client.put(f"{url}/{key(text)}", content=text, headers=organizer).status_code
        == 422
    )

    assert (
        client.put(f"{url}/{key(png)}", content=png, headers=organizer).status_code
        == 204
    )
    # Renvoyer la même image ne change rien.
    assert (
        client.put(f"{url}/{key(png)}", content=png, headers=organizer).status_code
        == 204
    )
    assert client.get(url, headers=organizer).json() == [key(png)]
    got = client.get(f"{url}/{key(png)}", headers=organizer)
    assert got.status_code == 200 and got.content == png
    assert got.headers["content-type"] == "image/png"
    assert client.get(f"{url}/{key(b'absente')}", headers=organizer).status_code == 404


def test_design_private_and_locked(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id, _ = invited(client, organizer)
    url = f"/v1/events/{event_id}/card/design"
    doc = document(str(uuid.uuid4()))
    client.put(url, json={"document": doc, "expected_revision": 0}, headers=organizer)

    # Un autre organisateur ne voit pas la carte.
    other = client.post(
        "/v1/auth/register",
        json={
            "first_name": "Awa",
            "last_name": "Traoré",
            "phone": "0799999913",
            "password": "mot-de-passe",
        },
    )
    stranger = {"Authorization": f"Bearer {other.json()['access_token']}"}
    assert client.get(url, headers=stranger).status_code == 404
    assert client.get(f"{url}/assets", headers=stranger).status_code == 404

    # Invitations parties : la carte est figée, le document aussi.
    client.post(f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer)
    locked = client.put(
        url, json={"document": doc, "expected_revision": 1}, headers=organizer
    )
    assert (
        locked.status_code == 409
        and "plus être modifiée" in locked.json()["detail"]["message"]
    )
    png = image(40, 40)
    assert (
        client.put(
            f"{url}/assets/{key(png)}", content=png, headers=organizer
        ).status_code
        == 409
    )
    assert client.get(url, headers=organizer).status_code == 200


def test_design_svg_assets(client: TestClient, organizer: dict[str, str]) -> None:
    event_id, _ = invited(client, organizer)
    url = f"/v1/events/{event_id}/card/design/assets"
    svg = b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><defs><linearGradient id="g"/></defs><path fill="url(#g)" d="M0 0h10v10z"/></svg>'
    assert (
        client.put(f"{url}/{key(svg)}", content=svg, headers=organizer).status_code
        == 204
    )
    got = client.get(f"{url}/{key(svg)}", headers=organizer)
    assert got.headers["content-type"].startswith("image/svg+xml")

    # Contenu actif : refusé, même si le navigateur était censé l'avoir nettoyé.
    for active in (
        b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
        b'<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/x.svg#a"/></svg>',
    ):
        refused = client.put(f"{url}/{key(active)}", content=active, headers=organizer)
        assert refused.status_code == 422, active
