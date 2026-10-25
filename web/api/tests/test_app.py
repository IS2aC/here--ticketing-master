import os

os.environ.setdefault("DATABASE_URL", "postgres://here:here@127.0.0.1:1/here")

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app

client = TestClient(app)


def test_v1_root() -> None:
    response = client.get("/v1")
    assert response.status_code == 200
    assert response.json() == {"name": "Here! API", "version": "v1"}


def test_health_without_database() -> None:
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json()["database"] == "unreachable"


def test_database_url_uses_asyncpg() -> None:
    settings = Settings(database_url="postgres://u:p@db:5432/here")
    assert settings.database_url == "postgresql+asyncpg://u:p@db:5432/here"
