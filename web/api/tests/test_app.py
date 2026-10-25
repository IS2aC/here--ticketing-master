import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.phone import normalize_phone


def test_v1_root(client: TestClient) -> None:
    response = client.get("/v1")
    assert response.status_code == 200
    assert response.json() == {"name": "Here! API", "version": "v1"}


@pytest.mark.db
def test_health(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok", "database": "ok"}


def test_database_url_uses_asyncpg() -> None:
    settings = Settings(database_url="postgres://u:p@db:5432/here")
    assert settings.database_url == "postgresql+asyncpg://u:p@db:5432/here"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("07 00 00 00 01", "+2250700000001"),
        ("+225 07.00.00.00.01", "+2250700000001"),
        ("00221 77 123 45 67", "+221771234567"),
        ("0700", None),
        ("bonjour", None),
    ],
)
def test_normalize_phone(raw: str, expected: str | None) -> None:
    assert normalize_phone(raw) == expected
