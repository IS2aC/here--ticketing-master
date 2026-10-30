"""« Une question ? » : l'organisateur pose sa question ; l'assistant répond ou la transmet à l'équipe Here!,
qui répond depuis le portail admin (Messages › Questions). Rôles admin et support pour l'équipe."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import assistant
from app.auth import CurrentAuth, DbSession, StaffAuth
from app.models import (
    SupportAuthor,
    SupportConversation,
    SupportMessage,
    SupportStatus,
    User,
)
from app.schemas import (
    SupportBody,
    SupportConversationOut,
    SupportMessageOut,
    SupportThread,
    SupportThreadPage,
)

router = APIRouter(tags=["questions"])

MESSAGES_PER_HOUR = 30  # par organisateur : protège l'assistant (et son coût)
HANDED_OVER = (
    "Votre question est transmise à l'équipe Here!. Nous vous répondons ici, "
    "en général dans la journée."
)


async def _messages(
    db: AsyncSession, conversation_id: uuid.UUID
) -> list[SupportMessageOut]:
    rows = await db.execute(
        select(SupportMessage, User.first_name)
        .outerjoin(User, User.id == SupportMessage.staff_id)
        .where(SupportMessage.conversation_id == conversation_id)
        .order_by(SupportMessage.created_at, SupportMessage.id)
    )
    return [
        SupportMessageOut(
            id=m.id,
            author=m.author,
            body=m.body,
            created_at=m.created_at,
            staff_name=name,
        )
        for m, name in rows.all()
    ]


async def _out(db: AsyncSession, conv: SupportConversation) -> SupportConversationOut:
    return SupportConversationOut(
        id=conv.id,
        status=conv.status,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=await _messages(db, conv.id),
    )


async def _current(db: AsyncSession, user_id: uuid.UUID) -> SupportConversation | None:
    return await db.scalar(
        select(SupportConversation)
        .where(
            SupportConversation.user_id == user_id,
            SupportConversation.status != SupportStatus.closed,
        )
        .order_by(SupportConversation.created_at.desc())
        .limit(1)
    )


def _add(
    db: AsyncSession,
    conv: SupportConversation,
    author: SupportAuthor,
    body: str,
    staff_id=None,
) -> None:
    db.add(
        SupportMessage(
            conversation_id=conv.id, author=author, body=body, staff_id=staff_id
        )
    )
    conv.updated_at = datetime.now(UTC)


# --- Organisateur -------------------------------------------------------------------------


@router.get("/support")
async def my_conversation(
    auth: CurrentAuth, db: DbSession
) -> SupportConversationOut | None:
    """La discussion en cours (la dernière non terminée), ou rien."""
    conv = await _current(db, auth.user.id)
    return await _out(db, conv) if conv else None


@router.post("/support/messages")
async def ask(
    body: SupportBody, auth: CurrentAuth, db: DbSession
) -> SupportConversationOut:
    """Nouveau message de l'organisateur. Tant que l'équipe n'est pas dans la discussion, l'assistant répond
    (ou transmet) ; ensuite, c'est l'équipe qui répond."""
    sent = await db.scalar(
        select(func.count())
        .select_from(SupportMessage)
        .join(
            SupportConversation,
            SupportConversation.id == SupportMessage.conversation_id,
        )
        .where(
            SupportConversation.user_id == auth.user.id,
            SupportMessage.author == SupportAuthor.organizer,
            SupportMessage.created_at > datetime.now(UTC) - timedelta(hours=1),
        )
    )
    if (sent or 0) >= MESSAGES_PER_HOUR:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Beaucoup de messages en peu de temps : réessayez dans un moment."
            },
        )
    conv = await _current(db, auth.user.id)
    if conv is None:
        conv = SupportConversation(user_id=auth.user.id, status=SupportStatus.assistant)
        db.add(conv)
        await db.flush()
    _add(db, conv, SupportAuthor.organizer, body.body)
    await db.commit()

    if conv.status == SupportStatus.assistant:
        history = [
            {
                "role": "user" if m.author == SupportAuthor.organizer else "assistant",
                "content": m.body,
            }
            for m in await _messages(db, conv.id)
        ]
        reply = await assistant.ask(
            str(conv.id),
            {
                "first_name": auth.user.first_name,
                "organization": auth.user.organization,
            },
            history,
        )
        if reply is None or reply.escalate:
            _add(
                db,
                conv,
                SupportAuthor.assistant,
                (reply.text if reply and reply.text else HANDED_OVER),
            )
            conv.status = SupportStatus.waiting
        else:
            _add(db, conv, SupportAuthor.assistant, reply.text)
    else:
        conv.status = (
            SupportStatus.waiting
        )  # l'équipe suit la discussion : elle répondra
    await db.commit()
    await db.refresh(conv)
    return await _out(db, conv)


@router.post("/support/escalate")
async def hand_over(auth: CurrentAuth, db: DbSession) -> SupportConversationOut:
    """« Parler à l'équipe Here! » : la discussion en cours est transmise à l'équipe."""
    conv = await _current(db, auth.user.id)
    if conv is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"message": "Écrivez d'abord votre question."},
        )
    if conv.status == SupportStatus.assistant:
        _add(db, conv, SupportAuthor.assistant, HANDED_OVER)
        conv.status = SupportStatus.waiting
        await db.commit()
        await db.refresh(conv)
    return await _out(db, conv)


@router.post("/support/close", status_code=status.HTTP_204_NO_CONTENT)
async def close_mine(auth: CurrentAuth, db: DbSession) -> Response:
    """« Nouvelle question » : la discussion en cours est terminée."""
    conv = await _current(db, auth.user.id)
    if conv is not None:
        conv.status = SupportStatus.closed
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Équipe Here! (portail admin › Messages › Questions) -----------------------------------


async def _thread(
    db: AsyncSession, conv: SupportConversation, user: User
) -> SupportThread:
    return SupportThread(
        **(await _out(db, conv)).model_dump(),
        organizer_id=user.id,
        organizer_name=f"{user.first_name} {user.last_name}",
        organizer_phone=user.phone,
        organization=user.organization,
    )


@router.get("/admin/questions")
async def questions(
    _: StaffAuth,
    db: DbSession,
    state: Literal["a-traiter", "toutes"] = "a-traiter",
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> SupportThreadPage:
    """À traiter : transmises à l'équipe, la plus ancienne d'abord. Toutes : les plus récentes d'abord."""
    waiting = await db.scalar(
        select(func.count()).where(SupportConversation.status == SupportStatus.waiting)
    )
    total = await db.scalar(select(func.count()).select_from(SupportConversation))
    query = select(SupportConversation, User).join(
        User, User.id == SupportConversation.user_id
    )
    if state == "a-traiter":
        query = query.where(
            SupportConversation.status == SupportStatus.waiting
        ).order_by(SupportConversation.updated_at)
    else:
        query = query.order_by(SupportConversation.updated_at.desc())
    rows = (await db.execute(query.limit(limit))).all()
    return SupportThreadPage(
        waiting=waiting or 0,
        total=total or 0,
        items=[await _thread(db, conv, user) for conv, user in rows],
    )


async def _staff_conversation(db: AsyncSession, conversation_id: uuid.UUID):
    row = (
        await db.execute(
            select(SupportConversation, User)
            .join(User, User.id == SupportConversation.user_id)
            .where(SupportConversation.id == conversation_id)
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Discussion introuvable.")
    return row


@router.post("/admin/questions/{conversation_id}/reply")
async def reply(
    conversation_id: uuid.UUID, body: SupportBody, auth: StaffAuth, db: DbSession
) -> SupportThread:
    conv, user = await _staff_conversation(db, conversation_id)
    _add(db, conv, SupportAuthor.staff, body.body, staff_id=auth.user.id)
    conv.status = SupportStatus.answered
    await db.commit()
    await db.refresh(conv)
    return await _thread(db, conv, user)


@router.post("/admin/questions/{conversation_id}/close")
async def close(
    conversation_id: uuid.UUID, _: StaffAuth, db: DbSession
) -> SupportThread:
    conv, user = await _staff_conversation(db, conversation_id)
    conv.status = SupportStatus.closed
    await db.commit()
    await db.refresh(conv)
    return await _thread(db, conv, user)
