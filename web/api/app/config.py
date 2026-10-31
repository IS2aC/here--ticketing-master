from functools import lru_cache
from typing import Any, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    # Origines autorisées pour le navigateur (frontend web), séparées par des virgules.
    cors_origins: str = ""
    docs_enabled: bool = True
    session_ttl_days: int = 30
    # Adresse publique du site : lien de la page invité et image de la carte envoyés sur WhatsApp.
    public_app_url: str = "http://localhost:3000"

    # Envoi WhatsApp. « console » n'envoie rien (développement, tests) ; « wasender » envoie pour de vrai.
    whatsapp_provider: Literal["console", "wasender"] = "console"
    # Clé de la session WhatsApp (tableau de bord WasenderAPI).
    wasender_api_key: str = ""
    wasender_base_url: str = "https://www.wasenderapi.com/api"
    wasender_webhook_secret: str = ""  # comparé à l'en-tête X-Webhook-Signature

    # Cadence anti-blocage (un seul worker par numéro) : un invité à la fois, pauses irrégulières.
    whatsapp_min_delay_seconds: float = 20
    whatsapp_max_delay_seconds: float = 45
    whatsapp_batch_size: int = 25  # invités servis avant une longue pause
    whatsapp_batch_pause_minutes: float = 30
    whatsapp_send_start_hour: int = 8  # heure d'Abidjan (UTC) : pas d'envoi la nuit
    whatsapp_send_end_hour: int = 20
    # Relances automatiques des invités sans réponse, en jours avant l'événement (« 14,7,2 »).
    # Standard offert : une relance 7 jours avant.
    whatsapp_reminder_days_before: str = "7"
    # Appel de la conseillère, après la dernière relance restée sans réponse.
    whatsapp_call_delay_days: float = 2
    # Relances à la demande (« Relancer maintenant ») : option payante, désactivée par défaut.
    # Plus tard : activée compte par compte depuis le portail admin (voir TODO).
    whatsapp_on_demand_reminders: bool = False
    # Rappel la veille (option payante) : heure d'envoi, et activation pour tous les comptes.
    whatsapp_day_before_hour: int = 10
    whatsapp_day_before_reminders: bool = False
    # Plus de relance dans les 24 h avant l'événement.
    whatsapp_reminder_stop_hours: int = 24

    # « Une question ? » : assistant qui répond aux organisateurs (sinon l'équipe Here! répond).
    # none : pas de réponse automatique ; openai : API compatible OpenAI (/chat/completions, par exemple
    # un agent hébergé avec Nemotron) ; webhook : contrat JSON simple (voir app/assistant).
    assistant_provider: Literal["none", "openai", "webhook"] = "none"
    assistant_base_url: str = ""  # openai : …/v1 ; webhook : adresse complète
    assistant_api_key: str = ""
    assistant_model: str = ""
    assistant_timeout_seconds: float = 25

    @field_validator("database_url")
    @classmethod
    def use_asyncpg_driver(cls, url: str) -> str:
        # Le compose fournit une URL postgres:// standard ; SQLAlchemy a besoin du pilote asyncpg.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+asyncpg://" + url.removeprefix(prefix)
        return url

    @property
    def reminder_days_before(self) -> list[int]:
        """Jours avant l'événement, du plus lointain au plus proche."""
        days = {
            int(d) for d in self.whatsapp_reminder_days_before.split(",") if d.strip()
        }
        return sorted((d for d in days if d > 0), reverse=True)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


# Réglages modifiables depuis le portail admin (table platform_settings), sans redéployer.
# Les autres restent dans l'environnement.
EDITABLE = (
    "whatsapp_provider",
    "whatsapp_reminder_days_before",
    "whatsapp_min_delay_seconds",
    "whatsapp_max_delay_seconds",
    "whatsapp_batch_size",
    "whatsapp_batch_pause_minutes",
    "whatsapp_send_start_hour",
    "whatsapp_send_end_hour",
    "whatsapp_day_before_hour",
)

_current: Settings | None = None


@lru_cache
def env_settings() -> Settings:
    """Réglages de l'environnement seul (valeurs par défaut du portail admin)."""
    return Settings()


def get_settings() -> Settings:
    return _current or env_settings()


def apply_overrides(overrides: dict[str, Any]) -> None:
    """Remplace les réglages de l'environnement par ceux du portail admin (déjà validés)."""
    global _current
    _current = env_settings().model_copy(update=overrides) if overrides else None
