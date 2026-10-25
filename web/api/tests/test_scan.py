import pytest
from fastapi.testclient import TestClient

from app.routers.invitations import invitation_code
from tests.test_guest_response import invited, sql

pytestmark = pytest.mark.db


def link(
    client: TestClient, organizer: dict[str, str], event_id: str, label: str = "Porte A"
) -> dict:
    response = client.post(
        f"/v1/events/{event_id}/scan-links", json={"label": label}, headers=organizer
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_scan_flow(client: TestClient, organizer: dict[str, str]) -> None:
    event_id, guests = invited(client, organizer)
    porte_a = link(client, organizer, event_id)
    porte_b = link(client, organizer, event_id, "Porte B")
    jean = guests["Jean Konan"]

    start = client.get(f"/v1/scan/{porte_a['token']}").json()
    assert start["label"] == "Porte A"
    assert start == {**start, "arrived": 0, "expected": 3}

    # QR code de la carte : l'adresse de la page invité.
    qr = f"http://localhost:3000/i/{jean['invitation_token']}"
    first = client.post(f"/v1/scan/{porte_a['token']}/check", json={"value": qr}).json()
    assert first["result"] == "admitted"
    assert first["guest"]["name"] == "Jean Konan"
    assert first["guest"]["category"] == "VIP"
    assert first["guest"]["seat"] == "Table 1"
    assert first["event"]["arrived"] == 1
    assert "phone" not in first["guest"]

    # Le même QR code à une autre porte : déjà entré, avec l'heure et la porte de la première entrée.
    again = client.post(f"/v1/scan/{porte_b['token']}/check", json={"value": qr}).json()
    assert again["result"] == "already"
    assert again["entered_by"] == "Porte A"
    assert again["entered_at"] == first["entered_at"]

    # Code imprimé sur la carte, saisi à la main.
    paul = guests["Paul Assi"]
    code = invitation_code(paul["invitation_token"]).lower()
    by_code = client.post(
        f"/v1/scan/{porte_b['token']}/check", json={"value": code}
    ).json()
    assert by_code["result"] == "admitted"
    assert by_code["guest"]["name"] == "Paul Assi"

    # Chercher par nom puis faire entrer.
    found = client.get(
        f"/v1/scan/{porte_b['token']}/guests", params={"q": "fatou"}
    ).json()
    assert [g["name"] for g in found] == ["Fatou Bamba"]
    assert (
        client.get(f"/v1/scan/{porte_b['token']}/guests", params={"q": "f"}).json()
        == []
    )
    chosen = client.post(
        f"/v1/scan/{porte_b['token']}/check", json={"guest_id": found[0]["guest_id"]}
    ).json()
    assert chosen["result"] == "admitted"
    assert chosen["event"]["arrived"] == 3

    # Invitation d'un autre événement ou code inconnu.
    unknown = client.post(
        f"/v1/scan/{porte_a['token']}/check", json={"value": "INV-AAAA-BBBB"}
    ).json()
    assert unknown["result"] == "unknown"
    assert unknown["code"] == "INV-AAAA-BBBB"

    links = client.get(f"/v1/events/{event_id}/scan-links", headers=organizer).json()
    assert {item["label"]: item["checkins"] for item in links} == {
        "Porte A": 1,
        "Porte B": 2,
    }
    assert (
        client.get(f"/v1/events/{event_id}", headers=organizer).json()["stats"][
            "arrived"
        ]
        == 3
    )


def test_link_revoked_expired_and_private(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id, _ = invited(client, organizer)
    porte = link(client, organizer, event_id)
    assert client.get(f"/v1/scan/{porte['token']}").status_code == 200

    revoked = client.post(
        f"/v1/events/{event_id}/scan-links/{porte['id']}/revoke", headers=organizer
    ).json()
    assert revoked["active"] is False
    assert client.get(f"/v1/scan/{porte['token']}").status_code == 404
    assert (
        client.post(f"/v1/scan/{porte['token']}/check", json={"value": "x"}).status_code
        == 404
    )

    other = link(client, organizer, event_id, "Porte C")
    sql(
        "UPDATE scan_links SET expires_at = now() - interval '1 minute' WHERE id = $1",
        other["id"],
    )
    assert client.get(f"/v1/scan/{other['token']}").status_code == 404

    stranger = client.post(
        "/v1/auth/register",
        json={
            "first_name": "A",
            "last_name": "B",
            "phone": "0714141414",
            "password": "mot-de-passe",
        },
    ).json()
    headers = {"Authorization": f"Bearer {stranger['access_token']}"}
    assert (
        client.get(f"/v1/events/{event_id}/scan-links", headers=headers).status_code
        == 404
    )
    assert (
        client.post(
            f"/v1/events/{event_id}/scan-links", json={}, headers=headers
        ).status_code
        == 404
    )
