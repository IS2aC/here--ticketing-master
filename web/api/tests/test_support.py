"""Écran de la conseillère : file d'appels (résultat → réponse de l'invité) et messages des invités."""

import pytest
from fastapi.testclient import TestClient

from tests.test_guest_response import invited, sql

pytestmark = pytest.mark.db


def staff(client: TestClient, phone: str, role: str) -> dict[str, str]:
    token = client.post(
        "/v1/auth/register",
        json={
            "first_name": "Mariam",
            "last_name": "Coulibaly",
            "phone": phone,
            "password": "mot-de-passe",
        },
    ).json()["access_token"]
    sql(f"UPDATE users SET role = '{role}' WHERE phone = '+225{phone}'")
    return {"Authorization": f"Bearer {token}"}


def test_staff_only(client: TestClient, organizer: dict[str, str]) -> None:
    support = staff(client, "0788000001", "support")
    for path in ("calls", "inbound"):
        assert client.get(f"/v1/admin/{path}", headers=organizer).status_code == 403
        assert client.get(f"/v1/admin/{path}", headers=support).status_code == 200
    # Le support ne voit que cet écran : pas le reste du portail.
    assert client.get("/v1/admin/dashboard", headers=support).status_code == 403


def test_call_queue_and_results(client: TestClient, organizer: dict[str, str]) -> None:
    support = staff(client, "0788000002", "support")
    event_id, guests = invited(client, organizer)
    jean, paul = guests["Jean Konan"], guests["Paul Assi"]
    for guest in (jean, paul):
        sql(
            "INSERT INTO calls (guest_id, scheduled_at) VALUES ($1::uuid, now())",
            guest["id"],
        )

    page = client.get("/v1/admin/calls", headers=support).json()
    mine = [c for c in page["items"] if c["event_id"] == event_id]
    assert {c["guest_name"] for c in mine} == {"Jean Konan", "Paul Assi"}
    call = next(c for c in mine if c["guest_name"] == "Jean Konan")
    assert call["phone"] == "+2250707123456"  # numéro complet : elle appelle
    assert call["host"] == "Test Organisateur" and call["called_at"] is None

    # Confirmé : la réponse de l'invité suit, l'appel passe dans « faits ».
    done = client.post(
        f"/v1/admin/calls/{call['id']}/result",
        json={"outcome": "confirmed", "notes": "Viendra avec son épouse."},
        headers=support,
    ).json()
    assert done["outcome"] == "confirmed" and done["agent_name"] == "Mariam"
    assert done["rsvp_status"] == "confirmed" and done["called_at"]
    listed = client.get(f"/v1/events/{event_id}/guests", headers=organizer).json()
    assert (
        next(g for g in listed if g["id"] == jean["id"])["rsvp_status"] == "confirmed"
    )

    # Mauvais numéro : injoignable, numéro à vérifier.
    paul_call = next(c for c in mine if c["guest_name"] == "Paul Assi")
    client.post(
        f"/v1/admin/calls/{paul_call['id']}/result",
        json={"outcome": "wrong_number"},
        headers=support,
    )
    listed = client.get(f"/v1/events/{event_id}/guests", headers=organizer).json()
    paul_now = next(g for g in listed if g["id"] == paul["id"])
    assert paul_now["contact_status"] == "unreachable"
    assert paul_now["phone_valid"] is False

    after = client.get("/v1/admin/calls", headers=support).json()
    assert all(c["event_id"] != event_id for c in after["items"])  # plus rien à faire
    history = client.get(
        "/v1/admin/calls", params={"state": "faits"}, headers=support
    ).json()
    assert {c["guest_name"] for c in history["items"]} >= {"Jean Konan", "Paul Assi"}


def test_inbound_messages(client: TestClient, organizer: dict[str, str]) -> None:
    admin = staff(client, "0788000003", "admin")
    _, guests = invited(client, organizer)
    sql(
        "INSERT INTO inbound_messages (guest_id, phone, body) "
        "VALUES ($1::uuid, '+2250707123456', 'On sera 3, merci !')",
        guests["Jean Konan"]["id"],
    )
    sql(
        "INSERT INTO inbound_messages (phone, body) "
        "VALUES ('+2250799111111', 'Qui êtes-vous ?')"
    )
    page = client.get("/v1/admin/inbound", headers=admin).json()
    by_body = {m["body"]: m for m in page["items"]}
    known = by_body["On sera 3, merci !"]
    assert known["guest_name"] == "Jean Konan" and known["event_title"] == "Mariage"
    assert by_body["Qui êtes-vous ?"]["guest_name"] is None  # numéro inconnu

    to_do = page["to_do"]
    url = f"/v1/admin/inbound/{known['id']}/handled"
    assert client.post(url, json={"handled": True}, headers=admin).status_code == 204
    page = client.get("/v1/admin/inbound", headers=admin).json()
    assert page["to_do"] == to_do - 1
    assert known["id"] not in [m["id"] for m in page["items"]]
    handled = client.get(
        "/v1/admin/inbound", params={"state": "traites"}, headers=admin
    ).json()
    assert known["id"] in [m["id"] for m in handled["items"]]
    client.post(url, json={"handled": False}, headers=admin)  # remis à traiter
    assert client.get("/v1/admin/inbound", headers=admin).json()["to_do"] == to_do
