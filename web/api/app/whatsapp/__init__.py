"""Connecteur d'envoi WhatsApp interchangeable (variable WHATSAPP_PROVIDER).

Le reste de l'API ne connaît que `WhatsAppProvider` : changer de prestataire = écrire une nouvelle
classe ici, sans toucher aux invitations, aux relances ni au worker.
"""

from functools import lru_cache

from app.config import get_settings
from app.whatsapp.base import ProviderError, SentMessage, WhatsAppProvider
from app.whatsapp.console import ConsoleProvider
from app.whatsapp.wasender import WasenderProvider

__all__ = ["ProviderError", "SentMessage", "WhatsAppProvider", "get_provider"]


@lru_cache
def get_provider() -> WhatsAppProvider:
    settings = get_settings()
    if settings.whatsapp_provider == "wasender":
        return WasenderProvider(settings.wasender_base_url, settings.wasender_api_key)
    return ConsoleProvider()
