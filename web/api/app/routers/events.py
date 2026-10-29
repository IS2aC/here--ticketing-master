import uuid
from collections import defaultdict
from datetime import UTC, date, datetime

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentAuth, DbSession
from app.models import Checkin, Event, Guest, GuestCategory, Invitation, RsvpStatus
from app.schemas import (
    CategoryOut,
    EventCreate,
    EventOut,
    EventStats,
    EventSummary,
    EventUpdate,
    MonthCount,
)

router = APIRouter(prefix="/events", tags=["événements"])

NOT_FOUND = HTTPException(status.HTTP_404_NOT_FOUND, detail="Événement introuvable.")


def _future(starts_at: datetime) -> None:
    if starts_at <= datetime.now(UTC):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=[
                {
                    "loc": ["body", "starts_at"],
                    "msg": "La date de l'événement doit être à venir.",
                }
            ],
        )


async def owned_event(
    db: AsyncSession, event_id: uuid.UUID, user_id: uuid.UUID
) -> Event:
    # Un événement d'un autre organisateur répond 404, comme s'il n'existait pas.
    event = await db.scalar(
        select(Event).where(Event.id == event_id, Event.user_id == user_id)
    )
    if event is None:
        raise NOT_FOUND
    return event


async def _to_out(db: AsyncSession, events: list[Event]) -> list[EventOut]:
    ids = [e.id for e in events]
    if not ids:
        return []
    categories = (
        await db.execute(
            select(GuestCategory.id, GuestCategory.event_id, GuestCategory.name).where(
                GuestCategory.event_id.in_(ids)
            )
        )
    ).all()
    counts = (
        await db.execute(
            select(Guest.event_id, Guest.category_id, Guest.rsvp_status, func.count())
            .where(Guest.event_id.in_(ids))
            .group_by(Guest.event_id, Guest.category_id, Guest.rsvp_status)
        )
    ).all()

    stats: dict[uuid.UUID, EventStats] = defaultdict(EventStats)
    arrived = await db.execute(
        select(Guest.event_id, func.count())
        .join(Invitation, Invitation.guest_id == Guest.id)
        .join(Checkin, Checkin.invitation_id == Invitation.id)
        .where(Guest.event_id.in_(ids))
        .group_by(Guest.event_id)
    )
    for event_id, count in arrived:
        stats[event_id].arrived = count
    per_category: dict[uuid.UUID, int] = defaultdict(int)
    for event_id, category_id, rsvp, count in counts:
        s = stats[event_id]
        s.guests += count
        if rsvp == RsvpStatus.confirmed:
            s.confirmed += count
        elif rsvp == RsvpStatus.declined:
            s.declined += count
        else:
            s.pending += count
        per_category[category_id] += count

    by_event: dict[uuid.UUID, list[CategoryOut]] = defaultdict(list)
    for category_id, event_id, name in sorted(
        categories, key=lambda c: c.name.casefold()
    ):
        by_event[event_id].append(
            CategoryOut(id=category_id, name=name, guests=per_category[category_id])
        )

    return [
        EventOut.model_validate(
            {
                **{c: getattr(e, c) for c in EventOut.model_fields if hasattr(e, c)},
                "categories": by_event[e.id],
                "stats": stats[e.id],
            }
        )
        for e in events
    ]


@router.get("")
async def list_events(auth: CurrentAuth, db: DbSession) -> list[EventOut]:
    events = (
        await db.scalars(
            select(Event).where(Event.user_id == auth.user.id).order_by(Event.starts_at)
        )
    ).all()
    return await _to_out(db, list(events))


@router.get("/summary")
async def events_summary(auth: CurrentAuth, db: DbSession) -> EventSummary:
    """Événements créés et invités ajoutés par mois (heure d'Abidjan = UTC), sur 6 mois."""
    today = datetime.now(UTC).date()
    months = [
        date(
            today.year + (today.month - 1 - i) // 12, (today.month - 1 - i) % 12 + 1, 1
        )
        for i in reversed(range(6))
    ]

    async def per_month(column: object, *where: object) -> dict[date, int]:
        month = func.date(func.date_trunc("month", func.timezone("UTC", column)))
        rows = await db.execute(
            select(month, func.count())
            .where(column >= months[0], *where)
            .group_by(month)
        )
        return {m: n for m, n in rows.all()}

    events = await per_month(Event.created_at, Event.user_id == auth.user.id)
    guests = await per_month(
        Guest.created_at,
        Guest.event_id.in_(select(Event.id).where(Event.user_id == auth.user.id)),
    )
    return EventSummary(
        months=[
            MonthCount(month=m, events=events.get(m, 0), guests=guests.get(m, 0))
            for m in months
        ]
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_event(body: EventCreate, auth: CurrentAuth, db: DbSession) -> EventOut:
    _future(body.starts_at)
    event = Event(user_id=auth.user.id, **body.model_dump(exclude={"categories"}))
    db.add(event)
    await db.flush()
    db.add_all(GuestCategory(event_id=event.id, name=name) for name in body.categories)
    await db.commit()
    await db.refresh(event)
    return (await _to_out(db, [event]))[0]


@router.get("/{event_id}")
async def get_event(event_id: uuid.UUID, auth: CurrentAuth, db: DbSession) -> EventOut:
    event = await owned_event(db, event_id, auth.user.id)
    return (await _to_out(db, [event]))[0]


@router.patch("/{event_id}")
async def update_event(
    event_id: uuid.UUID, body: EventUpdate, auth: CurrentAuth, db: DbSession
) -> EventOut:
    event = await owned_event(db, event_id, auth.user.id)
    changes = body.model_dump(exclude_unset=True, exclude={"categories"})
    for required in ("title", "type", "starts_at"):
        if required in changes and changes[required] is None:
            del changes[required]
    if "starts_at" in changes and changes["starts_at"] != event.starts_at:
        _future(changes["starts_at"])
    for field, value in changes.items():
        setattr(event, field, value)

    if body.categories is not None:
        await _sync_categories(db, event.id, body.categories)

    await db.commit()
    await db.refresh(event)
    return (await _to_out(db, [event]))[0]


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> Response:
    """Supprime l'événement et tout ce qui lui appartient. Irréversible.

    Les invités d'abord : leurs invitations, entrées, messages (y compris ceux encore en file : le worker
    ne les enverra pas), appels et messages reçus partent avec eux. Ensuite l'événement : catégories,
    imports, cartes et liens de scan. Cet ordre est nécessaire car une invitation empêche la suppression
    de sa carte (ON DELETE RESTRICT) et un invité celle de sa catégorie.
    """
    event = await owned_event(db, event_id, auth.user.id)
    await db.execute(delete(Guest).where(Guest.event_id == event.id))
    await db.execute(delete(Event).where(Event.id == event.id))
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _sync_categories(
    db: AsyncSession, event_id: uuid.UUID, names: list[str]
) -> None:
    """Garde les catégories existantes (même nom, casse ignorée), ajoute les nouvelles, retire les absentes.

    Une catégorie qui a déjà des invités ne peut pas être retirée.
    """
    existing = {
        c.name.casefold(): c
        for c in await db.scalars(
            select(GuestCategory).where(GuestCategory.event_id == event_id)
        )
    }
    wanted = {name.casefold(): name for name in names}

    removed = [c for key, c in existing.items() if key not in wanted]
    if removed:
        used = (
            (
                await db.execute(
                    select(GuestCategory.name)
                    .join(Guest, Guest.category_id == GuestCategory.id)
                    .where(GuestCategory.id.in_([c.id for c in removed]))
                    .distinct()
                )
            )
            .scalars()
            .all()
        )
        if used:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail={
                    "field": "categories",
                    "message": f"La catégorie « {used[0]} » a déjà des invités : changez-les de catégorie avant de la retirer.",
                },
            )
        for category in removed:
            await db.delete(category)

    for key, name in wanted.items():
        if key in existing:
            existing[key].name = name  # suit la casse saisie
        else:
            db.add(GuestCategory(event_id=event_id, name=name))
