"""Limite des tentatives de connexion : par compte et par adresse IP, fenêtre glissante de 15 minutes.

- 5 échecs sur un même compte : ce compte est suspendu 15 minutes (une connexion réussie remet à zéro) ;
- 20 échecs depuis une même adresse IP : cette adresse est suspendue 15 minutes.
Les tentatives sont gardées 24 h. Utilisé par la connexion et par le « mot de passe actuel » du profil.
"""

import math
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import LoginAttempt
from app.phone import normalize_phone

WINDOW = timedelta(minutes=15)
MAX_PER_ACCOUNT = 5
MAX_PER_IP = 20
KEEP = timedelta(hours=24)


def login_key(identifier: str) -> str:
    """Clé du compte visé : e-mail en minuscules, sinon téléphone au format E.164 (ou tel que saisi)."""
    identifier = identifier.strip()
    if "@" in identifier:
        return identifier.lower()
    return normalize_phone(identifier) or identifier


async def _locked_until(
    db: AsyncSession, column: object, value: str, limit: int, reset_on_success: bool
) -> datetime | None:
    now = datetime.now(UTC)
    since = now - WINDOW
    if reset_on_success:
        last_success = await db.scalar(
            select(func.max(LoginAttempt.created_at)).where(
                column == value, LoginAttempt.succeeded.is_(True)
            )
        )
        if last_success and last_success > since:
            since = last_success
    failures = (
        await db.scalars(
            select(LoginAttempt.created_at)
            .where(
                column == value,
                LoginAttempt.succeeded.is_(False),
                LoginAttempt.created_at > since,
            )
            .order_by(LoginAttempt.created_at.desc())
            .limit(limit)
        )
    ).all()
    if len(failures) < limit:
        return None
    # Bloqué jusqu'à ce que le plus ancien des `limit` derniers échecs sorte de la fenêtre.
    return failures[-1] + WINDOW


async def check(db: AsyncSession, key: str, ip: str | None) -> None:
    """Lève une erreur 429 si le compte ou l'adresse IP a trop d'échecs récents."""
    until = [
        await _locked_until(db, LoginAttempt.identifier, key, MAX_PER_ACCOUNT, True),
        await _locked_until(db, LoginAttempt.ip, ip, MAX_PER_IP, False) if ip else None,
    ]
    blocked = max((u for u in until if u), default=None)
    if blocked:
        minutes = max(1, math.ceil((blocked - datetime.now(UTC)).total_seconds() / 60))
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": f"Trop de tentatives. Réessayez dans {minutes} minute{'s' if minutes > 1 else ''}.",
                "retry_after_minutes": minutes,
            },
            headers={"Retry-After": str(minutes * 60)},
        )


async def record(db: AsyncSession, key: str, ip: str | None, succeeded: bool) -> None:
    db.add(LoginAttempt(identifier=key, ip=ip, succeeded=succeeded))
    await db.execute(
        delete(LoginAttempt).where(LoginAttempt.created_at < datetime.now(UTC) - KEEP)
    )
    await db.commit()
