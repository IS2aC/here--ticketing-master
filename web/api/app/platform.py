"""Réglages de la plateforme modifiés depuis le portail admin (table platform_settings).

Ils remplacent les variables d'environnement du même nom, sans redéployer. L'API les recharge au
démarrage et après chaque modification ; le worker, à chaque tour de boucle.
"""

import logging
from typing import Any

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import EDITABLE, Settings, apply_overrides
from app.models import PlatformSetting

log = logging.getLogger("here.platform")
_reported: set[str] = (
    set()
)  # valeurs invalides déjà signalées (le worker recharge souvent)


def validated(key: str, value: Any) -> Any:
    """Valeur convertie au type du réglage (lève ValidationError si elle ne convient pas)."""
    return TypeAdapter(Settings.model_fields[key].annotation).validate_python(value)


async def load_overrides(db: AsyncSession) -> dict[str, Any]:
    overrides: dict[str, Any] = {}
    for key, value in (
        await db.execute(select(PlatformSetting.key, PlatformSetting.value))
    ).all():
        if key not in EDITABLE:
            continue
        try:
            overrides[key] = validated(key, value)
        except ValidationError:
            # Une valeur illisible ne doit pas bloquer l'envoi : celle de l'environnement s'applique.
            if f"{key}={value!r}" not in _reported:
                _reported.add(f"{key}={value!r}")
                log.error("Réglage %s ignoré : valeur invalide (%r).", key, value)
    return overrides


async def refresh_settings(db: AsyncSession) -> None:
    apply_overrides(await load_overrides(db))
