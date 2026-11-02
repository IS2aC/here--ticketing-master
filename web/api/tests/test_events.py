from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.db

IN_A_MONTH = (datetime.now(UTC) + timedelta(days=30)).replace(microsecond=0)

MARIAGE = {
    "title": "Mariage Aya & Koffi",
    "type": "mariage",
    "starts_at": IN_A_MONTH.isoformat(),
    "duration_minutes": 480,
    "location_name": "Église Saint-Jacques",
    "location_address": "Cocody, Abidjan",
    "expected_guests": 320,
    "dress_code": "Tenue traditionnelle",
    "description": "  ",
    "categories": ["VIP", "Famille", "famille", "Amis"],
}


def test_create_list_get(client: TestClient, organizer: dict[str, str]) -> None:
    created = client.post("/v1/events", json=MARIAGE, headers=organizer)
    assert created.status_code == 201, created.text
    event = created.json()
    assert event["status"] == "draft"
    assert event["description"] is None
    assert [c["name"] for c in event["categories"]] == ["Amis", "Famille", "VIP"]
    assert event["stats"] == {
        "arrived": 0,
        "guests": 0,
        "confirmed": 0,
        "declined": 0,
        "pending": 0,
    }

    listed = client.get("/v1/events", headers=organizer).json()
    assert [e["id"] for e in listed] == [event["id"]]
    assert (
        client.get(f"/v1/events/{event['id']}", headers=organizer).json()["title"]
        == MARIAGE["title"]
    )


def test_default_categories(client: TestClient, organizer: dict[str, str]) -> None:
    body = {"title": "Brunch", "type": "brunch", "starts_at": IN_A_MONTH.isoformat()}
    event = client.post("/v1/events", json=body, headers=organizer).json()
    assert sorted(c["name"] for c in event["categories"]) == ["Normal", "VIP"]
    autre = client.post("/v1/events", json={**body, "type": "autre"}, headers=organizer)
    assert autre.status_code == 201, autre.text


def test_theme_colors_dress_code(client: TestClient, organizer: dict[str, str]) -> None:
    body = {"title": "Brunch", "type": "brunch", "starts_at": IN_A_MONTH.isoformat()}
    event = client.post("/v1/events", json=body, headers=organizer).json()
    # Sans dress code : « Dress code Libre » ; ni thème ni couleurs.
    assert (event["dress_code"], event["theme"], event["colors"]) == (
        "Dress code Libre",
        None,
        [],
    )

    themed = {
        **body,
        "theme": " Nuit à Marrakech ",
        "colors": ["#c9a24a", "#0B0B0B", "#C9A24A"],
        "dress_code": "",
    }
    event = client.post("/v1/events", json=themed, headers=organizer).json()
    assert event["theme"] == "Nuit à Marrakech"
    assert event["colors"] == ["#C9A24A", "#0B0B0B"]  # majuscules, sans doublon
    assert event["dress_code"] == "Dress code Libre"

    path = f"/v1/events/{event['id']}"
    changed = client.patch(
        path, json={"dress_code": "Blanc et or", "colors": []}, headers=organizer
    ).json()
    assert (changed["dress_code"], changed["colors"], changed["theme"]) == (
        "Blanc et or",
        [],
        "Nuit à Marrakech",
    )
    cleared = client.patch(
        path, json={"dress_code": None, "theme": None}, headers=organizer
    ).json()
    assert (cleared["dress_code"], cleared["theme"]) == ("Dress code Libre", None)

    too_many = {**body, "colors": ["#111111", "#222222", "#333333", "#444444"]}
    assert (
        client.post("/v1/events", json=too_many, headers=organizer).status_code == 422
    )
    assert (
        client.post(
            "/v1/events", json={**body, "colors": ["rouge"]}, headers=organizer
        ).status_code
        == 422
    )


def test_validation(client: TestClient, organizer: dict[str, str]) -> None:
    past = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    assert (
        client.post(
            "/v1/events", json={**MARIAGE, "starts_at": past}, headers=organizer
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/v1/events", json={**MARIAGE, "type": "inconnu"}, headers=organizer
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/v1/events", json={**MARIAGE, "title": " "}, headers=organizer
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/v1/events", json={**MARIAGE, "categories": []}, headers=organizer
        ).status_code
        == 422
    )
    naive = IN_A_MONTH.replace(tzinfo=None).isoformat()
    assert (
        client.post(
            "/v1/events", json={**MARIAGE, "starts_at": naive}, headers=organizer
        ).status_code
        == 422
    )


def test_events_are_private(client: TestClient, organizer: dict[str, str]) -> None:
    event = client.post("/v1/events", json=MARIAGE, headers=organizer).json()
    other = client.post(
        "/v1/auth/register",
        json={
            "first_name": "A",
            "last_name": "B",
            "phone": "0711111111",
            "password": "mot-de-passe",
        },
    ).json()
    headers = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get(f"/v1/events/{event['id']}", headers=headers).status_code == 404
    assert (
        client.patch(
            f"/v1/events/{event['id']}", json={"title": "Piraté"}, headers=headers
        ).status_code
        == 404
    )
    assert client.get("/v1/events", headers=headers).json() == []
    assert client.get("/v1/events").status_code == 401


def test_update(client: TestClient, organizer: dict[str, str]) -> None:
    event = client.post("/v1/events", json=MARIAGE, headers=organizer).json()
    url = f"/v1/events/{event['id']}"
    vip_id = next(c["id"] for c in event["categories"] if c["name"] == "VIP")

    updated = client.patch(
        url,
        json={
            "title": "Mariage civil",
            "dress_code": None,
            "categories": ["vip", "Collègues"],
        },
        headers=organizer,
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["title"] == "Mariage civil"
    assert body["dress_code"] == "Dress code Libre"  # effacé : valeur par défaut
    assert body["location_name"] == MARIAGE["location_name"]  # inchangé
    names = {c["name"]: c["id"] for c in body["categories"]}
    assert names == {
        "Collègues": names["Collègues"],
        "vip": vip_id,
    }  # VIP conservée (même id), renommée


def test_cannot_remove_category_with_guests(
    client: TestClient, organizer: dict[str, str]
) -> None:
    import asyncio

    import asyncpg

    from tests.conftest import TEST_DATABASE_URL

    event = client.post("/v1/events", json=MARIAGE, headers=organizer).json()
    vip = next(c for c in event["categories"] if c["name"] == "VIP")

    async def add_guest() -> None:
        conn = await asyncpg.connect(TEST_DATABASE_URL)
        await conn.execute(
            "INSERT INTO guests (event_id, category_id, display_name, phone, rsvp_status) "
            "VALUES ($1, $2, 'M. Konan', '+2250700000999', 'confirmed')",
            event["id"],
            vip["id"],
        )
        await conn.close()

    asyncio.run(add_guest())
    stats = client.get(f"/v1/events/{event['id']}", headers=organizer).json()
    assert stats["stats"] == {
        "arrived": 0,
        "guests": 1,
        "confirmed": 1,
        "declined": 0,
        "pending": 0,
    }
    assert next(c for c in stats["categories"] if c["name"] == "VIP")["guests"] == 1

    response = client.patch(
        f"/v1/events/{event['id']}", json={"categories": ["Amis"]}, headers=organizer
    )
    assert response.status_code == 409
    assert "VIP" in response.json()["detail"]["message"]


def test_summary_by_month(client: TestClient, organizer: dict[str, str]) -> None:
    from tests.test_guest_response import invited, sql

    event_id, guests = invited(client, organizer)
    # Un événement créé le mois dernier : compté dans l'avant-dernier mois.
    sql(
        "UPDATE events SET created_at = date_trunc('month', now()) - interval '1 day' "
        f"WHERE id = '{event_id}'"
    )
    client.post(
        "/v1/events",
        json={
            "title": "Dot",
            "type": "dot",
            "starts_at": (datetime.now(UTC) + timedelta(days=40)).isoformat(),
        },
        headers=organizer,
    )
    months = client.get("/v1/events/summary", headers=organizer).json()["months"]
    assert len(months) == 6
    assert months[-1]["month"] == datetime.now(UTC).date().replace(day=1).isoformat()
    assert [m["events"] for m in months[-2:]] == [1, 1]
    assert months[-1]["guests"] == len(guests)  # invités ajoutés ce mois-ci
    # Les événements des autres organisateurs ne sont pas comptés.
    other = client.post(
        "/v1/auth/register",
        json={
            "first_name": "Autre",
            "last_name": "Compte",
            "phone": "0799999902",
            "password": "mot-de-passe",
        },
    ).json()["access_token"]
    empty = client.get(
        "/v1/events/summary", headers={"Authorization": f"Bearer {other}"}
    ).json()["months"]
    assert all(m["events"] == 0 and m["guests"] == 0 for m in empty)
