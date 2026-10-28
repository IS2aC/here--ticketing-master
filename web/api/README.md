# Here! · API (FastAPI)

Seul service qui accède à la base. Appelée par le frontend web et, plus tard, par l'application mobile.

- `GET /health` : santé (API + base), utilisé par Docker et Dokploy.
- `GET /v1` : toutes les routes métier sont versionnées sous `/v1`.
- Comptes : `POST /v1/auth/register`, `POST /v1/auth/login` (téléphone ou e-mail + mot de passe), `POST /v1/auth/logout`, `GET /v1/me`. Authentification par jeton `Authorization: Bearer <jeton>` (même mécanisme pour le web et le mobile).
- Événements (ceux de l'utilisateur connecté uniquement) : `GET /v1/events`, `POST /v1/events`, `GET /v1/events/{id}`, `PATCH /v1/events/{id}`. Chaque événement renvoie ses catégories d'invités et ses compteurs de réponses.
- Invités : `POST /v1/events/{id}/imports` (fichier .xlsx ou .csv → aperçu, rien n'est ajouté), `GET /v1/events/{id}/imports/{import_id}`, `POST /v1/events/{id}/imports/{import_id}/confirm` (ajoute les lignes importables), `GET /v1/events/{id}/guests`, `GET /v1/guests/import-template` (modèle Excel, public). Lecture et vérification des lignes : `app/guest_import.py`.
- Invitations : `POST /v1/events/{id}/invitations` (une invitation et un jeton de QR code par invité qui n'en a pas), `GET /v1/invitations/{jeton}` (public : la carte et la réponse de cet invité), `POST /v1/invitations/{jeton}/response` (public : présent ou non, nombre de personnes, mot pour l'hôte ; modifiable jusqu'au début de l'événement).
- Scan à l'entrée : `GET/POST /v1/events/{id}/scan-links`, `POST /v1/events/{id}/scan-links/{link_id}/revoke` (organisateur) ; `GET /v1/scan/{jeton}`, `POST /v1/scan/{jeton}/check` (QR code lu, code `INV-…` ou invité choisi), `GET /v1/scan/{jeton}/guests?q=` (publics, jeton du lien de scan).
- Envoi WhatsApp (organisateur) : `GET /v1/events/{id}/whatsapp` (suivi), `PATCH /v1/events/{id}/whatsapp` (relances automatiques, appels), `POST /v1/events/{id}/whatsapp/invitations` et `POST /v1/events/{id}/whatsapp/reminders` (mise en file, 202). L'envoi est fait par le worker (`python -m app.worker`, `app/worker.py`), via le connecteur `app/whatsapp` (`console` ou `wasender`). Logique : `app/messaging.py`.
- `POST /v1/webhooks/wasender` : webhooks WasenderAPI (statuts, votes au sondage, messages des invités), protégés par `X-Webhook-Signature`.
- `GET /docs` : documentation interactive (désactivable avec `DOCS_ENABLED=false`).

Variables : `DATABASE_URL` (obligatoire), `CORS_ORIGINS` (origines navigateur séparées par des virgules), `DOCS_ENABLED`, `SESSION_TTL_DAYS` (30 par défaut), `PUBLIC_APP_URL`, et l'envoi WhatsApp : `WHATSAPP_PROVIDER`, `WASENDER_API_KEY`, `WASENDER_WEBHOOK_SECRET`, `WHATSAPP_*` (cadence, relances ; voir `../.env.example`).

Le schéma de la base est géré par les migrations SQL de [../db/migrations](../db/migrations), pas par l'API.

```bash
uv sync
DATABASE_URL=postgres://here:changez-moi@localhost:5433/here uv run uvicorn app.main:app --reload
uv run pytest                     # tests unitaires
TEST_DATABASE_URL=postgres://here:here@localhost:5433/here_test uv run pytest   # + tests avec base (la base est vidée)
uv run ruff check . && uv run ruff format --check .
```
