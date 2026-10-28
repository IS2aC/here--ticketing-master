"""WasenderAPI (https://wasenderapi.com/api-docs) : session WhatsApp reliée comme appareil connecté.

- Envoi : POST /send-message ({to, text, imageUrl} ou {to, poll}) → {"data": {"msgId": 123, ...}}.
- Les webhooks identifient les messages par key.id (WhatsApp) : on le lit avec GET /messages/{msgId}/info.
- La cadence anti-blocage est à notre charge (voir app/worker.py) : WasenderAPI ne ralentit pas les envois.
"""

from typing import Any

import httpx

from app.whatsapp.base import ProviderError, SentMessage


class WasenderProvider:
    name = "wasender"

    def __init__(self, base_url: str, api_key: str, *, timeout: float = 20) -> None:
        self._api_key = api_key
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/") + "/",
            timeout=timeout,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Accept": "application/json",
            },
        )

    @property
    def configured(self) -> bool:
        return bool(self._api_key)

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        if not self.configured:
            raise ProviderError(
                "Clé WasenderAPI absente (WASENDER_API_KEY).", retry=False
            )
        try:
            response = await self._client.request(method, path, **kwargs)
        except httpx.HTTPError as error:
            raise ProviderError(
                f"WasenderAPI injoignable : {error}", retry=True
            ) from error
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        if response.status_code == 429 or response.status_code >= 500:
            raise ProviderError(
                f"WasenderAPI {response.status_code} : {payload.get('message', response.text[:200])}",
                retry=True,
            )
        if response.status_code >= 400 or payload.get("success") is False:
            raise ProviderError(
                f"WasenderAPI {response.status_code} : {payload.get('message', response.text[:200])}",
                retry=False,
            )
        return payload

    async def _send(self, body: dict[str, Any]) -> SentMessage:
        payload = await self._request("POST", "send-message", json=body)
        msg_id = (payload.get("data") or {}).get("msgId")
        if msg_id is None:
            raise ProviderError("WasenderAPI : réponse sans msgId.", retry=False)
        return SentMessage(provider_id=str(msg_id))

    async def send_image(self, to: str, image_url: str, caption: str) -> SentMessage:
        return await self._send({"to": to, "text": caption, "imageUrl": image_url})

    async def send_text(self, to: str, text: str) -> SentMessage:
        return await self._send({"to": to, "text": text})

    async def send_poll(
        self, to: str, question: str, options: list[str]
    ) -> SentMessage:
        return await self._send(
            {
                "to": to,
                "poll": {
                    "question": question,
                    "options": options,
                    "multiSelect": False,
                },
            }
        )

    async def whatsapp_id(self, provider_id: str) -> str | None:
        payload = await self._request("GET", f"messages/{provider_id}/info")
        data = payload.get("data") or {}
        return (data.get("key") or {}).get("id") or data.get("id")
