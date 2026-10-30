"""Worker d'envoi WhatsApp : `python -m app.worker` (service `here-worker` du docker-compose).

Un seul worker par numéro WhatsApp. Il sert un invité à la fois, comme le ferait une personne :
- pause aléatoire de WHATSAPP_MIN_DELAY_SECONDS à WHATSAPP_MAX_DELAY_SECONDS entre deux invités ;
- longue pause de WHATSAPP_BATCH_PAUSE_MINUTES tous les WHATSAPP_BATCH_SIZE invités ;
- aucun envoi en dehors de WHATSAPP_SEND_START_HOUR – WHATSAPP_SEND_END_HOUR (heure d'Abidjan).
Ces réglages et le prestataire peuvent être changés depuis le portail admin, sans redémarrer.
Il programme aussi les relances automatiques et la file d'appels (app/messaging.plan_follow_ups).
"""

import asyncio
import logging
import random
import signal
from datetime import UTC, datetime

from app.config import get_settings
from app.db import dispose_engine, get_engine, get_session
from app.messaging import (
    claim_next,
    plan_day_before,
    plan_follow_ups,
    resolve_whatsapp_ids,
    send_message,
)
from app.platform import refresh_settings
from app.whatsapp import get_provider

log = logging.getLogger("here.worker")

IDLE_SECONDS = 20  # attente quand la file est vide
PLAN_EVERY_SECONDS = 300  # relances et appels


def in_send_hours(moment: datetime) -> bool:
    settings = get_settings()
    hour = moment.astimezone(UTC).hour
    return settings.whatsapp_send_start_hour <= hour < settings.whatsapp_send_end_hour


async def run(stop: asyncio.Event) -> None:
    async for db in get_session():
        await refresh_settings(db)
    provider = get_provider()
    get_engine()
    log.info("Worker WhatsApp démarré (prestataire : %s).", provider.name)
    if not provider.configured:
        log.error(
            "Prestataire %s non configuré : aucun message ne partira.", provider.name
        )
    served, last_plan = 0, 0.0
    loop = asyncio.get_running_loop()

    async def pause(seconds: float) -> None:
        try:
            await asyncio.wait_for(stop.wait(), timeout=seconds)
        except TimeoutError:
            pass

    while not stop.is_set():
        try:
            # Réglages du portail admin (prestataire, calendrier, cadence) : pris en compte sans redémarrer.
            async for db in get_session():
                await refresh_settings(db)
            settings = get_settings()
            if get_provider() is not provider:
                provider = get_provider()
                log.info("Prestataire d'envoi : %s.", provider.name)
                if not provider.configured:
                    log.error(
                        "Prestataire %s non configuré : aucun message ne partira.",
                        provider.name,
                    )

            if loop.time() - last_plan >= PLAN_EVERY_SECONDS:
                async for db in get_session():
                    reminders, calls = await plan_follow_ups(db)
                    day_before = await plan_day_before(db)
                    await resolve_whatsapp_ids(db, provider)
                if reminders or calls or day_before:
                    log.info(
                        "Programmé : %s relance(s), %s appel(s), %s rappel(s) la veille.",
                        reminders,
                        calls,
                        day_before,
                    )
                last_plan = loop.time()

            if not provider.configured or not in_send_hours(datetime.now(UTC)):
                await pause(60)
                continue

            message_id = None
            async for db in get_session():
                message_id = await claim_next(db)
                if message_id is not None:
                    status = await send_message(db, provider, message_id)
                    log.info("Message %s : %s.", message_id, status)
            if message_id is None:
                await pause(IDLE_SECONDS)
                continue

            served += 1
            if served % settings.whatsapp_batch_size == 0:
                log.info(
                    "%s invités servis : pause de %s min.",
                    served,
                    settings.whatsapp_batch_pause_minutes,
                )
                await pause(
                    settings.whatsapp_batch_pause_minutes
                    * 60
                    * random.uniform(0.9, 1.2)
                )
            else:
                await pause(
                    random.uniform(
                        settings.whatsapp_min_delay_seconds,
                        settings.whatsapp_max_delay_seconds,
                    )
                )
        except Exception:  # le worker ne doit pas s'arrêter sur une erreur isolée
            log.exception("Erreur du worker WhatsApp.")
            await pause(30)
    await dispose_engine()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s"
    )
    stop = asyncio.Event()

    async def runner() -> None:
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, stop.set)
        await run(stop)

    asyncio.run(runner())


if __name__ == "__main__":
    main()
