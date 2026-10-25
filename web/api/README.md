# Here! · API (FastAPI)

Seul service qui accède à la base. Appelée par le frontend web et, plus tard, par l'application mobile.

- `GET /health` : santé (API + base), utilisé par Docker et Dokploy.
- `GET /v1` : toutes les routes métier sont versionnées sous `/v1`.
- Comptes : `POST /v1/auth/register`, `POST /v1/auth/login` (téléphone ou e-mail + mot de passe), `POST /v1/auth/logout`, `GET /v1/me`. Authentification par jeton `Authorization: Bearer <jeton>` (même mécanisme pour le web et le mobile).
- Événements (ceux de l'utilisateur connecté uniquement) : `GET /v1/events`, `POST /v1/events`, `GET /v1/events/{id}`, `PATCH /v1/events/{id}`. Chaque événement renvoie ses catégories d'invités et ses compteurs de réponses.
- Invités : `POST /v1/events/{id}/imports` (fichier .xlsx ou .csv → aperçu, rien n'est ajouté), `GET /v1/events/{id}/imports/{import_id}`, `POST /v1/events/{id}/imports/{import_id}/confirm` (ajoute les lignes importables), `GET /v1/events/{id}/guests`, `GET /v1/guests/import-template` (modèle Excel, public). Lecture et vérification des lignes : `app/guest_import.py`.
- Invitations : `POST /v1/events/{id}/invitations` (une invitation et un jeton de QR code par invité qui n'en a pas), `GET /v1/invitations/{jeton}` (public : uniquement ce qui figure sur la carte).
- `GET /docs` : documentation interactive (désactivable avec `DOCS_ENABLED=false`).

Variables : `DATABASE_URL` (obligatoire), `CORS_ORIGINS` (origines navigateur séparées par des virgules), `DOCS_ENABLED`, `SESSION_TTL_DAYS` (30 par défaut).

Le schéma de la base est géré par les migrations SQL de [../db/migrations](../db/migrations), pas par l'API.

```bash
uv sync
DATABASE_URL=postgres://here:changez-moi@localhost:5433/here uv run uvicorn app.main:app --reload
uv run pytest                     # tests unitaires
TEST_DATABASE_URL=postgres://here:here@localhost:5433/here_test uv run pytest   # + tests avec base (la base est vidée)
uv run ruff check . && uv run ruff format --check .
```
