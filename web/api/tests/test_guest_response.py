import asyncio

import asyncpg
import pytest
from fastapi.testclient import TestClient

from tests.conftest import TEST_DATABASE_URL
from tests.test_imports import FILE, new_event, upload

pytestmark = pytest.mark.db


def invited(
    client: TestClient, organizer: dict[str, str]
) -> tuple[str, dict[str, dict]]:
    """Événement avec la liste importée et les cartes préparées ; renvoie les invités par nom."""
    event_id = new_event(client, organizer, ["VIP"])
    preview = upload(client, organizer, event_id, FILE).json()
    client.post(
        f"/v1/events/{event_id}/imports/{preview['id']}/confirm", headers=organizer
    )
    client.post(f"/v1/events/{event_id}/invitations", headers=organizer)
    guests = client.get(f"/v1/events/{event_id}/guests", headers=organizer).json()
    return event_id, {g["display_name"]: g for g in guests}


def sql(query: str, *args: object) -> None:
    async def run() -> None:
        conn = await asyncpg.connect(TEST_DATABASE_URL)
        await conn.execute(query, *args)
        await conn.close()

    asyncio.run(run())


def test_confirm_decline_and_change_mind(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id, guests = invited(client, organizer)
    token = guests["Jean Konan"]["invitation_token"]
    url = f"/v1/invitations/{token}/response"

    card = client.get(f"/v1/invitations/{token}").json()
    assert card["rsvp_status"] == "pending"
    assert card["responses_open"] is True

    assert (
        client.post(url, json={"attending": True, "seats": 2}).status_code == 422
    )  # 1 place

    yes = client.post(url, json={"attending": True})
    assert yes.status_code == 200, yes.text
    assert yes.json()["rsvp_status"] == "confirmed"
    assert yes.json()["attending_seats"] == 1

    no = client.post(
        url, json={"attending": False, "message": "  Toutes nos félicitations  "}
    )
    assert no.json()["rsvp_status"] == "declined"
    assert no.json()["attending_seats"] == 0
    assert no.json()["rsvp_message"] == "Toutes nos félicitations"

    # « Finalement, je viendrai » : le mot déjà laissé est gardé.
    back = client.post(url, json={"attending": True}).json()
    assert back["rsvp_status"] == "confirmed"
    assert back["rsvp_message"] == "Toutes nos félicitations"

    # L'organisateur voit la réponse.
    event = client.get(f"/v1/events/{event_id}", headers=organizer).json()
    assert event["stats"]["confirmed"] == 1
    listed = next(
        g
        for g in client.get(f"/v1/events/{event_id}/guests", headers=organizer).json()
        if g["invitation_token"] == token
    )
    assert listed["rsvp_status"] == "confirmed"
    assert listed["rsvp_message"] == "Toutes nos félicitations"


def test_seats_selector_capped(client: TestClient, organizer: dict[str, str]) -> None:
    _, guests = invited(client, organizer)
    token = guests["Paul Assi"]["invitation_token"]
    sql(
        "UPDATE guests SET seats = 3 FROM invitations WHERE invitations.guest_id = guests.id AND token = $1",
        token,
    )
    url = f"/v1/invitations/{token}/response"
    assert (
        client.post(url, json={"attending": True, "seats": 2}).json()["attending_seats"]
        == 2
    )
    assert client.post(url, json={"attending": True}).json()["attending_seats"] == 3
    assert client.post(url, json={"attending": True, "seats": 4}).status_code == 422


def test_responses_closed(client: TestClient, organizer: dict[str, str]) -> None:
    event_id, guests = invited(client, organizer)
    token = guests["Fatou Bamba"]["invitation_token"]
    url = f"/v1/invitations/{token}/response"

    sql("UPDATE events SET status = 'cancelled' WHERE id = $1", event_id)
    assert client.get(f"/v1/invitations/{token}").json()["responses_open"] is False
    assert client.post(url, json={"attending": True}).status_code == 409

    sql(
        "UPDATE events SET status = 'draft', starts_at = now() - interval '1 hour' WHERE id = $1",
        event_id,
    )
    assert client.post(url, json={"attending": True}).status_code == 409
    assert (
        client.post(
            "/v1/invitations/jeton-inconnu/response", json={"attending": True}
        ).status_code
        == 404
    )
