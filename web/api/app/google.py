"""Connexion avec Google (OpenID Connect, flux « authorization code » avec PKCE).

Le frontend envoie l'organisateur chez Google puis transmet le code reçu. L'API l'échange elle-même contre
un ID token, directement auprès de Google en HTTPS : comme le jeton ne transite pas par le navigateur,
la connexion TLS suffit à garantir son émetteur (OpenID Connect Core, 3.1.3.7). Restent à vérifier
l'audience, l'émetteur, l'expiration, le nonce et l'adresse e-mail confirmée.
"""

import base64
import json
import secrets
import time
from dataclasses import dataclass

import httpx

from app.config import get_settings

TOKEN_URL = "https://oauth2.googleapis.com/token"
ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


class GoogleError(Exception):
    """Connexion refusée : code invalide ou expiré, jeton non conforme, Google injoignable."""


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str
    email: str | None  # seulement si Google l'a confirmée
    first_name: str
    last_name: str


def configured() -> bool:
    settings = get_settings()
    return bool(settings.google_client_id and settings.google_client_secret)


def _claims(id_token: str) -> dict:
    try:
        payload = id_token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (IndexError, ValueError) as exc:
        raise GoogleError("ID token illisible.") from exc


def identity(claims: dict, nonce: str, now: float | None = None) -> GoogleIdentity:
    """Vérifie les claims de l'ID token et en tire l'identité de l'organisateur."""
    settings = get_settings()
    now = time.time() if now is None else now
    if claims.get("iss") not in ISSUERS:
        raise GoogleError("Émetteur inattendu.")
    if claims.get("aud") != settings.google_client_id:
        raise GoogleError("Jeton destiné à une autre application.")
    if not isinstance(claims.get("exp"), int | float) or claims["exp"] < now:
        raise GoogleError("Jeton expiré.")
    if not nonce or not secrets.compare_digest(str(claims.get("nonce", "")), nonce):
        raise GoogleError("Nonce différent : la demande ne vient pas de ce navigateur.")
    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub:
        raise GoogleError("Compte Google sans identifiant.")

    email = claims.get("email") if claims.get("email_verified") is True else None
    first = str(claims.get("given_name") or "").strip()
    last = str(claims.get("family_name") or "").strip()
    if not first and not last:
        first = str(claims.get("name") or "").strip() or (email or "").split("@")[0]
    return GoogleIdentity(
        sub=sub,
        email=email.lower() if isinstance(email, str) else None,
        first_name=first[:80] or "Organisateur",
        last_name=last[:80],
    )


async def exchange(
    code: str, code_verifier: str, redirect_uri: str, nonce: str
) -> GoogleIdentity:
    """Échange le code contre un ID token auprès de Google et renvoie l'identité vérifiée."""
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "code_verifier": code_verifier,
                    "redirect_uri": redirect_uri,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                },
            )
    except httpx.HTTPError as exc:
        raise GoogleError("Google injoignable.") from exc
    if response.status_code != 200:
        raise GoogleError(f"Code refusé par Google ({response.status_code}).")
    id_token = response.json().get("id_token")
    if not isinstance(id_token, str):
        raise GoogleError("Réponse de Google sans ID token.")
    return identity(_claims(id_token), nonce)
