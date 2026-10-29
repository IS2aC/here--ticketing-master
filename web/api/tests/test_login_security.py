"""Sécurité de la connexion : limite des tentatives, mot de passe oublié (code WhatsApp)."""

import re

import pytest
from fastapi.testclient import TestClient

from app.whatsapp import get_provider
from tests.test_guest_response import sql

pytestmark = pytest.mark.db


def account(client: TestClient, phone: str, email: str | None = None) -> dict:
    response = client.post(
        "/v1/auth/register",
        json={
            "first_name": "Awa",
            "last_name": "Koné",
            "phone": phone,
            "email": email,
            "password": "bon-mot-de-passe",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def login(client: TestClient, identifier: str, password: str):
    return client.post(
        "/v1/auth/login", json={"identifier": identifier, "password": password}
    )


def test_account_locked_after_five_failures(client: TestClient) -> None:
    account(client, "0711000001")
    for _ in range(5):
        assert login(client, "07 11 00 00 01", "mauvais").status_code == 401
    locked = login(client, "0711000001", "bon-mot-de-passe")
    assert locked.status_code == 429  # même le bon mot de passe attend
    assert locked.json()["detail"]["message"].startswith("Trop de tentatives.")
    assert locked.headers["Retry-After"]
    # 15 minutes plus tard : le compte est de nouveau ouvert.
    sql(
        "UPDATE login_attempts SET created_at = created_at - interval '16 minutes' "
        "WHERE identifier = '+2250711000001'"
    )
    assert login(client, "0711000001", "bon-mot-de-passe").status_code == 200


def test_success_resets_the_count(client: TestClient) -> None:
    account(client, "0711000002")
    for _ in range(4):
        login(client, "0711000002", "mauvais")
    assert login(client, "0711000002", "bon-mot-de-passe").status_code == 200
    for _ in range(4):
        assert login(client, "0711000002", "mauvais").status_code == 401


def test_ip_locked_after_twenty_failures() -> None:
    from app.main import app

    with TestClient(app, client=("203.0.113.7", 50000)) as same_ip:
        for i in range(20):  # vingt comptes différents depuis la même adresse
            assert login(same_ip, f"07120000{i:02d}", "mauvais").status_code == 401
        assert login(same_ip, "0712000099", "mauvais").status_code == 429
    with TestClient(app, client=("203.0.113.8", 50000)) as other_ip:
        assert login(other_ip, "0712000099", "mauvais").status_code == 401


def test_current_password_is_limited_too(
    client: TestClient, organizer: dict[str, str]
) -> None:
    url = "/v1/me/password"
    for _ in range(5):
        wrong = client.post(
            url,
            json={"current_password": "mauvais", "new_password": "nouveau-mdp"},
            headers=organizer,
        )
        assert wrong.status_code == 400
    blocked = client.post(
        url,
        json={"current_password": "mot-de-passe", "new_password": "nouveau-mdp"},
        headers=organizer,
    )
    assert blocked.status_code == 429


def sent_code() -> str:
    text = str(get_provider().sent[-1]["text"])
    return re.search(r"\b(\d{3}) (\d{3})\b", text).group(0)


def test_password_reset_by_whatsapp(client: TestClient) -> None:
    session = account(client, "0711000003", "awa@example.com")
    old = {"Authorization": f"Bearer {session['access_token']}"}

    # Même réponse, que le compte existe ou non.
    unknown = client.post("/v1/auth/password-reset", json={"identifier": "0711999999"})
    assert unknown.status_code == 202
    asked = client.post("/v1/auth/password-reset", json={"identifier": "0711000003"})
    assert asked.status_code == 202 and asked.json() == unknown.json()
    message = get_provider().sent[-1]
    assert message["to"] == "+2250711000003"
    assert "15 minutes" in str(message["text"])
    code = sent_code()
    assert (
        sql_count(
            "SELECT count(*) FROM otp_codes WHERE code_hash LIKE '%' || $1",
            code.replace(" ", ""),
        )
        == 0
    )  # jamais en clair

    url = "/v1/auth/password-reset/confirm"
    body = {"identifier": "awa@example.com", "password": "nouveau-mdp"}
    assert client.post(url, json={**body, "code": "000 000"}).status_code == 400
    done = client.post(url, json={**body, "code": code})
    assert done.status_code == 200 and done.json()["access_token"]
    # Le code ne sert qu'une fois, l'ancien mot de passe ne marche plus,
    # et les autres appareils sont déconnectés.
    assert client.post(url, json={**body, "code": code}).status_code == 400
    assert login(client, "0711000003", "bon-mot-de-passe").status_code == 401
    assert login(client, "0711000003", "nouveau-mdp").status_code == 200
    assert client.get("/v1/me", headers=old).status_code == 401


def test_reset_code_limits(client: TestClient) -> None:
    account(client, "0711000004")
    url = "/v1/auth/password-reset/confirm"
    client.post("/v1/auth/password-reset", json={"identifier": "0711000004"})
    code = sent_code()
    body = {"identifier": "0711000004", "password": "nouveau-mdp"}
    for _ in range(5):
        assert client.post(url, json={**body, "code": "111 111"}).status_code == 400
    # Cinq erreurs : même le bon code est refusé, il faut en demander un nouveau.
    assert client.post(url, json={**body, "code": code}).status_code == 400

    # Trois codes par heure au plus : le quatrième n'est pas envoyé.
    sent = len(get_provider().sent)
    for _ in range(3):
        client.post("/v1/auth/password-reset", json={"identifier": "0711000004"})
    assert len(get_provider().sent) == sent + 2  # 1 déjà envoyé + 2

    # Code expiré.
    sql("UPDATE otp_codes SET expires_at = now() - interval '1 minute'")
    assert client.post(url, json={**body, "code": sent_code()}).status_code == 400


def sql_count(query: str, *args: object) -> int:
    import asyncio

    import asyncpg

    from tests.conftest import TEST_DATABASE_URL

    async def run() -> int:
        conn = await asyncpg.connect(TEST_DATABASE_URL)
        try:
            return await conn.fetchval(query, *args)
        finally:
            await conn.close()

    return asyncio.run(run())
