import time

import pytest
from fastapi.testclient import TestClient

from app import google
from app.config import get_settings

NONCE = "n" * 32
BODY = {
    "code": "code-de-google",
    "code_verifier": "v" * 43,
    "nonce": NONCE,
    "redirect_uri": "http://localhost:3000/api/auth/callback/google",
}


@pytest.fixture
def client_id(monkeypatch: pytest.MonkeyPatch) -> str:
    settings = get_settings()
    monkeypatch.setattr(settings, "google_client_id", "here.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "google_client_secret", "secret")
    return settings.google_client_id


def claims(**overrides) -> dict:
    return {
        "iss": "https://accounts.google.com",
        "aud": "here.apps.googleusercontent.com",
        "exp": time.time() + 300,
        "nonce": NONCE,
        "sub": "1234567890",
        "email": "Awa.Kone@gmail.com",
        "email_verified": True,
        "given_name": "Awa",
        "family_name": "Koné",
        **overrides,
    }


def test_identity(client_id: str) -> None:
    who = google.identity(claims(), NONCE)
    assert (who.sub, who.email, who.first_name, who.last_name) == (
        "1234567890",
        "awa.kone@gmail.com",
        "Awa",
        "Koné",
    )
    # Adresse non confirmée par Google : pas utilisée (ni gardée, ni pour relier un compte).
    assert google.identity(claims(email_verified=False), NONCE).email is None
    # Sans prénom ni nom : le nom affiché, sinon le début de l'adresse.
    who = google.identity(
        claims(given_name=None, family_name=None, name="Awa K."), NONCE
    )
    assert (who.first_name, who.last_name) == ("Awa K.", "")


@pytest.mark.parametrize(
    "bad",
    [
        {"iss": "https://evil.example.com"},
        {"aud": "autre-application"},
        {"exp": time.time() - 1},
        {"nonce": "un-autre-nonce-de-32-caracteres!"},
        {"sub": ""},
    ],
)
def test_identity_refused(client_id: str, bad: dict) -> None:
    with pytest.raises(google.GoogleError):
        google.identity(claims(**bad), NONCE)


@pytest.mark.db
def test_google_login_creates_then_finds_account(
    client: TestClient, client_id: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    current = {"claims": claims(sub="google-awa", email="awa@example.com")}

    async def exchange(code, code_verifier, redirect_uri, nonce):
        return google.identity(current["claims"], nonce)

    monkeypatch.setattr(google, "exchange", exchange)

    first = client.post("/v1/auth/google", json=BODY)
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["created"] is True
    assert body["user"] | {"id": None} == body["user"] | {
        "id": None,
        "phone": None,
        "email": "awa@example.com",
        "has_password": False,
        "google": True,
    }
    token = {"Authorization": f"Bearer {body['access_token']}"}

    # Numéro facultatif : ajouté plus tard depuis le profil.
    added = client.patch("/v1/me", json={"phone": "07 00 00 09 01"}, headers=token)
    assert added.json()["phone"] == "+2250700000901"
    # Pas de mot de passe à changer, ni à retrouver.
    refused = client.post(
        "/v1/me/password",
        json={"current_password": "x", "new_password": "un-mot-de-passe"},
        headers=token,
    )
    assert refused.status_code == 400

    again = client.post("/v1/auth/google", json=BODY).json()
    assert again["created"] is False and again["user"]["id"] == body["user"]["id"]


@pytest.mark.db
def test_google_login_links_existing_account_by_verified_email(
    client: TestClient, client_id: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    account = client.post(
        "/v1/auth/register",
        json={
            "first_name": "Koffi",
            "last_name": "Yao",
            "phone": "07 00 00 09 02",
            "email": "koffi@example.com",
            "password": "un-mot-de-passe",
        },
    ).json()["user"]
    current = {
        "claims": claims(
            sub="google-koffi", email="KOFFI@example.com", email_verified=False
        )
    }

    async def exchange(code, code_verifier, redirect_uri, nonce):
        return google.identity(current["claims"], nonce)

    monkeypatch.setattr(google, "exchange", exchange)

    # Adresse non confirmée par Google : pas de rattachement ; un compte Google à part est créé.
    other = client.post("/v1/auth/google", json=BODY).json()
    assert other["created"] is True and other["user"]["id"] != account["id"]

    current["claims"] = claims(sub="google-koffi-2", email="KOFFI@example.com")
    linked = client.post("/v1/auth/google", json=BODY).json()
    assert linked["created"] is False and linked["user"]["id"] == account["id"]
    assert linked["user"]["google"] is True and linked["user"]["has_password"] is True


@pytest.mark.db
def test_google_login_refused(
    client: TestClient, client_id: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def exchange(code, code_verifier, redirect_uri, nonce):
        raise google.GoogleError("Code refusé par Google (400).")

    monkeypatch.setattr(google, "exchange", exchange)
    assert client.post("/v1/auth/google", json=BODY).status_code == 401
