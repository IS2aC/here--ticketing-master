"""Envoi WhatsApp : textes, file d'envoi, worker, relances, appels et webhooks WasenderAPI.

Aucun message réel ne part : le worker est appelé avec le prestataire « console » (ou un faux qui échoue).
"""

import asyncio
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.messaging import claim_next, plan_follow_ups, send_message
from app.models import Event, EventType, Guest, MessageKind
from app.whatsapp import ProviderError, SentMessage
from app.whatsapp.console import ConsoleProvider
from app.whatsapp.texts import answer_from_option, message_content, when
from tests.test_guest_response import invited, sql

SECRET = "secret-de-test"


# ---------------------------------------------------------------------------
# Textes (sans base)
# ---------------------------------------------------------------------------


def _event(type_: EventType = EventType.mariage) -> Event:
    return Event(
        title="Mariage Aya & Koffi",
        type=type_,
        starts_at=datetime(2026, 12, 12, 15, 0, tzinfo=UTC),
        location_name="Espace Les Jardins",
    )


def test_texts() -> None:
    assert (
        when(datetime(2026, 12, 12, 15, 30, tzinfo=UTC))
        == "samedi 12 décembre à 15 h 30"
    )
    guest = Guest(display_name="M. et Mme Konan", seats=2)
    link = "https://here.ci/i/abc"

    invitation = message_content(MessageKind.invitation, _event(), guest, link)
    assert invitation.with_card
    assert invitation.text.startswith("Bonjour M. et Mme Konan,")
    assert "samedi 12 décembre à 15 h, Espace Les Jardins" in invitation.text
    assert invitation.text.endswith(f"\n{link}")  # le lien sur sa propre ligne
    assert invitation.poll is None  # la carte et le lien, sans sondage

    reminder = message_content(MessageKind.reminder, _event(), guest, link)
    assert not reminder.with_card and "pas encore votre réponse" in reminder.text

    # Hommage : texte sobre.
    tribute = message_content(
        MessageKind.reminder, _event(EventType.funerailles), guest, link
    )
    assert tribute.poll is None and "La famille vous remercie" in tribute.text

    assert answer_from_option("Oui, je serai là") is True
    assert answer_from_option(" non, nous ne pourrons pas venir") is False
    assert answer_from_option("Peut-être") is None


# ---------------------------------------------------------------------------
# File d'envoi, worker et webhooks (base de test)
# ---------------------------------------------------------------------------


def run_db(work: Callable[[AsyncSession], Awaitable[Any]]) -> Any:
    """Exécute `work` avec sa propre connexion (le TestClient a la sienne, dans un autre fil)."""

    async def main() -> Any:
        engine = create_async_engine(get_settings().database_url)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as db:
                return await work(db)
        finally:
            await engine.dispose()

    return asyncio.run(main())


def deliver_next(provider: Any) -> str | None:
    """Une itération du worker : prend le prochain message dû et l'envoie."""

    async def work(db: AsyncSession) -> str | None:
        message_id = await claim_next(db)
        if message_id is None:
            return None
        return (await send_message(db, provider, message_id, poll_delay=(0, 0))).value

    return run_db(work)


def overview(client: TestClient, organizer: dict[str, str], event_id: str) -> dict:
    response = client.get(f"/v1/events/{event_id}/whatsapp", headers=organizer)
    assert response.status_code == 200, response.text
    return response.json()


def webhook(client: TestClient, payload: dict, secret: str = SECRET):
    return client.post(
        "/v1/webhooks/wasender", json=payload, headers={"X-Webhook-Signature": secret}
    )


@pytest.fixture
def webhook_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "wasender_webhook_secret", SECRET)


@pytest.mark.db
def test_send_invitations_and_webhooks(
    client: TestClient, organizer: dict[str, str], webhook_secret: None
) -> None:
    event_id, guests = invited(client, organizer)
    jean = guests["Jean Konan"]  # seul invité avec un numéro valide

    before = overview(client, organizer, event_id)
    assert before["provider"] == "console"
    assert before == {**before, "ready": 1, "without_phone": 2, "without_card": 0}

    queued = client.post(
        f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer
    )
    assert queued.status_code == 202, queued.text
    assert queued.json() == {"queued": 1, "without_phone": 2}
    again = client.post(
        f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer
    )
    assert again.status_code == 409
    assert (
        client.get(f"/v1/events/{event_id}", headers=organizer).json()["status"]
        == "active"
    )

    provider = ConsoleProvider()
    assert deliver_next(provider) == "sent"
    assert deliver_next(provider) is None  # file vide
    [image] = provider.sent  # un seul message : la carte, avec le lien dans la légende
    assert image["type"] == "image" and image["to"] == "+2250707123456"
    assert (
        image["image_url"]
        == f"http://localhost:3000/i/{jean['invitation_token']}/carte.png"
    )
    assert f"http://localhost:3000/i/{jean['invitation_token']}" in str(image["text"])

    after = overview(client, organizer, event_id)
    assert after["ready"] == 0 and after["to_remind"] == 1
    assert after["invitations"]["sent"] == 1
    assert after["recent"][0]["guest_name"] == "Jean Konan"

    # Webhooks : signature obligatoire.
    assert (
        webhook(client, {"event": "messages.update"}, secret="faux").status_code == 401
    )
    lu = {
        "event": "messages.update",
        "data": {"key": {"id": image["id"]}, "update": {"status": 4}},
    }
    assert webhook(client, lu).status_code == 200
    assert overview(client, organizer, event_id)["invitations"]["read"] == 1

    # Vote « Oui » à un sondage déjà envoyé (avant leur suppression) : l'invité est confirmé.
    sql("UPDATE messages SET poll_whatsapp_id = 'WA-POLL-ANCIEN'")
    vote = {
        "event": "poll.results",
        "data": {
            "key": {"id": "WA-POLL-ANCIEN", "fromMe": True},
            "pollResult": [
                {"name": "Oui, je serai là", "voters": ["225070712345@s.whatsapp.net"]},
                {"name": "Non, je ne pourrai pas venir", "voters": []},
            ],
        },
    }
    assert webhook(client, vote).status_code == 200
    listed = client.get(f"/v1/events/{event_id}/guests", headers=organizer).json()
    konan = next(g for g in listed if g["display_name"] == "Jean Konan")
    assert konan["rsvp_status"] == "confirmed" and konan["attending_seats"] == 1

    # Message libre de l'invité : visible par l'organisateur.
    received = {
        "event": "messages.received",
        "data": {
            "messages": {
                "key": {
                    "id": "WA-IN-1",
                    "fromMe": False,
                    "cleanedSenderPn": "2250707123456",
                },
                "messageBody": "Merci, nous serons là !",
            }
        },
    }
    assert webhook(client, received).status_code == 200
    assert (
        webhook(client, received).status_code == 200
    )  # reçu deux fois : gardé une fois
    inbound = overview(client, organizer, event_id)["inbound"]
    assert [(i["guest_name"], i["body"]) for i in inbound] == [
        ("Jean Konan", "Merci, nous serons là !")
    ]


@pytest.mark.db
def test_offered_reminder_then_call(
    client: TestClient, organizer: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    event_id, guests = invited(client, organizer)
    jean = guests["Jean Konan"]
    view = overview(client, organizer, event_id)
    # Relance standard offerte : active par défaut, 7 jours avant l'événement.
    assert view["reminders_enabled"] is True and view["reminder_days_before"] == [7]
    assert len(view["reminder_dates"]) == 1  # événement dans 30 jours : relance à J-7

    # Événement dans moins de 7 jours : plus de relance gratuite à afficher.
    sql(
        f"UPDATE events SET starts_at = now() + interval '3 days' WHERE id = '{event_id}'"
    )
    assert overview(client, organizer, event_id)["reminder_dates"] == []
    sql(
        f"UPDATE events SET starts_at = now() + interval '30 days' WHERE id = '{event_id}'"
    )
    assert view["on_demand_reminders"] is False

    client.post(f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer)
    provider = ConsoleProvider()
    deliver_next(provider)
    client.patch(
        f"/v1/events/{event_id}/whatsapp",
        json={"calls_enabled": True},
        headers=organizer,
    )

    # L'événement est dans 30 jours : pas encore de relance.
    assert run_db(plan_follow_ups) == (0, 0)

    # 6 jours avant l'événement (invitation partie avant J-7) : la relance est due, une seule fois.
    sql(
        f"UPDATE events SET starts_at = now() + interval '6 days' WHERE id = '{event_id}'"
    )
    sql(
        "UPDATE messages SET sent_at = now() - interval '20 days' WHERE sent_at IS NOT NULL"
    )
    assert run_db(plan_follow_ups) == (1, 0)
    assert deliver_next(provider) == "sent"
    assert "pas encore votre réponse" in str(provider.sent[-1]["text"])
    assert provider.sent[-1]["type"] == "text"  # pas de sondage
    assert run_db(plan_follow_ups) == (0, 0)

    # 2 jours après la relance restée sans réponse : appel de la conseillère, un seul.
    sql(
        "UPDATE messages SET sent_at = sent_at - interval '3 days' WHERE sent_at IS NOT NULL"
    )
    assert run_db(plan_follow_ups) == (0, 1)
    assert run_db(plan_follow_ups) == (0, 0)
    view = overview(client, organizer, event_id)
    assert view["reminders"]["sent"] == 1 and view["calls_scheduled"] == 1
    listed = client.get(f"/v1/events/{event_id}/guests", headers=organizer).json()
    konan = next(g for g in listed if g["display_name"] == "Jean Konan")
    assert konan["contact_status"] == "call_scheduled"

    # Relance à la demande : option payante, refusée tant qu'elle n'est pas activée.
    url = f"/v1/events/{event_id}/whatsapp/reminders"
    assert client.post(url, headers=organizer).status_code == 403
    monkeypatch.setattr(get_settings(), "whatsapp_on_demand_reminders", True)
    now = client.post(url, headers=organizer)
    assert now.status_code == 202 and now.json()["queued"] == 1
    # L'invité répond sur sa page : la relance ne part pas.
    client.post(
        f"/v1/invitations/{jean['invitation_token']}/response",
        json={"attending": False},
    )
    assert deliver_next(provider) is None
    assert overview(client, organizer, event_id)["reminders"]["canceled"] == 1
    assert client.post(url, headers=organizer).status_code == 409


@pytest.mark.db
def test_reminder_schedule_is_configurable(
    client: TestClient, organizer: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "whatsapp_reminder_days_before", "14, 7,2")
    assert get_settings().reminder_days_before == [14, 7, 2]
    event_id, _ = invited(client, organizer)
    client.post(f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer)
    provider = ConsoleProvider()
    deliver_next(provider)
    # Invitation partie 20 jours avant ; on est à J-5 : les relances de J-14 et J-7 sont dues.
    sql(
        f"UPDATE events SET starts_at = now() + interval '5 days' WHERE id = '{event_id}'"
    )
    sql(
        "UPDATE messages SET sent_at = now() - interval '15 days' WHERE sent_at IS NOT NULL"
    )
    assert run_db(plan_follow_ups) == (1, 0)
    deliver_next(provider)
    assert run_db(plan_follow_ups) == (1, 0)
    deliver_next(provider)
    assert run_db(plan_follow_ups) == (0, 0)  # J-2 pas encore atteint

    # Invitation partie après J-7 : pas de relance J-7 pour cet invité.
    event_late, _ = invited(client, organizer)
    sql(
        f"UPDATE events SET starts_at = now() + interval '5 days' WHERE id = '{event_late}'"
    )
    client.post(f"/v1/events/{event_late}/whatsapp/invitations", headers=organizer)
    deliver_next(provider)
    assert run_db(plan_follow_ups) == (0, 0)


class FailingProvider(ConsoleProvider):
    def __init__(self, *, retry: bool) -> None:
        super().__init__()
        self.retry = retry

    async def send_image(self, to: str, image_url: str, caption: str) -> SentMessage:
        raise ProviderError("Numéro absent de WhatsApp.", retry=self.retry)


@pytest.mark.db
def test_send_failures(client: TestClient, organizer: dict[str, str]) -> None:
    event_id, _ = invited(client, organizer)
    client.post(f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer)

    # Erreur passagère : le message revient dans la file, plus tard.
    assert deliver_next(FailingProvider(retry=True)) == "scheduled"
    assert deliver_next(ConsoleProvider()) is None  # pas encore dû
    sql("UPDATE messages SET scheduled_at = now() WHERE status = 'scheduled'")

    # Erreur définitive : échec, et l'invité devient injoignable.
    assert deliver_next(FailingProvider(retry=False)) == "failed"
    view = overview(client, organizer, event_id)
    assert view["invitations"]["failed"] == 1
    assert view["ready"] == 1  # l'organisateur peut renvoyer après correction
    listed = client.get(f"/v1/events/{event_id}/guests", headers=organizer).json()
    assert (
        next(g for g in listed if g["display_name"] == "Jean Konan")["contact_status"]
        == "unreachable"
    )


@pytest.mark.db
def test_pending_poll_from_before_is_not_resent(
    client: TestClient, organizer: dict[str, str]
) -> None:
    """Message en file dont la carte est déjà partie (son sondage attendait une reprise) :
    il passe à « envoyé » sans rien renvoyer, les sondages n'étant plus envoyés."""
    event_id, _ = invited(client, organizer)
    client.post(f"/v1/events/{event_id}/whatsapp/invitations", headers=organizer)
    sql(
        "UPDATE messages SET provider_message_id = 'carte-' || id"
        " WHERE status = 'scheduled' AND provider_message_id IS NULL"
    )

    provider = ConsoleProvider()
    assert deliver_next(provider) == "sent"
    assert provider.sent == []  # ni la carte ni un sondage
