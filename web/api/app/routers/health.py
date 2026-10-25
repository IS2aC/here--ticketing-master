from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.db import get_engine

router = APIRouter(tags=["santé"])


@router.get("/health")
async def health() -> JSONResponse:
    """Utilisé par le healthcheck Docker et par Dokploy."""
    try:
        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 — toute erreur de connexion = base indisponible
        return JSONResponse(
            {"status": "error", "database": "unreachable"}, status_code=503
        )
    return JSONResponse({"status": "ok", "database": "ok"})
