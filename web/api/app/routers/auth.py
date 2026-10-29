import logging
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import false, func, or_, select, update
from sqlalchemy.exc import IntegrityError

from app import login_guard
from app.auth import CurrentAuth, DbSession, client_ip, open_session
from app.models import OtpCode, OtpPurpose, Session, User
from app.phone import normalize_phone
from app.schemas import (
    LoginIn,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    ProfileUpdate,
    RegisterIn,
    SessionOut,
    UserOut,
)
from app.security import hash_password, hash_token, verify_password
from app.whatsapp import ProviderError, get_provider

router = APIRouter(tags=["comptes"])
log = logging.getLogger("here.auth")


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
    key, ip = login_guard.login_key(body.identifier), client_ip(request)
    await login_guard.check(db, key, ip)
    user = (await db.execute(select(User).where(condition))).scalar_one_or_none()

    if (
        not verify_password(user.password_hash if user else None, body.password)
        or user is None
    ):
        await login_guard.record(db, key, ip, succeeded=False)
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Identifiant ou mot de passe incorrect.",
        )
    await login_guard.record(db, key, ip, succeeded=True)
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


@router.patch("/me")
async def update_me(body: ProfileUpdate, auth: CurrentAuth, db: DbSession) -> UserOut:
    """« Mon profil » : modifie les informations du compte. Le téléphone et l'e-mail restent uniques."""
    user = auth.user
    changes = body.model_dump(exclude_unset=True)
    for required in ("first_name", "last_name", "phone"):
        if required in changes and changes[required] is None:
            del changes[required]
    if changes.get("email"):
        changes["email"] = changes["email"].lower()

    for field, label in (("phone", "ce numéro"), ("email", "cette adresse e-mail")):
        value = changes.get(field)
        if not value or value == getattr(user, field):
            continue
        column = User.phone if field == "phone" else func.lower(User.email)
        if await db.scalar(select(User.id).where(column == value, User.id != user.id)):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail={
                    "field": field,
                    "message": f"Un autre compte utilise déjà {label}.",
                },
            )

    for field, value in changes.items():
        setattr(user, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "field": "phone",
                "message": "Un autre compte utilise déjà ces coordonnées.",
            },
        ) from None
    await db.refresh(user)
    return UserOut.model_validate(user, from_attributes=True)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: PasswordChange, auth: CurrentAuth, request: Request, db: DbSession
) -> Response:
    """Change le mot de passe et déconnecte les autres appareils (la session en cours reste ouverte)."""
    key, ip = auth.user.phone, client_ip(request)
    await login_guard.check(db, key, ip)
    if not verify_password(auth.user.password_hash, body.current_password):
        await login_guard.record(db, key, ip, succeeded=False)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={
                "field": "current_password",
                "message": "Le mot de passe actuel est incorrect.",
            },
        )
    auth.user.password_hash = hash_password(body.new_password)
    await db.execute(
        update(Session)
        .where(
            Session.user_id == auth.user.id,
            Session.id != auth.session.id,
            Session.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Mot de passe oublié : code à 6 chiffres envoyé par WhatsApp
# ---------------------------------------------------------------------------

CODE_TTL = timedelta(minutes=15)
CODE_TRIES = 5  # essais par code
CODES_PER_HOUR = 3  # codes envoyés par compte et par heure
REQUESTS_PER_IP_PER_HOUR = 10

_RESET_SENT = {
    "message": "Si un compte correspond, un code vient de lui être envoyé sur WhatsApp."
}
_BAD_CODE = "Code incorrect ou expiré. Vérifiez-le, ou demandez un nouveau code."


def _code_hash(user_id: object, code: str) -> str:
    return hash_token(f"{user_id}:{code}")


async def _account(db: DbSession, identifier: str) -> User | None:
    key = login_guard.login_key(identifier)
    column = func.lower(User.email) if "@" in key else User.phone
    return (await db.execute(select(User).where(column == key))).scalar_one_or_none()


@router.post("/auth/password-reset", status_code=status.HTTP_202_ACCEPTED)
async def request_password_reset(
    body: PasswordResetRequest, request: Request, db: DbSession
) -> dict[str, str]:
    """Envoie un code par WhatsApp. Même réponse que le compte existe ou non (rien à deviner)."""
    now, ip = datetime.now(UTC), client_ip(request)
    hour_ago = now - timedelta(hours=1)
    if (
        ip
        and (
            await db.scalar(
                select(func.count()).where(
                    OtpCode.ip == ip, OtpCode.created_at > hour_ago
                )
            )
            or 0
        )
        >= REQUESTS_PER_IP_PER_HOUR
    ):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"message": "Trop de demandes. Réessayez dans une heure."},
        )
    user = await _account(db, body.identifier)
    if user is None:
        return _RESET_SENT
    recent = await db.scalar(
        select(func.count()).where(
            OtpCode.user_id == user.id,
            OtpCode.purpose == OtpPurpose.password_reset,
            OtpCode.created_at > hour_ago,
        )
    )
    if (recent or 0) >= CODES_PER_HOUR:
        return _RESET_SENT  # pas de nouveau code : le dernier envoyé reste valable

    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        OtpCode(
            user_id=user.id,
            purpose=OtpPurpose.password_reset,
            code_hash=_code_hash(user.id, code),
            expires_at=now + CODE_TTL,
            ip=ip,
        )
    )
    await db.commit()
    text = (
        f"Here! : votre code pour changer de mot de passe est {code[:3]} {code[3:]}. "
        "Il est valable 15 minutes. Ne le communiquez à personne, "
        "même à l'équipe Here!."
    )
    try:
        await get_provider().send_text(user.phone, text)
    except ProviderError:
        log.exception("Code de réinitialisation non envoyé (compte %s).", user.id)
    return _RESET_SENT


@router.post("/auth/password-reset/confirm")
async def confirm_password_reset(
    body: PasswordResetConfirm, request: Request, db: DbSession
) -> SessionOut:
    """Vérifie le code, change le mot de passe, déconnecte tous les appareils et ouvre une session."""
    now = datetime.now(UTC)
    bad = HTTPException(status.HTTP_400_BAD_REQUEST, detail={"message": _BAD_CODE})
    user = await _account(db, body.identifier)
    if user is None:
        raise bad
    otp = await db.scalar(
        select(OtpCode)
        .where(
            OtpCode.user_id == user.id,
            OtpCode.purpose == OtpPurpose.password_reset,
            OtpCode.used_at.is_(None),
            OtpCode.expires_at > now,
        )
        .order_by(OtpCode.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    if otp is None or otp.attempts >= CODE_TRIES:
        raise bad
    if not secrets.compare_digest(
        otp.code_hash, _code_hash(user.id, body.code.replace(" ", ""))
    ):
        otp.attempts += 1
        await db.commit()
        raise bad

    otp.used_at = now
    user.password_hash = hash_password(body.password)
    await db.execute(
        update(Session)
        .where(Session.user_id == user.id, Session.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    await db.commit()
    # Nouveau mot de passe : la suspension éventuelle du compte est levée.
    await login_guard.record(db, user.phone, client_ip(request), succeeded=True)
    if user.email:
        await login_guard.record(
            db, user.email.lower(), client_ip(request), succeeded=True
        )
    token, session = await open_session(db, user, request)
    return _session_out(token, session.expires_at, user)
