"""Invités à la main : ajouter, modifier, retirer ; corriger ou retirer une ligne de l'aperçu d'import."""

import pytest
from fastapi.testclient import TestClient

from tests.test_guest_response import invited
from tests.test_imports import FILE, new_event, upload

pytestmark = pytest.mark.db


def categories(client: TestClient, headers: dict[str, str], event_id: str) -> dict:
    event = client.get(f"/v1/events/{event_id}", headers=headers).json()
    return {c["name"]: c["id"] for c in event["categories"]}


def test_add_update_delete_guest(client: TestClient, organizer: dict[str, str]) -> None:
    event_id = new_event(client, organizer, ["VIP", "Famille"])
    cats = categories(client, organizer, event_id)
    url = f"/v1/events/{event_id}/guests"

    added = client.post(
        url,
        json={
            "last_name": "Koné",
            "first_names": "Awa",
            "phone": "07 07 55 44 33",
            "category_id": cats["VIP"],
            "seat": "Table 2",
        },
        headers=organizer,
    )
    assert added.status_code == 201, added.text
    awa = added.json()
    assert awa["display_name"] == "Awa Koné"
    assert awa["phone"] == "+2250707554433" and awa["phone_valid"] is True
    assert awa["category"] == "VIP" and awa["seat"] == "Table 2"
    assert awa["invitation_token"] is None  # cartes pas encore préparées

    # Refus : sans nom, numéro invalide, catégorie d'un autre événement, doublon.
    base = {"category_id": cats["Famille"]}
    for body, field, code in (
        ({**base, "phone": "0707000001"}, "last_name", 400),
        ({**base, "last_name": "Diallo", "phone": "07 07 1"}, "phone", 400),
        ({"last_name": "Diallo", "category_id": event_id}, "category_id", 400),
        ({**base, "last_name": "Autre", "phone": "+225 07 07 55 44 33"}, "phone", 409),
    ):
        refused = client.post(url, json=body, headers=organizer)
        assert refused.status_code == code, refused.text
        assert refused.json()["detail"]["field"] == field
    # Sans numéro : accepté, à compléter avant l'envoi.
    moussa = client.post(
        url,
        json={**base, "last_name": "Diallo", "first_names": "Moussa"},
        headers=organizer,
    ).json()
    assert moussa["phone"] is None and moussa["phone_valid"] is False
    # Deux invités sans numéro et du même nom : doublon.
    twice = client.post(
        url,
        json={**base, "last_name": "diallo", "first_names": "moussa"},
        headers=organizer,
    )
    assert twice.status_code == 409
    assert twice.json()["detail"] == {
        "field": "last_name",
        "message": "Déjà dans la liste : Moussa Diallo.",
    }

    # Modifier : numéro ajouté, catégorie changée ; son propre numéro n'est pas un doublon.
    guest_url = f"/v1/guests/{moussa['id']}"
    updated = client.patch(
        guest_url,
        json={
            "last_name": "Diallo",
            "first_names": "Moussa",
            "phone": "0101010101",
            "category_id": cats["VIP"],
        },
        headers=organizer,
    ).json()
    assert updated["phone"] == "+2250101010101" and updated["category"] == "VIP"
    assert (
        client.patch(
            guest_url, json={**updated, "category_id": cats["VIP"]}, headers=organizer
        ).status_code
        == 200
    )
    taken = client.patch(
        guest_url,
        json={"last_name": "Diallo", "phone": "0707554433", "category_id": cats["VIP"]},
        headers=organizer,
    )
    assert taken.status_code == 409

    # Un autre organisateur ne voit pas cet invité.
    other = client.post(
        "/v1/auth/register",
        json={
            "first_name": "Autre",
            "last_name": "Compte",
            "phone": "0799999903",
            "password": "mot-de-passe",
        },
    ).json()["access_token"]
    stranger = {"Authorization": f"Bearer {other}"}
    assert client.get(guest_url, headers=stranger).status_code == 404
    assert client.delete(guest_url, headers=stranger).status_code == 404

    # Retirer.
    assert client.delete(guest_url, headers=organizer).status_code == 204
    names = [g["display_name"] for g in client.get(url, headers=organizer).json()]
    assert names == ["Awa Koné"]


def test_added_guest_gets_a_card_when_cards_are_ready(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id, _ = invited(client, organizer)  # cartes déjà préparées
    cats = categories(client, organizer, event_id)
    added = client.post(
        f"/v1/events/{event_id}/guests",
        json={"last_name": "Yao", "phone": "0505050505", "category_id": cats["VIP"]},
        headers=organizer,
    ).json()
    assert added["invitation_token"]
    card = client.get(f"/v1/invitations/{added['invitation_token']}").json()
    assert card["guest_name"] == "Yao"


def test_fix_and_drop_import_rows(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id = new_event(client, organizer, ["VIP"])
    preview = upload(client, organizer, event_id, FILE).json()
    by_name = {r["display_name"]: r for r in preview["rows"]}
    assert by_name["Paul Assi"]["status"] == "phone_invalid"
    assert by_name["Paul Assi"]["last_name"] == "Assi"
    assert by_name["Moussa Diallo"]["status"] == "category_unknown"
    assert by_name["Jeanne Konan"]["status"] == "duplicate"
    rows_url = f"/v1/events/{event_id}/imports/{preview['id']}/rows"

    # Corriger : numéro de Paul, catégorie de Moussa.
    fixed = client.patch(
        f"{rows_url}/{by_name['Paul Assi']['line']}",
        json={
            "last_name": "Assi",
            "first_names": "Paul",
            "phone": "07 07 12 34 99",
            "category": "VIP",
            "seat": "Table 2",
        },
        headers=organizer,
    ).json()
    fixed = client.patch(
        f"{rows_url}/{by_name['Moussa Diallo']['line']}",
        json={
            "last_name": "Diallo",
            "first_names": "Moussa",
            "phone": "0101010101",
            "category": "vip",
        },
        headers=organizer,
    ).json()
    statuses = {r["display_name"]: r["status"] for r in fixed["rows"]}
    assert statuses["Paul Assi"] == "ready" and statuses["Moussa Diallo"] == "ready"

    # Retirer la ligne en double.
    dropped = client.delete(
        f"{rows_url}/{by_name['Jeanne Konan']['line']}", headers=organizer
    ).json()
    assert "Jeanne Konan" not in [r["display_name"] for r in dropped["rows"]]
    assert dropped["summary"]["total"] == 4 and dropped["summary"]["duplicates"] == 0
    assert client.delete(f"{rows_url}/999", headers=organizer).status_code == 404

    done = client.post(
        f"/v1/events/{event_id}/imports/{preview['id']}/confirm", headers=organizer
    ).json()
    assert done["imported_rows"] == 4
    guests = client.get(f"/v1/events/{event_id}/guests", headers=organizer).json()
    paul = next(g for g in guests if g["display_name"] == "Paul Assi")
    assert paul["phone"] == "+2250707123499" and paul["phone_valid"] is True
    # Import terminé : plus de correction possible.
    assert client.delete(f"{rows_url}/1", headers=organizer).status_code == 409


def test_number_of_people(client: TestClient, organizer: dict[str, str]) -> None:
    from tests.test_guest_import import xlsx

    # Import : colonne « Nb pers. » ; vide ou illisible : 1, au plus 20.
    event_id = new_event(client, organizer, ["VIP"])
    content = xlsx(
        [
            ["Nom", "Prénoms", "Numéro", "Nb pers."],
            ["Konan", "Jean", "0707123456", 3],
            ["Bamba", "Fatou", "0544818107", None],
            ["Assi", "Paul", "0101010101", "beaucoup"],
            ["Yao", "Famille", "0505050505", 50],
        ]
    )
    preview = upload(client, organizer, event_id, content).json()
    assert "Nb pers." in [c["label"] for c in preview["columns"]]
    assert {r["display_name"]: r["seats"] for r in preview["rows"]} == {
        "Jean Konan": 3,
        "Fatou Bamba": 1,
        "Paul Assi": 1,
        "Famille Yao": 20,
    }
    client.post(
        f"/v1/events/{event_id}/imports/{preview['id']}/confirm", headers=organizer
    )
    guests = client.get(f"/v1/events/{event_id}/guests", headers=organizer).json()
    jean = next(g for g in guests if g["display_name"] == "Jean Konan")
    assert jean["seats"] == 3

    # À la main : 1 par défaut, 1 à 20.
    cats = categories(client, organizer, event_id)
    url = f"/v1/events/{event_id}/guests"
    alone = client.post(
        url, json={"last_name": "Koné", "category_id": cats["VIP"]}, headers=organizer
    ).json()
    assert alone["seats"] == 1
    assert (
        client.post(
            url,
            json={"last_name": "Trop", "category_id": cats["VIP"], "seats": 21},
            headers=organizer,
        ).status_code
        == 422
    )

    # Jean confirme pour 3, puis l'organisateur réduit à 2 places : la réponse suit.
    client.post(f"/v1/events/{event_id}/invitations", headers=organizer)
    token = client.get(f"/v1/guests/{jean['id']}", headers=organizer).json()[
        "invitation_token"
    ]
    client.post(
        f"/v1/invitations/{token}/response", json={"attending": True, "seats": 3}
    )
    reduced = client.patch(
        f"/v1/guests/{jean['id']}",
        json={
            "last_name": "Konan",
            "first_names": "Jean",
            "phone": "0707123456",
            "category_id": cats["VIP"],
            "seats": 2,
        },
        headers=organizer,
    ).json()
    assert reduced["seats"] == 2 and reduced["attending_seats"] == 2
