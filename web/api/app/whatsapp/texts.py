"""Textes des messages WhatsApp (DESIGN.md › Message WhatsApp, ton de voix « hôte »).

Invitation et relance : la carte (image) ou un texte, avec le lien de la page invité sur sa propre ligne,
puis un sondage « Oui / Non ». Hommage : texte sobre, pas de sondage.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from app.models import Event, EventType, Guest, MessageKind

_DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
_MONTHS = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]  # fmt: skip


def when(starts_at: datetime) -> str:
    """« samedi 13 décembre à 15 h » (heure d'Abidjan = UTC)."""
    local = starts_at.astimezone(UTC)
    time = f"{local.hour} h" + (f" {local.minute:02d}" if local.minute else "")
    return f"{_DAYS[local.weekday()]} {local.day} {_MONTHS[local.month - 1]} à {time}"


@dataclass(frozen=True)
class Poll:
    question: str
    yes: str
    no: str

    @property
    def options(self) -> list[str]:
        return [self.yes, self.no]


@dataclass(frozen=True)
class Content:
    text: str  # légende de la carte (invitation) ou texte de la relance
    with_card: bool  # joindre l'image de la carte
    poll: Poll | None


def is_tribute(event: Event) -> bool:
    return event.type == EventType.funerailles


def poll_for(guest: Guest) -> Poll:
    if guest.seats > 1:
        return Poll(
            "Serez-vous des nôtres ?",
            "Oui, nous serons là",
            "Non, nous ne pourrons pas venir",
        )
    return Poll(
        "Serez-vous des nôtres ?", "Oui, je serai là", "Non, je ne pourrai pas venir"
    )


def message_content(
    kind: MessageKind, event: Event, guest: Guest, link: str
) -> Content:
    date = when(event.starts_at)
    place = f", {event.location_name}" if event.location_name else ""
    hello = f"Bonjour {guest.display_name},"
    if is_tribute(event):
        if kind == MessageKind.invitation:
            text = (
                f"{hello}\nLa famille vous adresse cette invitation : « {event.title} », "
                f"le {date}{place}.\nMerci de confirmer votre présence :\n{link}"
            )
            return Content(text, with_card=True, poll=None)
        text = (
            f"{hello}\nLa famille vous remercie de confirmer votre présence pour "
            f"« {event.title} », le {date}.\n{link}"
        )
        return Content(text, with_card=False, poll=None)
    if kind == MessageKind.invitation:
        text = (
            f"{hello}\nVoici votre invitation pour « {event.title} », le {date}{place}.\n"
            f"Votre carte et votre réponse :\n{link}"
        )
        return Content(text, with_card=True, poll=poll_for(guest))
    text = (
        f"{hello}\nNous n'avons pas encore votre réponse pour « {event.title} », le {date}.\n"
        f"Votre invitation :\n{link}"
    )
    return Content(text, with_card=False, poll=poll_for(guest))


def answer_from_option(option: str) -> bool | None:
    """Option du sondage → présent (True), absent (False). Insensible aux variantes singulier/pluriel."""
    start = option.strip().lower()
    if start.startswith("oui"):
        return True
    if start.startswith("non"):
        return False
    return None
