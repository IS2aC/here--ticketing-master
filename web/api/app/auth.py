import ipaddress
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import Session, User, UserRole
from app.security import hash_token, new_session_token

_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_session)]


def client_ip(request: Request) -> str | None:
    host = request.client.host if request.client else None
    try:
        return str(ipaddress.ip_address(host)) if host else None
    except ValueError:
        return None


async def open_session(
    db: AsyncSession, user: User, request: Request
) -> tuple[str, Session]:
    """Crée une session et renvoie le jeton en clair (seul son empreinte est stockée)."""
    token = new_session_token()
    session = Session(
        user_id=user.id,
        token_hash=hash_token(token),
        user_agent=request.headers.get("user-agent"),
        ip=client_ip(request),
        expires_at=datetime.now(UTC) + timedelta(days=get_settings().session_ttl_days),
    )
    db.add(session)
    await db.commit()
    return token, session


@dataclass
class Authenticated:
    user: User
    session: Session


async def current_auth(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Authenticated:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        detail="Votre session a expiré. Reconnectez-vous.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    row = (
        await db.execute(
            select(Session, User)
            .join(User, User.id == Session.user_id)
            .where(
                Session.token_hash == hash_token(credentials.credentials),
                Session.revoked_at.is_(None),
                Session.expires_at > datetime.now(UTC),
            )
        )
    ).one_or_none()
    if row is None:
        raise unauthorized
    session, user = row
    return Authenticated(user=user, session=session)


CurrentAuth = Annotated[Authenticated, Depends(current_auth)]


async def admin_auth(auth: CurrentAuth) -> Authenticated:
    """Portail admin : réservé au rôle admin (donné par `python -m app.admin`)."""
    if auth.user.role != UserRole.admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"message": "Cet espace est réservé à l'équipe Here!."},
        )
    return auth


AdminAuth = Annotated[Authenticated, Depends(admin_auth)]
