from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from tests.test_guest_import import xlsx

pytestmark = pytest.mark.db

FILE = xlsx(
    [
        ["Nom", "Prénoms", "Numéro", "Catégorie", "Position"],
        ["Konan", "Jean", "07 07 12 34 56", "VIP", "Table 1"],
        ["Bamba", "Fatou", None, None, None],
        ["Assi", "Paul", "07 07 12 3", "vip", "Table 2"],
        ["Diallo", "Moussa", "0101010101", "Famille", None],
        ["Konan", "Jeanne", "+225 07 07 12 34 56", "VIP", None],
    ]
)
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def new_event(
    client: TestClient, headers: dict[str, str], categories: list[str]
) -> str:
    starts = (datetime.now(UTC) + timedelta(days=30)).isoformat()
    body = {
        "title": "Mariage",
        "type": "mariage",
        "starts_at": starts,
        "categories": categories,
    }
    return client.post("/v1/events", json=body, headers=headers).json()["id"]


def upload(
    client: TestClient,
    headers: dict[str, str],
    event_id: str,
    content: bytes,
    name: str = "invites.xlsx",
):
    return client.post(
        f"/v1/events/{event_id}/imports",
        files={"file": (name, content, XLSX)},
        headers=headers,
    )


def test_preview_then_confirm(client: TestClient, organizer: dict[str, str]) -> None:
    event_id = new_event(client, organizer, ["VIP"])
    preview = upload(client, organizer, event_id, FILE)
    assert preview.status_code == 201, preview.text
    body = preview.json()
    assert body["status"] == "pending"
    assert [c["label"] for c in body["columns"]] == [
        "Nom",
        "Prénoms",
        "Numéro",
        "Catégorie",
        "Position",
    ]
    assert body["summary"] == {
        "total": 5,
        "to_import": 3,
        "to_verify": 2,
        "not_imported": 1,
        "duplicates": 1,
        "by_category": {"VIP": 2, "Normal": 1},
    }
    assert body["rows"][-1]["status"] == "ready"  # lignes à corriger d'abord
    # Rien n'est encore dans la liste.
    assert client.get(f"/v1/events/{event_id}/guests", headers=organizer).json() == []

    again = client.get(f"/v1/events/{event_id}/imports/{body['id']}", headers=organizer)
    assert again.json()["summary"] == body["summary"]

    confirmed = client.post(
        f"/v1/events/{event_id}/imports/{body['id']}/confirm", headers=organizer
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "done"
    assert confirmed.json()["imported_rows"] == 3

    guests = client.get(f"/v1/events/{event_id}/guests", headers=organizer).json()
    assert {
        (g["display_name"], g["category"], g["seat"], g["phone_valid"]) for g in guests
    } == {
        ("Jean Konan", "VIP", "Table 1", True),
        ("Fatou Bamba", "Normal", None, False),
        ("Paul Assi", "VIP", "Table 2", False),
    }
    event = client.get(f"/v1/events/{event_id}", headers=organizer).json()
    assert event["stats"]["guests"] == 3
    assert sorted(c["name"] for c in event["categories"]) == [
        "Normal",
        "VIP",
    ]  # « Normal » créée

    assert (
        client.post(
            f"/v1/events/{event_id}/imports/{body['id']}/confirm", headers=organizer
        ).status_code
        == 409
    )

    # Un second import du même fichier ne crée pas de doublons, y compris pour les invités sans numéro.
    second = upload(client, organizer, event_id, FILE).json()
    assert second["summary"]["duplicates"] == 4
    assert second["summary"]["to_import"] == 0


def test_upload_errors_and_privacy(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id = new_event(client, organizer, ["VIP"])
    bad = upload(client, organizer, event_id, b"Bonjour", "liste.pdf")
    assert bad.status_code == 422
    assert "Excel" in bad.json()["detail"]["message"]

    other = client.post(
        "/v1/auth/register",
        json={
            "first_name": "A",
            "last_name": "B",
            "phone": "0712121212",
            "password": "mot-de-passe",
        },
    ).json()
    headers = {"Authorization": f"Bearer {other['access_token']}"}
    assert upload(client, headers, event_id, FILE).status_code == 404
    assert (
        client.get(f"/v1/events/{event_id}/guests", headers=headers).status_code == 404
    )
    preview = upload(client, organizer, event_id, FILE).json()
    assert (
        client.get(
            f"/v1/events/{event_id}/imports/{preview['id']}", headers=headers
        ).status_code
        == 404
    )


def test_template(client: TestClient) -> None:
    response = client.get("/v1/guests/import-template")
    assert response.status_code == 200
    assert response.headers["content-type"] == XLSX


def test_generate_invitations_and_public_card(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id = new_event(client, organizer, ["VIP"])
    url = f"/v1/events/{event_id}/invitations"
    assert client.post(url, headers=organizer).status_code == 409  # aucun invité

    preview = upload(client, organizer, event_id, FILE).json()
    client.post(
        f"/v1/events/{event_id}/imports/{preview['id']}/confirm", headers=organizer
    )
    first = client.post(url, headers=organizer)
    assert first.status_code == 200, first.text
    assert first.json() == {"total": 3, "created": 3, "without_phone": 2}
    assert client.post(url, headers=organizer).json()["created"] == 0  # pas de doublon

    guests = client.get(f"/v1/events/{event_id}/guests", headers=organizer).json()
    jean = next(g for g in guests if g["display_name"] == "Jean Konan")
    card = client.get(
        f"/v1/invitations/{jean['invitation_token']}"
    )  # public : sans en-tête
    assert card.status_code == 200, card.text
    body = card.json()
    assert body["guest_name"] == "Jean Konan"
    assert body["category"] == "VIP"
    assert body["seat"] == "Table 1"
    assert body["event_type"] == "mariage"
    assert body["code"].startswith("INV-")
    assert "phone" not in body
    assert client.get("/v1/invitations/jeton-inconnu").status_code == 404

    other = client.post(
        "/v1/auth/register",
        json={
            "first_name": "A",
            "last_name": "B",
            "phone": "0713131313",
            "password": "mot-de-passe",
        },
    ).json()
    assert (
        client.post(
            url, headers={"Authorization": f"Bearer {other['access_token']}"}
        ).status_code
        == 404
    )
