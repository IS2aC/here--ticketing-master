"""Portail admin : accès réservé, suivi des comptes et des événements, réglages sans redéploiement."""

import asyncio
import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.admin import set_role
from app.config import get_settings
from app.models import UserRole
from app.whatsapp.console import ConsoleProvider
from tests.test_guest_response import invited, sql
from tests.test_whatsapp import deliver_next

pytestmark = pytest.mark.db


def make_admin(client: TestClient, headers: dict[str, str]) -> dict:
    me = client.get("/v1/me", headers=headers).json()
    sql("UPDATE users SET role = 'admin' WHERE id = $1", me["id"])
    return me


def test_set_role_refuses_an_invalid_number() -> None:
    assert asyncio.run(set_role("12", UserRole.admin)) == (
        False,
        "Numéro invalide : 12",
    )


def test_admin_only(client: TestClient, organizer: dict[str, str]) -> None:
    for path in ("dashboard", "users", "events", "settings"):
        refused = client.get(f"/v1/admin/{path}", headers=organizer)
        assert refused.status_code == 403
        assert refused.json()["detail"]["message"]
    assert client.get("/v1/admin/dashboard").status_code == 401


def test_follow_users_and_events(client: TestClient, organizer: dict[str, str]) -> None:
    event_id, guests = invited(client, organizer)
    owner = client.get("/v1/me", headers=organizer).json()
    admin_headers = client.post(
        "/v1/auth/register",
        json={
            "first_name": "Équipe",
            "last_name": "Here",
            "phone": "0799999901",
            "password": "mot-de-passe",
        },
    ).json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_headers}"}
    make_admin(client, admin_headers)

    # Invitations envoyées, une réponse, un échec : visibles sur le tableau de bord.
    jean = guests["Jean Konan"]
    client.post(f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer)
    provider = ConsoleProvider()
    while deliver_next(provider):
        pass
    client.post(
        f"/v1/invitations/{jean['invitation_token']}/response",
        json={"attending": True},
    )
    sql(
        "INSERT INTO messages (guest_id, kind, status) "
        "SELECT id, 'reminder', 'failed' FROM guests WHERE event_id = $1 LIMIT 1",
        uuid.UUID(event_id),
    )

    url = "/v1/admin/dashboard"
    assert (
        client.get(url, params={"days": 12}, headers=admin_headers).status_code == 422
    )
    view = client.get(url, params={"days": 7}, headers=admin_headers).json()
    assert view["period_days"] == 7 and len(view["series"]) == 7
    assert view["series"][-1]["day"] == str(datetime.now(UTC).date())
    assert view["organizers"]["new"] >= 2 and view["organizers"]["total"] >= 2
    assert view["events_by_status"]["active"] >= 1  # invitations parties
    assert view["upcoming_events"] >= 1
    assert view["guests"]["total"] == sum(view["rsvp"].values())
    assert view["invitations"]["total"] >= 1 and view["messages_failed"]["new"] >= 1
    assert view["series"][-1]["sent"] >= 1 and view["series"][-1]["failed"] >= 1
    assert view["provider"]["name"] == "console"
    kinds = {a["kind"] for a in view["activity"]}
    assert kinds >= {"organizer"}  # les plus récentes : celles de ce test
    details = [a["detail"] for a in view["activity"]]
    assert any("1 confirmation" in d for d in details)

    # Recherche par numéro (avec ou sans espaces), par nom.
    for q in (owner["phone"][-8:], "Test Organisateur"):
        page = client.get(
            "/v1/admin/users", params={"q": q}, headers=admin_headers
        ).json()
        assert owner["id"] in [u["id"] for u in page["items"]]
    detail = client.get(f"/v1/admin/users/{owner['id']}", headers=admin_headers).json()
    assert detail["events"] == 1 and detail["last_login_at"] is not None
    (event,) = detail["event_list"]
    assert event["id"] == event_id and event["confirmed"] == 1
    assert event["guests"] == event["pending"] + event["confirmed"] + event["declined"]
    assert event["cards"] > 0 and event["invitations_sent"] >= 1

    events = client.get(
        "/v1/admin/events",
        params={"status": "active", "period": "upcoming"},
        headers=admin_headers,
    ).json()
    assert event_id in [e["id"] for e in events["items"]]
    past = client.get(
        "/v1/admin/events", params={"period": "past"}, headers=admin_headers
    ).json()
    assert event_id not in [e["id"] for e in past["items"]]

    # Relances à la demande : option payante, activée pour ce compte seulement.
    reminders = f"/v1/events/{event_id}/whatsapp/reminders"
    assert client.post(reminders, headers=organizer).status_code == 403
    updated = client.patch(
        f"/v1/admin/users/{owner['id']}",
        json={"on_demand_reminders": True},
        headers=admin_headers,
    ).json()
    assert updated["on_demand_reminders"] is True
    whatsapp = client.get(f"/v1/events/{event_id}/whatsapp", headers=organizer)
    assert whatsapp.json()["on_demand_reminders"] is True
    # Plus de 403 : 409, car le seul invité joignable a déjà répondu.
    assert client.post(reminders, headers=organizer).status_code == 409


def test_platform_settings(client: TestClient, organizer: dict[str, str]) -> None:
    make_admin(client, organizer)
    url = "/v1/admin/settings"
    view = client.get(url, headers=organizer).json()
    assert view["values"] == view["defaults"] and view["overridden"] == []
    assert view["values"]["whatsapp_reminder_days_before"] == [7]
    assert [p["value"] for p in view["providers"] if not p["available"]] == [
        "diffuz",
        "meta",
    ]

    try:
        changed = client.patch(
            url,
            json={
                "whatsapp_reminder_days_before": [7, 14, 7],
                "whatsapp_batch_size": 10,
            },
            headers=organizer,
        ).json()
        assert changed["values"]["whatsapp_reminder_days_before"] == [14, 7]
        assert changed["defaults"]["whatsapp_reminder_days_before"] == [7]
        assert changed["overridden"] == [
            "whatsapp_batch_size",
            "whatsapp_reminder_days_before",
        ]
        # Pris en compte tout de suite, sans redéployer.
        assert get_settings().reminder_days_before == [14, 7]
        assert get_settings().whatsapp_batch_size == 10

        for body in (
            {"whatsapp_min_delay_seconds": 100, "whatsapp_max_delay_seconds": 50},
            {"whatsapp_send_start_hour": 20, "whatsapp_send_end_hour": 8},
            {"whatsapp_provider": "wasender"},  # pas de clé WasenderAPI
        ):
            refused = client.patch(url, json=body, headers=organizer)
            assert refused.status_code == 422 and refused.json()["detail"]["message"]
        assert (
            client.patch(
                url, json={"whatsapp_batch_size": 0}, headers=organizer
            ).status_code
            == 422
        )
        assert get_settings().whatsapp_batch_size == 10

        # null : retour à la valeur de l'environnement.
        back = client.patch(
            url, json={"whatsapp_batch_size": None}, headers=organizer
        ).json()
        assert back["overridden"] == ["whatsapp_reminder_days_before"]
        assert (
            get_settings().whatsapp_batch_size
            == back["defaults"]["whatsapp_batch_size"]
        )
    finally:
        client.patch(
            url,
            json={"whatsapp_reminder_days_before": None, "whatsapp_batch_size": None},
            headers=organizer,
        )
    assert get_settings().reminder_days_before == [7]
