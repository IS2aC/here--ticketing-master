"""Rappel la veille : la carte et le QR code d'entrée, aux invités confirmés. Option payante."""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.messaging import plan_day_before
from app.whatsapp.console import ConsoleProvider
from tests.test_guest_response import invited, sql
from tests.test_whatsapp import deliver_next, run_db

pytestmark = pytest.mark.db


def flush(provider: ConsoleProvider) -> list[str | None]:
    statuses = []
    while status := deliver_next(provider):
        statuses.append(status)
    return statuses


def test_day_before_reminder(
    client: TestClient, organizer: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    # Heure d'envoi à minuit : le moment « la veille » est toujours passé pour un événement dans 20 h.
    monkeypatch.setattr(get_settings(), "whatsapp_day_before_hour", 0)
    event_id, guests = invited(client, organizer)
    provider = ConsoleProvider()
    client.post(f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer)
    flush(provider)
    jean = guests["Jean Konan"]
    client.post(
        f"/v1/invitations/{jean['invitation_token']}/response", json={"attending": True}
    )
    sql(
        f"UPDATE events SET starts_at = now() + interval '20 hours' WHERE id = '{event_id}'"
    )

    view = client.get(f"/v1/events/{event_id}/whatsapp", headers=organizer).json()
    assert view["day_before_option"] is False and view["day_before_enabled"] is True
    assert view["day_before_at"]

    # Sans l'option : rien.
    assert run_db(plan_day_before) == 0

    # L'équipe Here! active l'option pour ce compte.
    owner = client.get("/v1/me", headers=organizer).json()
    sql(f"UPDATE users SET day_before_reminders = true WHERE id = '{owner['id']}'")
    assert (
        client.get(f"/v1/events/{event_id}/whatsapp", headers=organizer).json()[
            "day_before_option"
        ]
        is True
    )

    # Un seul rappel, pour l'invité confirmé, avec la carte (image) et le QR code.
    assert run_db(plan_day_before) == 1
    assert run_db(plan_day_before) == 0
    assert flush(provider) == ["sent"]
    message = provider.sent[-1]
    assert message["type"] == "image" and "QR code" in str(message["text"])
    view = client.get(f"/v1/events/{event_id}/whatsapp", headers=organizer).json()
    assert view["day_before"]["sent"] == 1


def test_day_before_switched_off_or_declined(
    client: TestClient, organizer: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "whatsapp_day_before_hour", 0)
    event_id, guests = invited(client, organizer)
    owner = client.get("/v1/me", headers=organizer).json()
    sql(f"UPDATE users SET day_before_reminders = true WHERE id = '{owner['id']}'")
    provider = ConsoleProvider()
    client.post(f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer)
    flush(provider)
    token = guests["Jean Konan"]["invitation_token"]
    client.post(f"/v1/invitations/{token}/response", json={"attending": True})
    sql(
        f"UPDATE events SET starts_at = now() + interval '20 hours' WHERE id = '{event_id}'"
    )

    # L'organisateur le coupe pour cet événement.
    client.patch(
        f"/v1/events/{event_id}/whatsapp",
        json={"day_before_enabled": False},
        headers=organizer,
    )
    assert run_db(plan_day_before) == 0
    client.patch(
        f"/v1/events/{event_id}/whatsapp",
        json={"day_before_enabled": True},
        headers=organizer,
    )
    assert run_db(plan_day_before) == 1

    # L'invité se désiste avant l'envoi : le rappel ne part pas.
    client.post(f"/v1/invitations/{token}/response", json={"attending": False})
    assert flush(provider) == ["canceled"]
    assert run_db(plan_day_before) == 0  # plus confirmé


def test_admin_turns_the_option_on(
    client: TestClient, organizer: dict[str, str]
) -> None:
    owner = client.get("/v1/me", headers=organizer).json()
    admin = client.post(
        "/v1/auth/register",
        json={
            "first_name": "Équipe",
            "last_name": "Here",
            "phone": "0799999904",
            "password": "mot-de-passe",
        },
    ).json()["access_token"]
    sql("UPDATE users SET role = 'admin' WHERE phone = '+2250799999904'")
    headers = {"Authorization": f"Bearer {admin}"}
    updated = client.patch(
        f"/v1/admin/users/{owner['id']}",
        json={"day_before_reminders": True},
        headers=headers,
    ).json()
    assert updated["day_before_reminders"] is True
    assert updated["on_demand_reminders"] is False  # l'autre option ne bouge pas

    settings = client.get("/v1/admin/settings", headers=headers).json()
    assert settings["values"]["whatsapp_day_before_hour"] == 10
