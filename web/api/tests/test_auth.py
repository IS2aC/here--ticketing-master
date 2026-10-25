import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.db

AYA = {
    "first_name": "Aya",
    "last_name": "Koffi",
    "phone": "07 00 00 00 01",
    "email": "Aya@example.com",
    "password": "un-mot-de-passe",
}


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_register_login_me_logout(client: TestClient) -> None:
    created = client.post("/v1/auth/register", json=AYA)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["user"]["phone"] == "+2250700000001"
    assert body["user"]["email"] == "aya@example.com"
    assert body["user"]["role"] == "organizer"
    assert "password_hash" not in body["user"]

    me = client.get("/v1/me", headers=bearer(body["access_token"]))
    assert me.status_code == 200
    assert me.json()["first_name"] == "Aya"

    for identifier in ("+225 07 00 00 00 01", "AYA@example.com"):
        login = client.post(
            "/v1/auth/login",
            json={"identifier": identifier, "password": AYA["password"]},
        )
        assert login.status_code == 200, identifier

    token = login.json()["access_token"]
    assert client.post("/v1/auth/logout", headers=bearer(token)).status_code == 204
    assert client.get("/v1/me", headers=bearer(token)).status_code == 401
    # Les autres sessions restent valides.
    assert client.get("/v1/me", headers=bearer(body["access_token"])).status_code == 200


def test_register_conflicts(client: TestClient) -> None:
    payload = {**AYA, "phone": "0700000002", "email": "autre@example.com"}
    assert client.post("/v1/auth/register", json=payload).status_code == 201

    same_phone = client.post("/v1/auth/register", json={**payload, "email": None})
    assert same_phone.status_code == 409
    assert same_phone.json()["detail"]["field"] == "phone"

    same_email = client.post(
        "/v1/auth/register",
        json={**payload, "phone": "0700000003", "email": "AUTRE@example.com"},
    )
    assert same_email.status_code == 409
    assert same_email.json()["detail"]["field"] == "email"


def test_register_validation(client: TestClient) -> None:
    assert (
        client.post("/v1/auth/register", json={**AYA, "phone": "123"}).status_code
        == 422
    )
    assert (
        client.post("/v1/auth/register", json={**AYA, "password": "court"}).status_code
        == 422
    )
    assert (
        client.post(
            "/v1/auth/register", json={**AYA, "email": "pas-un-email"}
        ).status_code
        == 422
    )


def test_login_wrong_password(client: TestClient) -> None:
    client.post("/v1/auth/register", json={**AYA, "phone": "0700000004", "email": None})
    wrong = client.post(
        "/v1/auth/login", json={"identifier": "0700000004", "password": "mauvais"}
    )
    assert wrong.status_code == 401
    unknown = client.post(
        "/v1/auth/login", json={"identifier": "0799999999", "password": "mauvais"}
    )
    assert unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_me_requires_token(client: TestClient) -> None:
    assert client.get("/v1/me").status_code == 401
    assert client.get("/v1/me", headers=bearer("jeton-inconnu")).status_code == 401
