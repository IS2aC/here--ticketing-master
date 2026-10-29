import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import dispose_engine, get_session
from app.platform import refresh_settings
from app.routers import health, v1


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    try:
        async for db in get_session():
            await refresh_settings(db)
    except (
        Exception
    ):  # base indisponible : l'API démarre avec les réglages de l'environnement
        logging.getLogger("here.api").exception(
            "Réglages du portail admin non chargés."
        )
    yield
    await dispose_engine()


# Journaux de l'application (« here.* ») : uvicorn n'affiche que les siens. En mode test (console),
# c'est là qu'apparaissent les messages WhatsApp simulés, dont les codes de mot de passe oublié.
_log = logging.getLogger("here")
if not _log.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(
        logging.Formatter("%(asctime)s %(name)s %(levelname)s %(message)s")
    )
    _log.addHandler(_handler)
    _log.setLevel(logging.INFO)

settings = get_settings()

app = FastAPI(
    title="Here! API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(health.router)
app.include_router(v1.router)
