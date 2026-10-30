"""Carte de l'événement : intitulé et palette modifiables, figés une fois les invitations parties."""

import pytest
from fastapi.testclient import TestClient

from tests.test_guest_response import invited

pytestmark = pytest.mark.db


def test_title_and_palette(client: TestClient, organizer: dict[str, str]) -> None:
    event_id, guests = invited(client, organizer)
    url = f"/v1/events/{event_id}/card"
    assert client.get(url, headers=organizer).json() == {
        "title": None,
        "palette": None,
        "locked": False,
    }
    saved = client.patch(
        url, json={"title": "Anniversaire Ange", "palette": "rose"}, headers=organizer
    ).json()
    assert saved == {"title": "Anniversaire Ange", "palette": "rose", "locked": False}
    card = client.get(
        f"/v1/invitations/{guests['Jean Konan']['invitation_token']}"
    ).json()
    assert card["card_title"] == "Anniversaire Ange" and card["card_palette"] == "rose"

    assert (
        client.patch(url, json={"palette": "Rose !"}, headers=organizer).status_code
        == 422
    )
    # null : retour à l'intitulé (nom de l'événement) et à la palette d'origine.
    back = client.patch(url, json={"title": None, "palette": None}, headers=organizer)
    assert back.json() == {"title": None, "palette": None, "locked": False}


def test_card_is_locked_once_invitations_leave(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id, guests = invited(client, organizer)
    url = f"/v1/events/{event_id}/card"
    client.patch(url, json={"palette": "rose"}, headers=organizer)
    client.post(f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer)

    assert client.get(url, headers=organizer).json()["locked"] is True
    refused = client.patch(url, json={"title": "Autre"}, headers=organizer)
    assert refused.status_code == 409
    assert "invitations sont parties" in refused.json()["detail"]["message"]

    # Le type d'événement change ensuite : la carte déjà envoyée garde son modèle.
    token = guests["Jean Konan"]["invitation_token"]
    before = client.get(f"/v1/invitations/{token}").json()
    client.patch(
        f"/v1/events/{event_id}", json={"type": "seminaire"}, headers=organizer
    )
    client.post(f"/v1/events/{event_id}/invitations", headers=organizer)
    after = client.get(f"/v1/invitations/{token}").json()
    assert after["card_palette"] == before["card_palette"] == "rose"
