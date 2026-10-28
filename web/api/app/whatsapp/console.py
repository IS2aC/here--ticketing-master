import logging
import uuid

from app.whatsapp.base import SentMessage

log = logging.getLogger("here.whatsapp")


class ConsoleProvider:
    """N'envoie rien : écrit le message dans les journaux. Prestataire par défaut (développement, tests)."""

    name = "console"
    configured = True

    def __init__(self) -> None:
        self.sent: list[dict[str, object]] = []  # consulté par les tests

    def _record(self, **message: object) -> SentMessage:
        message_id = f"console-{uuid.uuid4().hex[:12]}"
        self.sent.append({"id": message_id, **message})
        log.info("WhatsApp (console, non envoyé) : %s", message)
        return SentMessage(provider_id=message_id, whatsapp_id=message_id)

    async def send_image(self, to: str, image_url: str, caption: str) -> SentMessage:
        return self._record(type="image", to=to, image_url=image_url, text=caption)

    async def send_text(self, to: str, text: str) -> SentMessage:
        return self._record(type="text", to=to, text=text)

    async def send_poll(
        self, to: str, question: str, options: list[str]
    ) -> SentMessage:
        return self._record(type="poll", to=to, question=question, options=options)

    async def whatsapp_id(self, provider_id: str) -> str | None:
        return provider_id
