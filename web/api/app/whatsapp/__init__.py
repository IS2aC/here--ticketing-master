"""Connecteur d'envoi WhatsApp interchangeable (variable WHATSAPP_PROVIDER, ou portail admin).

Le reste de l'API ne connaît que `WhatsAppProvider` : changer de prestataire = écrire une nouvelle
classe ici, sans toucher aux invitations, aux relances ni au worker.
"""

from functools import lru_cache

from app.config import get_settings
from app.whatsapp.base import ProviderError, SentMessage, WhatsAppProvider
from app.whatsapp.console import ConsoleProvider
from app.whatsapp.wasender import WasenderProvider

__all__ = ["ProviderError", "SentMessage", "WhatsAppProvider", "get_provider"]


def get_provider() -> WhatsAppProvider:
    """Prestataire choisi (WHATSAPP_PROVIDER, ou portail admin)."""
    settings = get_settings()
    return _provider(
        settings.whatsapp_provider,
        settings.wasender_base_url,
        settings.wasender_api_key,
    )


@lru_cache
def _provider(name: str, base_url: str, api_key: str) -> WhatsAppProvider:
    if name == "wasender":
        return WasenderProvider(base_url, api_key)
    return ConsoleProvider()
