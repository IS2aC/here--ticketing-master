"""« Une question ? » : assistant branchable, transmission à l'équipe Here!, réponses de l'équipe."""

import asyncio
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import assistant
from app.assistant import AssistantReply
from app.config import get_settings
from tests.test_guest_response import sql

pytestmark = pytest.mark.db


def staff(client: TestClient, phone: str) -> dict[str, str]:
    token = client.post(
        "/v1/auth/register",
        json={
            "first_name": "Mariam",
            "last_name": "Coulibaly",
            "phone": phone,
            "password": "mot-de-passe",
        },
    ).json()["access_token"]
    sql(f"UPDATE users SET role = 'support' WHERE phone = '+225{phone}'")
    return {"Authorization": f"Bearer {token}"}


def test_without_assistant_the_team_answers(
    client: TestClient, organizer: dict[str, str]
) -> None:
    team = staff(client, "0788100001")
    assert client.get("/v1/support", headers=organizer).json() is None

    asked = client.post(
        "/v1/support/messages",
        json={"body": "Comment payer l'option rappel la veille ?"},
        headers=organizer,
    ).json()
    assert asked["status"] == "waiting"  # pas d'assistant : transmise à l'équipe
    assert [m["author"] for m in asked["messages"]] == ["organizer", "assistant"]
    assert "équipe Here!" in asked["messages"][-1]["body"]

    # L'équipe la voit et répond.
    assert client.get("/v1/admin/questions", headers=organizer).status_code == 403
    page = client.get("/v1/admin/questions", headers=team).json()
    thread = next(t for t in page["items"] if t["id"] == asked["id"])
    assert thread["organizer_name"] == "Test Organisateur"
    answered = client.post(
        f"/v1/admin/questions/{asked['id']}/reply",
        json={"body": "Bonjour, je vous active l'option dès aujourd'hui."},
        headers=team,
    ).json()
    assert answered["status"] == "answered"
    mine = client.get("/v1/support", headers=organizer).json()
    assert mine["messages"][-1]["author"] == "staff"
    assert mine["messages"][-1]["staff_name"] == "Mariam"

    # L'organisateur répond : l'équipe suit la discussion (pas l'assistant).
    again = client.post(
        "/v1/support/messages", json={"body": "Merci beaucoup !"}, headers=organizer
    ).json()
    assert again["status"] == "waiting"

    # « Nouvelle question » : la discussion est terminée, la suivante repart de zéro.
    assert client.post("/v1/support/close", headers=organizer).status_code == 204
    assert client.get("/v1/support", headers=organizer).json() is None


def test_assistant_answers_or_hands_over(
    client: TestClient, organizer: dict[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    replies = [
        AssistantReply(
            "Cliquez sur « Ajouter un invité » sur la page de l'événement.", False
        ),
        AssistantReply("L'équipe Here! va vous répondre ici.", True),
    ]
    seen: list[list[dict]] = []

    async def fake(conversation_id, organizer_info, messages):
        seen.append(messages)
        return replies.pop(0)

    monkeypatch.setattr(assistant, "ask", fake)
    first = client.post(
        "/v1/support/messages",
        json={"body": "Comment ajouter un invité oublié ?"},
        headers=organizer,
    ).json()
    assert first["status"] == "assistant"
    assert first["messages"][-1]["body"].startswith("Cliquez sur")
    second = client.post(
        "/v1/support/messages",
        json={"body": "Et pour une facture ?"},
        headers=organizer,
    ).json()
    assert second["status"] == "waiting"  # l'assistant transmet
    assert [m["role"] for m in seen[1]] == [
        "user",
        "assistant",
        "user",
    ]  # tout l'historique

    # « Parler à l'équipe » sur une discussion où l'assistant répond.
    client.post("/v1/support/close", headers=organizer)
    replies.append(AssistantReply("Voici la réponse.", False))
    client.post(
        "/v1/support/messages", json={"body": "Une question"}, headers=organizer
    )
    handed = client.post("/v1/support/escalate", headers=organizer).json()
    assert handed["status"] == "waiting"


def test_messages_are_limited(client: TestClient, organizer: dict[str, str]) -> None:
    for _ in range(30):
        client.post("/v1/support/messages", json={"body": "?"}, headers=organizer)
    limited = client.post("/v1/support/messages", json={"body": "?"}, headers=organizer)
    assert limited.status_code == 429


def test_openai_compatible_connector(monkeypatch: pytest.MonkeyPatch) -> None:
    """Agent compatible OpenAI (par exemple Nemotron hébergé) : [EQUIPE] transmet à l'équipe."""
    settings = get_settings()
    monkeypatch.setattr(settings, "assistant_provider", "openai")
    monkeypatch.setattr(settings, "assistant_base_url", "https://agent.example/v1")
    monkeypatch.setattr(settings, "assistant_model", "nemotron")
    sent: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        sent.append({"url": str(request.url), **body})
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "[EQUIPE] Je transmets."}}]},
        )

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        assistant.httpx,
        "AsyncClient",
        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
    )
    reply = asyncio.run(
        assistant.ask(
            "c1", {"first_name": "Aya"}, [{"role": "user", "content": "Tarif ?"}]
        )
    )
    assert reply == AssistantReply("Je transmets.", True)
    assert sent[0]["url"] == "https://agent.example/v1/chat/completions"
    assert sent[0]["model"] == "nemotron"
    assert sent[0]["messages"][0]["role"] == "system"

    # Erreur de l'agent : pas de réponse (la question ira à l'équipe).
    monkeypatch.setattr(
        assistant.httpx,
        "AsyncClient",
        lambda **kw: real_client(
            transport=httpx.MockTransport(lambda r: httpx.Response(500)), **kw
        ),
    )
    assert asyncio.run(assistant.ask("c1", {}, [])) is None
