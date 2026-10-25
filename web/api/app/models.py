"""Tables utilisées par l'API. Le schéma lui-même est créé par les migrations (web/db/migrations)."""

import enum
import uuid
from datetime import datetime
from typing import Any, ClassVar

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    # Toutes les dates de la base sont des timestamptz.
    type_annotation_map: ClassVar[dict[Any, Any]] = {datetime: DateTime(timezone=True)}


class UserRole(enum.StrEnum):
    organizer = "organizer"
    support = "support"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    phone: Mapped[str] = mapped_column(String, unique=True)
    first_name: Mapped[str]
    last_name: Mapped[str]
    email: Mapped[str | None]
    password_hash: Mapped[str]
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_type=False),
        server_default=UserRole.organizer.value,
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    token_hash: Mapped[str] = mapped_column(String, unique=True)
    user_agent: Mapped[str | None]
    ip: Mapped[str | None] = mapped_column(INET)
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class EventType(enum.StrEnum):
    mariage = "mariage"
    dot = "dot"
    bapteme = "bapteme"
    funerailles = "funerailles"
    anniversaire = "anniversaire"
    brunch = "brunch"
    retrouvailles = "retrouvailles"
    reunion = "reunion"
    seminaire = "seminaire"
    concert_prive = "concert_prive"
    festival = "festival"
    autre = "autre"


class EventStatus(enum.StrEnum):
    draft = "draft"
    active = "active"
    done = "done"
    cancelled = "cancelled"


class RsvpStatus(enum.StrEnum):
    pending = "pending"
    confirmed = "confirmed"
    declined = "declined"


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str]
    type: Mapped[EventType] = mapped_column(
        Enum(EventType, name="event_type", create_type=False)
    )
    description: Mapped[str | None]
    starts_at: Mapped[datetime]
    duration_minutes: Mapped[int | None]
    location_name: Mapped[str | None]
    location_address: Mapped[str | None]
    latitude: Mapped[float | None] = mapped_column(Numeric(9, 6, asdecimal=False))
    longitude: Mapped[float | None] = mapped_column(Numeric(9, 6, asdecimal=False))
    expected_guests: Mapped[int | None]
    dress_code: Mapped[str | None]
    status: Mapped[EventStatus] = mapped_column(
        Enum(EventStatus, name="event_status", create_type=False),
        server_default=EventStatus.draft.value,
    )
    whatsapp_reminders_enabled: Mapped[bool] = mapped_column(server_default="false")
    call_reminders_enabled: Mapped[bool] = mapped_column(server_default="false")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())


class GuestCategory(Base):
    __tablename__ = "guest_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE")
    )
    name: Mapped[str]


class Guest(Base):
    """Colonnes utiles aux compteurs pour l'instant ; complétée avec l'import des invités."""

    __tablename__ = "guests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE")
    )
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("guest_categories.id"))
    rsvp_status: Mapped[RsvpStatus] = mapped_column(
        Enum(RsvpStatus, name="rsvp_status", create_type=False),
        server_default=RsvpStatus.pending.value,
    )
