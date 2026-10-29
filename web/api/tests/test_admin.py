"""Portail admin : accès réservé, suivi des comptes et des événements, réglages sans redéploiement."""

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.admin import set_role
from app.config import get_settings
from app.models import UserRole
from tests.test_guest_response import invited, sql

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
    for path in ("overview", "users", "events", "settings"):
        refused = client.get(f"/v1/admin/{path}", headers=organizer)
        assert refused.status_code == 403
        assert refused.json()["detail"]["message"]
    assert client.get("/v1/admin/overview").status_code == 401


def test_follow_users_and_events(client: TestClient, organizer: dict[str, str]) -> None:
    event_id, _ = invited(client, organizer)
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

    view = client.get("/v1/admin/overview", headers=admin_headers).json()
    assert view["organizers"] >= 1 and view["events"]["draft"] >= 1
    assert view["guests"] == sum(view["rsvp"].values())
    assert view["provider"] == "console"

    # Recherche par numéro (avec ou sans espaces), par nom.
    for q in (owner["phone"][-8:], "Test Organisateur"):
        page = client.get(
            "/v1/admin/users", params={"q": q}, headers=admin_headers
        ).json()
        assert owner["id"] in [u["id"] for u in page["items"]]
    detail = client.get(f"/v1/admin/users/{owner['id']}", headers=admin_headers).json()
    assert detail["events"] == 1 and detail["last_login_at"] is not None
    (event,) = detail["event_list"]
    assert event["id"] == event_id and event["guests"] == event["pending"] > 0
    assert event["cards"] > 0 and event["invitations_sent"] == 0

    events = client.get(
        "/v1/admin/events",
        params={"status": "draft", "period": "upcoming"},
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
    # Plus de 403 : 409, car personne n'a encore reçu son invitation.
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
