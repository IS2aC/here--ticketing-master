"""Assistant de « Une question ? » : répond aux organisateurs, ou transmet la question à l'équipe Here!.

Branchable par ASSISTANT_PROVIDER, sans toucher au reste de l'API :
- none (par défaut) : pas de réponse automatique, chaque question va à l'équipe ;
- openai : API compatible OpenAI (POST {ASSISTANT_BASE_URL}/chat/completions), par exemple un agent hébergé
  qui sert un modèle comme Nemotron. L'assistant transmet à l'équipe en commençant sa réponse par [EQUIPE] ;
- webhook : POST {ASSISTANT_BASE_URL} avec {"conversation_id", "organizer", "messages": [{"role", "content"}]},
  réponse attendue {"reply": "…", "escalate": false}.
Une erreur ou un délai dépassé : la question va à l'équipe (l'organisateur n'est jamais sans réponse).
"""

import logging
from dataclasses import dataclass

import httpx

from app.config import get_settings

log = logging.getLogger("here.assistant")

ESCALATE = "[EQUIPE]"

SYSTEM_PROMPT = f"""Tu es l'assistant de Here!, une plateforme ivoirienne d'invitations et de billetterie
pour les événements privés (mariages, dots, baptêmes, funérailles, anniversaires, séminaires…).
Tu réponds aux organisateurs qui utilisent le tableau de bord, en français, au vouvoiement, en phrases
courtes et concrètes (3 à 6 phrases), sans jargon, sans emoji.

Ce que fait Here! :
- Créer un événement (bouton « Créer un événement ») : type, date, heure, lieu, date limite de réponse.
- Importer la liste d'invités (fichier Excel ou CSV : Nom, Prénoms, Numéro, Catégorie, Position, Nb pers.)
  ou ajouter un invité à la main (« Ajouter un invité » sur la page de l'événement). Les lignes à vérifier
  se corrigent dans l'aperçu (« Corriger »).
- La carte d'invitation est préparée automatiquement selon le type d'événement, avec le nom de chaque
  invité et son QR code d'entrée (« Carte d'invitation »).
- Les invitations partent sur WhatsApp (« Lancer les invitations »), une à une, de 8 h à 20 h. Chaque invité
  répond sur sa page (oui / non, nombre de personnes).
- Relances : une relance offerte 7 jours avant l'événement aux invités sans réponse ; l'organisateur peut
  choisir d'autres dates sur la page Relances. Après la dernière relance, une conseillère peut appeler.
- Contrôle d'accès : des liens de scan pour les agents d'accueil, sur n'importe quel téléphone. Seuls les
  invités confirmés entrent. L'option « Gérer les entrées et sorties » (page de l'événement) affiche
  « Déjà entré » au second scan.
- Options payantes, activées par l'équipe Here! : « Relancer maintenant » et le rappel la veille.

Règles :
- N'invente jamais une fonction, un prix ou un délai. Si tu ne sais pas, dis-le.
- Commence ta réponse par {ESCALATE} (puis une phrase pour dire que l'équipe Here! va répondre ici)
  quand : la question porte sur un paiement, une facture, un tarif, une option payante à activer, un bug,
  un accès au compte, la suppression de données ; ou quand l'organisateur demande à parler à quelqu'un ;
  ou quand tu n'es pas sûr de la réponse."""


@dataclass(frozen=True)
class AssistantReply:
    text: str  # vide si l'assistant n'a rien à ajouter
    escalate: bool  # transmettre à l'équipe Here!


def _split(text: str) -> AssistantReply:
    text = text.strip()
    if ESCALATE in text:
        return AssistantReply(text.replace(ESCALATE, "").strip(), escalate=True)
    return AssistantReply(text, escalate=False)


async def ask(
    conversation_id: str,
    organizer: dict[str, str | None],
    messages: list[dict[str, str]],
) -> AssistantReply | None:
    """`messages` : [{"role": "user" | "assistant", "content": …}]. None : pas d'assistant ou erreur."""
    settings = get_settings()
    if settings.assistant_provider == "none" or not settings.assistant_base_url:
        return None
    headers = (
        {"Authorization": f"Bearer {settings.assistant_api_key}"}
        if settings.assistant_api_key
        else {}
    )
    try:
        async with httpx.AsyncClient(
            timeout=settings.assistant_timeout_seconds, headers=headers
        ) as client:
            if settings.assistant_provider == "openai":
                response = await client.post(
                    settings.assistant_base_url.rstrip("/") + "/chat/completions",
                    json={
                        "model": settings.assistant_model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            *messages,
                        ],
                        "temperature": 0.3,
                        "max_tokens": 500,
                    },
                )
                response.raise_for_status()
                return _split(response.json()["choices"][0]["message"]["content"])
            response = await client.post(
                settings.assistant_base_url,
                json={
                    "conversation_id": conversation_id,
                    "organizer": organizer,
                    "messages": messages,
                },
            )
            response.raise_for_status()
            data = response.json()
            reply = _split(str(data.get("reply") or ""))
            return AssistantReply(
                reply.text, reply.escalate or bool(data.get("escalate"))
            )
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        log.exception("Assistant indisponible : la question va à l'équipe Here!.")
        return None
