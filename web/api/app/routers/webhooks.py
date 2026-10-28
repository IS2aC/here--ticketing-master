"""Webhooks WasenderAPI : statuts des messages, votes au sondage, messages écrits par les invités.

À configurer dans le tableau de bord WasenderAPI (session › Webhook) :
  URL      https://<api>/v1/webhooks/wasender
  Secret   identique à WASENDER_WEBHOOK_SECRET (envoyé dans l'en-tête X-Webhook-Signature)
  Événements : messages.update, poll.results, messages.received
"""

import hmac
import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.auth import DbSession
from app.config import get_settings
from app.messaging import record_inbound, record_status, record_vote
from app.models import MessageStatus

router = APIRouter(tags=["webhooks"])
log = logging.getLogger("here.webhooks")

# messages.update : codes de statut WasenderAPI.
STATUS_CODES = {
    0: MessageStatus.failed,
    2: MessageStatus.sent,
    3: MessageStatus.delivered,
    4: MessageStatus.read,
    5: MessageStatus.read,  # média écouté ou regardé
}


def _phone_from(key: dict[str, Any]) -> str | None:
    """Numéro de l'expéditeur (« cleanedSenderPn », sans « + »), au format des invités : +225…"""
    digits = "".join(c for c in str(key.get("cleanedSenderPn") or "") if c.isdigit())
    return f"+{digits}" if digits else None


@router.post("/webhooks/wasender", include_in_schema=False)
async def wasender_webhook(
    request: Request,
    db: DbSession,
    x_webhook_signature: str | None = Header(default=None),
) -> dict[str, bool]:
    secret = get_settings().wasender_webhook_secret
    if not secret or not hmac.compare_digest(x_webhook_signature or "", secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Signature invalide.")
    try:
        payload = await request.json()
    except ValueError:
        return {"received": True}
    event = payload.get("event")
    data = payload.get("data") or {}

    if event == "messages.update":
        updates = data if isinstance(data, list) else [data]
        for item in updates:
            key = item.get("key") or {}
            code = (item.get("update") or {}).get("status")
            if key.get("id") and code in STATUS_CODES:
                await record_status(db, key["id"], STATUS_CODES[code])

    elif event == "poll.results":
        poll_id = (data.get("key") or {}).get("id")
        chosen = [
            o.get("name", "") for o in data.get("pollResult") or [] if o.get("voters")
        ]
        if poll_id and len(chosen) == 1:  # un vote retiré (aucune option) est ignoré
            await record_vote(db, poll_id, chosen[0])

    elif event == "messages.received":
        message = data.get("messages") or {}
        key = message.get("key") or {}
        phone = _phone_from(key)
        body = (message.get("messageBody") or "").strip()
        if phone and body and not key.get("fromMe"):
            await record_inbound(db, phone, body[:2000], key.get("id"))

    # Toujours 200 : WasenderAPI attend un accusé de réception rapide.
    return {"received": True}
