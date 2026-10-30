"""Tables utilisées par l'API. Le schéma lui-même est créé par les migrations (web/db/migrations)."""

import enum
import uuid
from datetime import date, datetime
from typing import Any, ClassVar

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import ARRAY, INET, JSONB, UUID
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
    organization: Mapped[str | None]  # entreprise, association ou famille
    city: Mapped[str | None]
    country: Mapped[str | None]
    billing_address: Mapped[str | None]
    tax_id: Mapped[str | None]
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role", create_type=False),
        server_default=UserRole.organizer.value,
    )
    # Relances à la demande : option payante, activée par l'équipe Here! (portail admin).
    on_demand_reminders: Mapped[bool] = mapped_column(server_default="false")
    # Rappel la veille : option payante, activée par l'équipe Here! (portail admin).
    day_before_reminders: Mapped[bool] = mapped_column(server_default="false")
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
    rsvp_deadline: Mapped[
        datetime | None
    ]  # date limite de réponse ; None : jusqu'au début
    status: Mapped[EventStatus] = mapped_column(
        Enum(EventStatus, name="event_status", create_type=False),
        server_default=EventStatus.draft.value,
    )
    whatsapp_reminders_enabled: Mapped[bool] = mapped_column(server_default="true")
    call_reminders_enabled: Mapped[bool] = mapped_column(server_default="false")
    day_before_enabled: Mapped[bool] = mapped_column(
        server_default="true"
    )  # si l'option est active
    # « Gérer les entrées et sorties » : entrées enregistrées, « Déjà entré » au 2e scan.
    track_entries: Mapped[bool] = mapped_column(server_default="false")
    # Dates choisies par l'organisateur ; None : calendrier proposé (voir messaging.reminder_dates).
    reminder_dates: Mapped[list[date] | None] = mapped_column(ARRAY(Date))
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


class ContactStatus(enum.StrEnum):
    none = "none"
    reminded = "reminded"
    call_scheduled = "call_scheduled"
    unreachable = "unreachable"


class ImportStatus(enum.StrEnum):
    pending = "pending"  # fichier lu, en attente de confirmation
    processing = "processing"
    done = "done"
    failed = "failed"


class GuestImport(Base):
    __tablename__ = "guest_imports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE")
    )
    file_name: Mapped[str]
    file_url: Mapped[str | None]
    column_mapping: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    rows: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default="[]")
    total_rows: Mapped[int] = mapped_column(server_default="0")
    imported_rows: Mapped[int] = mapped_column(server_default="0")
    error_rows: Mapped[int] = mapped_column(server_default="0")
    status: Mapped[ImportStatus] = mapped_column(
        Enum(ImportStatus, name="import_status", create_type=False),
        server_default=ImportStatus.pending.value,
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Guest(Base):
    __tablename__ = "guests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE")
    )
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("guest_categories.id"))
    import_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("guest_imports.id", ondelete="SET NULL")
    )
    display_name: Mapped[str]
    last_name: Mapped[str | None]
    first_names: Mapped[str | None]
    phone: Mapped[str | None]
    phone_valid: Mapped[bool] = mapped_column(server_default="false")
    seat: Mapped[str | None]
    seats: Mapped[int] = mapped_column(server_default="1")
    rsvp_status: Mapped[RsvpStatus] = mapped_column(
        Enum(RsvpStatus, name="rsvp_status", create_type=False),
        server_default=RsvpStatus.pending.value,
    )
    responded_at: Mapped[datetime | None]
    attending_seats: Mapped[int | None]
    rsvp_message: Mapped[str | None]
    contact_status: Mapped[ContactStatus] = mapped_column(
        Enum(ContactStatus, name="contact_status", create_type=False),
        server_default=ContactStatus.none.value,
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class CardTemplate(Base):
    __tablename__ = "card_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    code: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str]
    default_palette: Mapped[dict[str, str]] = mapped_column(JSONB, server_default="{}")
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    is_active: Mapped[bool] = mapped_column(server_default="true")


class EventCard(Base):
    __tablename__ = "event_cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE")
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("guest_categories.id", ondelete="CASCADE")
    )
    template_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("card_templates.id"))
    palette: Mapped[dict[str, str]] = mapped_column(JSONB, server_default="{}")
    invitation_text: Mapped[str | None]
    photo_url: Mapped[str | None]


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    guest_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("guests.id", ondelete="CASCADE"), unique=True
    )
    event_card_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("event_cards.id"))
    token: Mapped[str] = mapped_column(String, unique=True)
    image_url: Mapped[str | None]
    sent_at: Mapped[datetime | None]
    opened_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ScanLink(Base):
    __tablename__ = "scan_links"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE")
    )
    label: Mapped[str]
    token: Mapped[str] = mapped_column(String, unique=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]


class Checkin(Base):
    __tablename__ = "checkins"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("invitations.id", ondelete="CASCADE"), unique=True
    )
    scan_link_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("scan_links.id", ondelete="SET NULL")
    )
    seats: Mapped[int] = mapped_column(server_default="1")
    scanned_at: Mapped[datetime] = mapped_column(server_default=func.now())


class MessageKind(enum.StrEnum):
    invitation = "invitation"
    reminder = "reminder"
    day_before = "day_before"  # rappel la veille : la carte et le QR code d'entrée


class MessageStatus(enum.StrEnum):
    scheduled = "scheduled"  # dans la file d'envoi
    sending = "sending"  # pris par le worker
    sent = "sent"  # accepté par WhatsApp
    delivered = "delivered"
    read = "read"
    failed = "failed"
    canceled = "canceled"  # devenu inutile avant l'envoi


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    guest_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("guests.id", ondelete="CASCADE")
    )
    kind: Mapped[MessageKind] = mapped_column(
        Enum(MessageKind, name="message_kind", create_type=False)
    )
    provider_message_id: Mapped[str | None] = mapped_column(String, unique=True)
    whatsapp_id: Mapped[str | None] = mapped_column(String, unique=True)
    poll_provider_message_id: Mapped[str | None] = mapped_column(String, unique=True)
    poll_whatsapp_id: Mapped[str | None] = mapped_column(String, unique=True)
    status: Mapped[MessageStatus] = mapped_column(
        Enum(MessageStatus, name="message_status", create_type=False),
        server_default=MessageStatus.scheduled.value,
    )
    body: Mapped[str | None]
    attempts: Mapped[int] = mapped_column(server_default="0")
    scheduled_at: Mapped[datetime] = mapped_column(server_default=func.now())
    sent_at: Mapped[datetime | None]
    delivered_at: Mapped[datetime | None]
    read_at: Mapped[datetime | None]
    error: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class InboundMessage(Base):
    __tablename__ = "inbound_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    guest_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("guests.id", ondelete="CASCADE")
    )
    phone: Mapped[str]
    body: Mapped[str]
    whatsapp_id: Mapped[str | None] = mapped_column(String, unique=True)
    received_at: Mapped[datetime] = mapped_column(server_default=func.now())
    handled_at: Mapped[datetime | None]


class CallOutcome(enum.StrEnum):
    confirmed = "confirmed"  # l'invité vient
    declined = "declined"  # il ne vient pas
    no_answer = "no_answer"  # pas de réponse
    wrong_number = "wrong_number"  # mauvais numéro


class Call(Base):
    """Appel de la conseillère, programmé après la dernière relance restée sans réponse."""

    __tablename__ = "calls"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    guest_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("guests.id", ondelete="CASCADE")
    )
    agent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    scheduled_at: Mapped[datetime]
    called_at: Mapped[datetime | None]
    outcome: Mapped[CallOutcome | None] = mapped_column(
        Enum(CallOutcome, name="call_outcome", create_type=False)
    )
    notes: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class PlatformSetting(Base):
    """Réglage modifié depuis le portail admin (remplace la variable d'environnement du même nom)."""

    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(primary_key=True)
    value: Mapped[Any] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )


class LoginAttempt(Base):
    """Tentative de connexion (ou de « mot de passe actuel »), pour limiter les essais."""

    __tablename__ = "login_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    identifier: Mapped[str]  # téléphone E.164 ou e-mail en minuscules
    ip: Mapped[str | None] = mapped_column(INET)
    succeeded: Mapped[bool]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class OtpPurpose(enum.StrEnum):
    password_reset = "password_reset"


class OtpCode(Base):
    """Code à usage unique envoyé par WhatsApp. Seule son empreinte est gardée."""

    __tablename__ = "otp_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE")
    )
    purpose: Mapped[OtpPurpose] = mapped_column(
        Enum(OtpPurpose, name="otp_purpose", create_type=False)
    )
    code_hash: Mapped[str]
    attempts: Mapped[int] = mapped_column(server_default="0")
    expires_at: Mapped[datetime]
    used_at: Mapped[datetime | None]
    ip: Mapped[str | None] = mapped_column(INET)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
