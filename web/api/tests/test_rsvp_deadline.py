"""Page invité : date limite de réponse, invitation ouverte."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.messaging import plan_follow_ups
from app.whatsapp.console import ConsoleProvider
from tests.test_guest_response import invited, sql
from tests.test_whatsapp import deliver_next, run_db

pytestmark = pytest.mark.db


def iso(delta: timedelta) -> str:
    return (datetime.now(UTC) + delta).isoformat()


def test_deadline_must_be_before_the_event(
    client: TestClient, organizer: dict[str, str]
) -> None:
    body = {"title": "Dot", "type": "dot", "starts_at": iso(timedelta(days=10))}
    late = client.post(
        "/v1/events",
        json={**body, "rsvp_deadline": iso(timedelta(days=11))},
        headers=organizer,
    )
    assert late.status_code == 422
    assert late.json()["detail"][0]["loc"][-1] == "rsvp_deadline"
    ok = client.post(
        "/v1/events",
        json={**body, "rsvp_deadline": iso(timedelta(days=5))},
        headers=organizer,
    )
    assert ok.status_code == 201 and ok.json()["rsvp_deadline"]
    # Avancer l'événement avant la date limite : refusé.
    moved = client.patch(
        f"/v1/events/{ok.json()['id']}",
        json={"starts_at": iso(timedelta(days=3))},
        headers=organizer,
    )
    assert moved.status_code == 422


def test_responses_close_at_the_deadline(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id, guests = invited(client, organizer)
    token = guests["Jean Konan"]["invitation_token"]
    card = client.get(f"/v1/invitations/{token}").json()
    assert card["responses_open"] and card["rsvp_deadline"] is None
    assert card["responses_until"] == card["starts_at"]  # sans date : jusqu'au début

    deadline = iso(timedelta(days=5))
    client.patch(
        f"/v1/events/{event_id}", json={"rsvp_deadline": deadline}, headers=organizer
    )
    card = client.get(f"/v1/invitations/{token}").json()
    assert card["responses_open"] and card["responses_until"] == card["rsvp_deadline"]

    sql(
        f"UPDATE events SET rsvp_deadline = now() - interval '1 hour' WHERE id = '{event_id}'"
    )
    assert client.get(f"/v1/invitations/{token}").json()["responses_open"] is False
    closed = client.post(f"/v1/invitations/{token}/response", json={"attending": True})
    assert closed.status_code == 409


def test_opened_is_recorded_once_and_only_for_visits(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id, guests = invited(client, organizer)
    token = guests["Jean Konan"]["invitation_token"]
    url = f"/v1/events/{event_id}/guests"

    def opened() -> str | None:
        listed = client.get(url, headers=organizer).json()
        return next(g for g in listed if g["display_name"] == "Jean Konan")["opened_at"]

    client.get(f"/v1/invitations/{token}")  # aperçu du lien, carte : pas une visite
    assert opened() is None
    client.get(f"/v1/invitations/{token}", params={"vue": "1"})
    first = opened()
    assert first is not None
    client.get(f"/v1/invitations/{token}", params={"vue": "1"})
    assert opened() == first  # la première ouverture reste
    view = client.get(f"/v1/events/{event_id}/whatsapp", headers=organizer).json()
    assert view["invitations_opened"] == 1


def test_no_reminder_after_the_deadline(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id, _ = invited(client, organizer)
    client.post(f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer)
    while deliver_next(ConsoleProvider()):
        pass
    sql(
        "UPDATE messages SET sent_at = now() - interval '20 days' WHERE guest_id IN "
        f"(SELECT id FROM guests WHERE event_id = '{event_id}')"
    )
    # Événement dans 6 jours (relance J-7 due), mais réponses closes depuis hier : pas de relance.
    sql(
        "UPDATE events SET starts_at = now() + interval '6 days', "
        f"rsvp_deadline = now() - interval '1 day' WHERE id = '{event_id}'"
    )
    assert run_db(plan_follow_ups) == (0, 0)

    # Dates de relance : pas après la date limite.
    sql(
        "UPDATE events SET starts_at = now() + interval '30 days', "
        f"rsvp_deadline = now() + interval '10 days' WHERE id = '{event_id}'"
    )
    later = (datetime.now(UTC) + timedelta(days=15)).date().isoformat()
    refused = client.patch(
        f"/v1/events/{event_id}/whatsapp",
        json={"reminder_dates": [later]},
        headers=organizer,
    )
    assert refused.status_code == 422
    assert "date limite" in refused.json()["detail"]["message"]
