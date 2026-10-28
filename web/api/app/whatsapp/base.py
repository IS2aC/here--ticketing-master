from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class SentMessage:
    provider_id: str  # identifiant renvoyé à l'envoi (WasenderAPI : msgId)
    whatsapp_id: str | None = None  # key.id WhatsApp, quand il est connu tout de suite


class ProviderError(Exception):
    """Échec d'envoi. `retry` : erreur passagère (réseau, limite de débit), à retenter plus tard."""

    def __init__(self, message: str, *, retry: bool) -> None:
        super().__init__(message)
        self.retry = retry


class WhatsAppProvider(Protocol):
    name: str

    @property
    def configured(self) -> bool: ...

    async def send_image(
        self, to: str, image_url: str, caption: str
    ) -> SentMessage: ...

    async def send_text(self, to: str, text: str) -> SentMessage: ...

    async def send_poll(
        self, to: str, question: str, options: list[str]
    ) -> SentMessage: ...

    async def whatsapp_id(self, provider_id: str) -> str | None:
        """key.id WhatsApp d'un message envoyé (None s'il n'est pas encore connu)."""
        ...
