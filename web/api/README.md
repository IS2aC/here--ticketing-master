# Here! · API (FastAPI)

Seul service qui accède à la base. Appelée par le frontend web et, plus tard, par l'application mobile.

- `GET /health` : santé (API + base), utilisé par Docker et Dokploy.
- `GET /v1` : toutes les routes métier sont versionnées sous `/v1`.
- `GET /docs` : documentation interactive (désactivable avec `DOCS_ENABLED=false`).

Variables : `DATABASE_URL` (obligatoire), `CORS_ORIGINS` (origines navigateur séparées par des virgules), `DOCS_ENABLED`.

Le schéma de la base est géré par les migrations SQL de [../db/migrations](../db/migrations), pas par l'API.

```bash
uv sync
DATABASE_URL=postgres://here:changez-moi@localhost:5433/here uv run uvicorn app.main:app --reload
uv run pytest
uv run ruff check . && uv run ruff format --check .
```
