import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field, StringConstraints

from app.models import UserRole
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
