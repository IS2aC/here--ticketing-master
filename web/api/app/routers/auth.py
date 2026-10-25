from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import false, func, or_, select
from sqlalchemy.exc import IntegrityError

from app.auth import CurrentAuth, DbSession, open_session
from app.models import User
from app.phone import normalize_phone
from app.schemas import LoginIn, RegisterIn, SessionOut, UserOut
from app.security import hash_password, verify_password

router = APIRouter(tags=["comptes"])


def _session_out(token: str, expires_at: datetime, user: User) -> SessionOut:
    return SessionOut(
        access_token=token,
        expires_at=expires_at,
        user=UserOut.model_validate(user, from_attributes=True),
    )


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterIn, request: Request, db: DbSession) -> SessionOut:
    email = body.email.lower() if body.email else None
    taken = (
        await db.execute(
            select(User.phone, User.email).where(
                or_(
                    User.phone == body.phone,
                    func.lower(User.email) == email if email else false(),
                )
            )
        )
    ).first()
    if taken is not None:
        field = "phone" if taken.phone == body.phone else "email"
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "field": field,
                "message": "Un compte existe déjà avec ce numéro."
                if field == "phone"
                else "Un compte existe déjà avec cette adresse e-mail.",
            },
        )

    user = User(
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
        email=email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        # Inscription simultanée avec le même numéro ou e-mail.
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "field": "phone",
                "message": "Un compte existe déjà avec ces coordonnées.",
            },
        ) from None
    await db.refresh(user)
    token, session = await open_session(db, user, request)
    return _session_out(token, session.expires_at, user)


@router.post("/auth/login")
async def login(body: LoginIn, request: Request, db: DbSession) -> SessionOut:
    if "@" in body.identifier:
        condition = func.lower(User.email) == body.identifier.lower()
    else:
        condition = User.phone == (normalize_phone(body.identifier) or body.identifier)
    user = (await db.execute(select(User).where(condition))).scalar_one_or_none()

    if (
        not verify_password(user.password_hash if user else None, body.password)
        or user is None
    ):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Identifiant ou mot de passe incorrect.",
        )
    token, session = await open_session(db, user, request)
    return _session_out(token, session.expires_at, user)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(auth: CurrentAuth, db: DbSession) -> Response:
    auth.session.revoked_at = datetime.now(UTC)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me")
async def me(auth: CurrentAuth) -> UserOut:
    return UserOut.model_validate(auth.user, from_attributes=True)
