import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field, StringConstraints

from app.models import EventStatus, EventType, UserRole
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


class CategoryOut(BaseModel):
    id: uuid.UUID
    name: str
    guests: int = 0


class EventStats(BaseModel):
    guests: int = 0
    confirmed: int = 0
    declined: int = 0
    pending: int = 0


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
    categories: list[CategoryOut]
    stats: EventStats
    created_at: datetime
