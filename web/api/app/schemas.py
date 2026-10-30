import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, EmailStr, Field, StringConstraints

from app.guest_import import RowStatus
from app.models import (
    CallOutcome,
    ContactStatus,
    EventStatus,
    EventType,
    ImportStatus,
    MessageKind,
    MessageStatus,
    RsvpStatus,
    SupportAuthor,
    SupportStatus,
    UserRole,
)
from app.phone import normalize_phone


def _phone(value: str) -> str:
    phone = normalize_phone(value)
    if phone is None:
        raise ValueError("Ce numéro de téléphone n'est pas valide.")
    return phone


Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
Phone = Annotated[str, AfterValidator(_phone)]


class RegisterIn(BaseModel):
    first_name: Name
    last_name: Name
    phone: Phone
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    # Téléphone ou adresse e-mail.
    identifier: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    phone: str
    email: str | None
    role: UserRole
    organization: str | None = None
    city: str | None = None
    country: str | None = None
    billing_address: str | None = None
    tax_id: str | None = None


class SessionOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserOut


# --- Événements ---------------------------------------------------------------

Title = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)
]
CategoryName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)
]


def _blank_to_none(value: str | None) -> str | None:
    return value or None


def _text(max_length: int) -> type[str]:
    return Annotated[
        str, StringConstraints(strip_whitespace=True, max_length=max_length)
    ]  # type: ignore[return-value]


# Texte facultatif : une chaîne vide devient null.
Text100 = Annotated[_text(100) | None, AfterValidator(_blank_to_none)]
Text200 = Annotated[_text(200) | None, AfterValidator(_blank_to_none)]
Text300 = Annotated[_text(300) | None, AfterValidator(_blank_to_none)]
Text2000 = Annotated[_text(2000) | None, AfterValidator(_blank_to_none)]


def _unique_categories(names: list[str]) -> list[str]:
    seen: dict[str, str] = {}
    for name in names:
        seen.setdefault(name.casefold(), name)
    return list(seen.values())


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("La date doit préciser son fuseau horaire.")
    return value


Categories = Annotated[
    list[CategoryName],
    Field(min_length=1, max_length=10),
    AfterValidator(_unique_categories),
]
AwareDatetime = Annotated[datetime, AfterValidator(_aware)]


class EventFields(BaseModel):
    description: Text2000 = None
    duration_minutes: int | None = Field(default=None, ge=1, le=60 * 24 * 7)
    location_name: Text200 = None
    location_address: Text300 = None
    expected_guests: int | None = Field(default=None, ge=0, le=100_000)
    dress_code: Text100 = None
    # Date limite de réponse des invités ; vide : jusqu'au début de l'événement.
    rsvp_deadline: AwareDatetime | None = None


class EventCreate(EventFields):
    title: Title
    type: EventType
    starts_at: AwareDatetime
    categories: Categories = ["VIP", "Normal"]


class EventUpdate(EventFields):
    # Champs absents = inchangés ; null = effacé (pour les champs facultatifs).
    title: Title | None = None
    type: EventType | None = None
    starts_at: AwareDatetime | None = None
    categories: Categories | None = None
    track_entries: bool | None = (
        None  # « Gérer les entrées et sorties » (contrôle d'accès)
    )


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    guests: int = 0


class EventStats(BaseModel):
    arrived: int = 0  # invitations scannées à l'entrée
    guests: int = 0
    confirmed: int = 0
    declined: int = 0
    pending: int = 0


class MonthCount(BaseModel):
    month: date  # premier jour du mois
    events: int  # événements créés
    guests: int  # invités ajoutés


class EventSummary(BaseModel):
    """Activité de l'organisateur par mois (tableau de bord) : les 6 derniers mois, mois en cours compris."""

    months: list[MonthCount]


class EventOut(BaseModel):
    id: uuid.UUID
    title: str
    type: EventType
    status: EventStatus
    starts_at: datetime
    duration_minutes: int | None
    location_name: str | None
    location_address: str | None
    expected_guests: int | None
    dress_code: str | None
    description: str | None
    rsvp_deadline: datetime | None
    track_entries: bool
    categories: list[CategoryOut]
    stats: EventStats
    created_at: datetime
    updated_at: datetime


# --- Invités et import ------------------------------------------------------------------


class ImportColumnOut(BaseModel):
    header: str
    field: str | None
    label: str | None


class ImportRowOut(BaseModel):
    line: int
    display_name: str
    last_name: str | None = None
    first_names: str | None = None
    phone: str | None
    phone_valid: bool
    category: str | None
    raw_category: str | None
    seat: str | None
    seats: int = 1
    status: RowStatus


class ImportSummary(BaseModel):
    total: int
    to_import: int  # prêtes + à vérifier
    to_verify: int  # importées mais numéro manquant ou à corriger
    not_imported: int  # nom manquant ou catégorie inconnue
    duplicates: int
    by_category: dict[str, int]


class ImportOut(BaseModel):
    id: uuid.UUID
    event_id: uuid.UUID
    file_name: str
    status: ImportStatus
    created_at: datetime
    columns: list[ImportColumnOut]
    summary: ImportSummary
    imported_rows: int
    rows: list[ImportRowOut]


GuestText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]


class GuestIn(BaseModel):
    """Invité saisi ou modifié à la main. Un nom ou un prénom au moins ; numéro valide ou vide."""

    last_name: GuestText | None = None
    first_names: GuestText | None = None
    phone: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)] | None
    ) = None
    category_id: uuid.UUID
    seat: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] | None
    ) = None
    seats: Annotated[int, Field(ge=1, le=20)] = 1  # l'invité et ses accompagnants


class ImportRowIn(BaseModel):
    """Ligne de l'aperçu d'import corrigée. La catégorie est un nom, comme dans le fichier."""

    last_name: GuestText | None = None
    first_names: GuestText | None = None
    phone: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)] | None
    ) = None
    category: GuestText | None = None
    seat: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] | None
    ) = None
    seats: Annotated[int, Field(ge=1, le=20)] | None = None


class GuestOut(BaseModel):
    id: uuid.UUID
    invitation_token: str | None = None
    display_name: str
    last_name: str | None
    first_names: str | None
    phone: str | None
    phone_valid: bool
    category_id: uuid.UUID
    category: str
    seat: str | None
    seats: int  # personnes de l'invitation (lui compris)
    rsvp_status: RsvpStatus
    attending_seats: int | None
    rsvp_message: str | None
    contact_status: ContactStatus
    opened_at: datetime | None = (
        None  # page de l'invitation ouverte (navigateur, pas aperçu)
    )


# --- Cartes d'invitation ----------------------------------------------------------------
# La carte est choisie automatiquement selon le type d'événement (bibliothèque du frontend) :
# l'API fournit les données de l'événement et de l'invité.


class InvitationsResult(BaseModel):
    total: int  # invités ayant une invitation
    created: int  # invitations créées par cet appel
    without_phone: int  # invitations qui ne pourront pas partir par WhatsApp


class PublicCard(BaseModel):
    """Données d'une carte, lues avec le jeton de l'invitation (QR code, image WhatsApp)."""

    code: str
    event_type: EventType
    title: str
    starts_at: datetime
    duration_minutes: int | None
    location_name: str | None
    location_address: str | None
    dress_code: str | None
    guest_name: str
    category: str
    seat: str | None
    seats: int  # places de l'invitation
    rsvp_status: RsvpStatus
    attending_seats: int | None
    rsvp_message: str | None
    responses_open: bool  # jusqu'à la date limite (ou au début de l'événement), sauf s'il est annulé
    responses_until: datetime  # date limite de réponse, sinon début de l'événement
    card_title: str | None = (
        None  # intitulé choisi par l'organisateur (sinon le nom de l'événement)
    )
    card_palette: str | None = (
        None  # palette choisie (identifiant, voir frontend lib/card/palettes)
    )
    rsvp_deadline: datetime | None  # choisie par l'organisateur


class InvitationResponse(BaseModel):
    attending: bool
    seats: int | None = Field(
        default=None, ge=1, le=100
    )  # personnes qui viennent ; toutes les places par défaut
    message: Annotated[_text(500) | None, AfterValidator(_blank_to_none)] = None


# --- Scan à l'entrée -------------------------------------------------------------------


class ScanLinkIn(BaseModel):
    label: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)
    ] = "Entrée principale"


class ScanLinkOut(BaseModel):
    id: uuid.UUID
    label: str
    token: str
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
    active: bool
    checkins: int


class ScanEvent(BaseModel):
    title: str
    event_type: EventType
    starts_at: datetime
    label: str  # nom du lien : « Entrée de la réception »
    track_entries: bool  # entrées gérées : « Déjà entré » au 2e scan
    arrived: int  # personnes entrées
    expected: int  # personnes attendues : invités qui ont confirmé


class ScanCheckIn(BaseModel):
    value: (
        Annotated[
            str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)
        ]
        | None
    ) = None
    guest_id: uuid.UUID | None = None  # depuis « Chercher par nom »


class ScanGuest(BaseModel):
    guest_id: uuid.UUID
    name: str
    category: str
    seat: str | None
    seats: int
    rsvp_status: RsvpStatus
    code: str
    entered_at: datetime | None


class ScanResult(BaseModel):
    # refused : invitation valide, mais l'invité n'a pas confirmé (« non » ou sans réponse).
    result: Literal["admitted", "already", "unknown", "refused"]
    code: str | None  # code lu ou trouvé
    guest: ScanGuest | None
    entered_at: datetime | None  # première entrée (déjà entré) ou maintenant (attendu)
    entered_by: str | None  # lien qui a enregistré l'entrée : « Porte A »
    event: ScanEvent


# ---------------------------------------------------------------------------
# Envoi WhatsApp : invitations et relances
# ---------------------------------------------------------------------------


class MessageCounts(BaseModel):
    scheduled: int = 0  # en file (y compris en cours d'envoi)
    sent: int = 0  # envoyés, ni livrés ni lus
    delivered: int = 0
    read: int = 0
    failed: int = 0
    canceled: int = 0


class MessageOut(BaseModel):
    id: uuid.UUID
    guest_name: str
    kind: MessageKind
    status: MessageStatus
    scheduled_at: datetime
    sent_at: datetime | None
    error: str | None


class InboundOut(BaseModel):
    id: uuid.UUID
    guest_name: str | None
    body: str
    received_at: datetime


class WhatsAppOverview(BaseModel):
    provider: str  # « wasender » ou « console » (rien n'est envoyé)
    configured: bool
    reminders_enabled: bool  # relance standard offerte
    reminder_days_before: list[
        int
    ]  # calendrier des relances, en jours avant l'événement
    reminder_dates: list[date]  # dates de relance de cet événement, passées comprises
    reminder_dates_chosen: bool  # sinon : calendrier proposé
    max_reminder_dates: int
    day_before_option: bool  # rappel la veille : option payante active pour ce compte
    day_before_enabled: bool  # activé pour cet événement
    day_before_at: datetime  # moment de l'envoi (la veille, à l'heure réglée)
    calls_enabled: bool
    on_demand_reminders: bool  # « Relancer maintenant » : option payante activée ou non
    ready: int  # invités qui peuvent recevoir leur invitation maintenant
    without_phone: int  # cartes prêtes mais numéro manquant ou à vérifier
    without_card: int  # invités sans carte préparée
    to_remind: int  # invités sans réponse qui ont reçu leur invitation
    calls_scheduled: int
    invitations_opened: int  # invitations dont la page a été ouverte
    invitations: MessageCounts
    reminders: MessageCounts
    day_before: MessageCounts
    recent: list[MessageOut]
    inbound: list[InboundOut]


class WhatsAppSettingsIn(BaseModel):
    reminders_enabled: bool | None = None
    calls_enabled: bool | None = None
    day_before_enabled: bool | None = None  # rappel la veille (si l'option est active)
    # Absent : inchangées. null : retour au calendrier proposé. Liste : dates choisies.
    reminder_dates: list[date] | None = None


class QueueResult(BaseModel):
    queued: int
    without_phone: int = 0


# --- Profil ----------------------------------------------------------------------------


class ProfileUpdate(BaseModel):
    """Champs absents : inchangés. Champs facultatifs à null ou vides : effacés."""

    first_name: Name | None = None
    last_name: Name | None = None
    phone: Phone | None = None
    email: EmailStr | None = None
    organization: Annotated[_text(120) | None, AfterValidator(_blank_to_none)] = None
    city: Annotated[_text(80) | None, AfterValidator(_blank_to_none)] = None
    country: Annotated[_text(80) | None, AfterValidator(_blank_to_none)] = None
    billing_address: Annotated[_text(300) | None, AfterValidator(_blank_to_none)] = None
    tax_id: Annotated[_text(40) | None, AfterValidator(_blank_to_none)] = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetRequest(BaseModel):
    # Téléphone ou adresse e-mail du compte.
    identifier: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
    ]


class PasswordResetConfirm(BaseModel):
    identifier: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
    ]
    code: Annotated[
        str, StringConstraints(strip_whitespace=True, pattern=r"^\d{3} ?\d{3}$")
    ]
    password: str = Field(min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Portail admin (équipe Here!)
# ---------------------------------------------------------------------------


class Trend(BaseModel):
    """Compteur cumulé : total, nouveaux sur la période, et hausse par rapport au total d'avant."""

    total: int
    new: int
    trend_pct: float | None  # None : rien avant la période


class SendStats(Trend):
    delivered: int  # livrés (lus compris)
    read: int


class DayPoint(BaseModel):
    day: date
    organizers: int  # inscriptions
    guests: int  # invités ajoutés
    sent: int  # messages envoyés (invitations et relances)
    failed: int


class Activity(BaseModel):
    kind: Literal["organizer", "event", "invitations", "responses", "failures"]
    title: str
    detail: str
    at: datetime


class AdminProvider(BaseModel):
    name: str  # « console » ou « wasender »
    configured: bool
    min_delay_seconds: float
    max_delay_seconds: float
    send_start_hour: int
    send_end_hour: int


class AdminDashboard(BaseModel):
    period_days: int
    organizers: Trend
    events: Trend
    events_by_status: dict[EventStatus, int]
    upcoming_events: int  # à venir, non annulés
    guests: Trend
    rsvp: dict[RsvpStatus, int]
    invitations: SendStats
    reminders: SendStats
    messages_queued: int
    messages_failed: Trend
    checkins: int
    calls_scheduled: int
    series: list[
        DayPoint
    ]  # un point par jour de la période, du plus ancien au plus récent
    activity: list[Activity]  # les plus récentes d'abord
    provider: AdminProvider


class AdminUser(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    phone: str
    email: str | None
    organization: str | None
    city: str | None
    country: str | None
    role: UserRole
    on_demand_reminders: bool
    day_before_reminders: bool
    created_at: datetime
    last_login_at: datetime | None
    events: int


class AdminUserPage(BaseModel):
    total: int
    items: list[AdminUser]


class AdminEvent(BaseModel):
    id: uuid.UUID
    title: str
    type: EventType
    status: EventStatus
    starts_at: datetime
    organizer_id: uuid.UUID
    organizer_name: str
    guests: int
    cards: int  # invités dont la carte est préparée
    invitations_sent: int
    confirmed: int
    declined: int
    pending: int
    checkins: int
    messages_failed: int


class AdminEventPage(BaseModel):
    total: int
    items: list[AdminEvent]


class AdminUserDetail(AdminUser):
    billing_address: str | None
    tax_id: str | None
    event_list: list[AdminEvent]


class AdminUserUpdate(BaseModel):
    """Options payantes du compte. Champ absent : inchangé."""

    on_demand_reminders: bool | None = None
    day_before_reminders: bool | None = None


class PlatformValues(BaseModel):
    """Réglages modifiables depuis le portail admin (mêmes noms que les variables d'environnement)."""

    whatsapp_provider: Literal["console", "wasender"]
    whatsapp_reminder_days_before: list[int]  # jours avant l'événement
    whatsapp_min_delay_seconds: float
    whatsapp_max_delay_seconds: float
    whatsapp_batch_size: int
    whatsapp_batch_pause_minutes: float
    whatsapp_send_start_hour: int  # heure d'Abidjan
    whatsapp_send_end_hour: int
    whatsapp_day_before_hour: int  # rappel la veille


class ProviderOption(BaseModel):
    value: str
    label: str
    available: bool  # connecteur écrit
    configured: bool  # clés présentes dans l'environnement


class PlatformSettingsOut(BaseModel):
    values: PlatformValues  # en vigueur
    defaults: PlatformValues  # de l'environnement
    overridden: list[str]  # réglages modifiés depuis le portail
    providers: list[ProviderOption]
    updated_at: datetime | None


ReminderDays = Annotated[list[Annotated[int, Field(ge=1, le=90)]], Field(max_length=5)]


class PlatformSettingsIn(BaseModel):
    """Champ absent : inchangé. null : retour à la valeur de l'environnement."""

    whatsapp_provider: Literal["console", "wasender"] | None = None
    whatsapp_reminder_days_before: ReminderDays | None = None
    whatsapp_min_delay_seconds: Annotated[float, Field(ge=5, le=600)] | None = None
    whatsapp_max_delay_seconds: Annotated[float, Field(ge=5, le=600)] | None = None
    whatsapp_batch_size: Annotated[int, Field(ge=1, le=500)] | None = None
    whatsapp_batch_pause_minutes: Annotated[float, Field(ge=0, le=240)] | None = None
    whatsapp_send_start_hour: Annotated[int, Field(ge=0, le=23)] | None = None
    whatsapp_send_end_hour: Annotated[int, Field(ge=1, le=24)] | None = None
    whatsapp_day_before_hour: Annotated[int, Field(ge=0, le=23)] | None = None


# ---------------------------------------------------------------------------
# Écran de la conseillère (rôles admin et support) : appels et messages des invités
# ---------------------------------------------------------------------------


class StaffCall(BaseModel):
    id: uuid.UUID
    guest_id: uuid.UUID
    guest_name: str
    phone: str | None  # complet : la conseillère appelle
    phone_valid: bool
    category: str
    seats: int
    rsvp_status: RsvpStatus
    event_id: uuid.UUID
    event_title: str
    event_type: EventType
    event_starts_at: datetime
    host: str  # organisateur (au nom de qui on appelle)
    reminders_sent: int
    scheduled_at: datetime
    called_at: datetime | None
    outcome: CallOutcome | None
    notes: str | None
    agent_name: str | None


class StaffCallPage(BaseModel):
    to_do: int
    done: int
    items: list[StaffCall]


class CallResultIn(BaseModel):
    outcome: CallOutcome
    notes: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None
    ) = None


class StaffMessage(BaseModel):
    id: uuid.UUID
    body: str
    phone: str
    received_at: datetime
    handled_at: datetime | None
    guest_id: uuid.UUID | None  # None : numéro inconnu
    guest_name: str | None
    rsvp_status: RsvpStatus | None
    event_title: str | None


class StaffMessagePage(BaseModel):
    to_do: int
    done: int
    items: list[StaffMessage]


class HandledIn(BaseModel):
    handled: bool


# ---------------------------------------------------------------------------
# « Une question ? » : discussion organisateur ↔ assistant / équipe Here!
# ---------------------------------------------------------------------------


class SupportBody(BaseModel):
    body: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
    ]


class SupportMessageOut(BaseModel):
    id: uuid.UUID
    author: SupportAuthor
    body: str
    created_at: datetime
    staff_name: str | None = None  # prénom du membre de l'équipe


class SupportConversationOut(BaseModel):
    id: uuid.UUID
    status: SupportStatus
    created_at: datetime
    updated_at: datetime
    messages: list[SupportMessageOut]


class SupportThread(SupportConversationOut):
    """Vue de l'équipe : la discussion et l'organisateur."""

    organizer_id: uuid.UUID
    organizer_name: str
    organizer_phone: str
    organization: str | None


class SupportThreadPage(BaseModel):
    waiting: int  # à traiter par l'équipe
    total: int
    items: list[SupportThread]


# ---------------------------------------------------------------------------
# Carte de l'événement : intitulé et palette (cartes automatiques)
# ---------------------------------------------------------------------------

PaletteId = Annotated[str, StringConstraints(pattern=r"^[a-z0-9_]{1,30}$")]


class CardSettings(BaseModel):
    title: str | None  # intitulé ; None : le nom de l'événement
    palette: str | None  # None : la palette d'origine du modèle
    locked: bool  # invitations parties ou en file : plus de modification


class CardSettingsIn(BaseModel):
    """Champ absent : inchangé ; null : retour à la valeur d'origine."""

    title: (
        Annotated[
            str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
        ]
        | None
    ) = None
    palette: PaletteId | None = None
