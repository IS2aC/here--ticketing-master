"""Les tests marqués `db` utilisent une vraie base PostgreSQL, vidée puis migrée à chaque session de tests.

    TEST_DATABASE_URL=postgres://here:here@localhost:5433/here_test uv run pytest

Sans TEST_DATABASE_URL, ces tests sont ignorés.
"""

import asyncio
import os
import re
from collections.abc import Iterator
from pathlib import Path

import asyncpg
import pytest
from fastapi.testclient import TestClient

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
os.environ["DATABASE_URL"] = (
    TEST_DATABASE_URL or "postgres://here:here@127.0.0.1:1/here"
)

MIGRATIONS = Path(__file__).resolve().parents[2] / "db" / "migrations"


def _up_section(sql: str) -> str:
    return re.split(r"^-- migrate:down", sql, flags=re.MULTILINE)[0]


async def _reset_database(url: str) -> None:
    conn = await asyncpg.connect(url)
    try:
        await conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        for path in sorted(MIGRATIONS.glob("*.sql")):
            await conn.execute(_up_section(path.read_text()))
    finally:
        await conn.close()


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    if TEST_DATABASE_URL:
        return
    skip = pytest.mark.skip(reason="TEST_DATABASE_URL non définie")
    for item in items:
        if "db" in item.keywords:
            item.add_marker(skip)


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    if TEST_DATABASE_URL:
        asyncio.run(_reset_database(TEST_DATABASE_URL))
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
