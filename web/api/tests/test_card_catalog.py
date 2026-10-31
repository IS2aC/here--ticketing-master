"""Catalogue des modèles Here! : fichiers valides, enregistrés en base au démarrage, servis par l'API."""

import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine

from app.catalog import EXAMPLE_PHOTO, load_catalog, sync_catalog
from app.config import get_settings

CODES = [
    "dot-wax",
    "anniversaire-fete",
    "festival-couleurs",
    "reunion-pro",
    "seminaire-conference",
]


def test_catalog_files_are_valid() -> None:
    entries = load_catalog()
    assert [e.code for e in entries] == CODES
    for entry in entries:
        assert EXAMPLE_PHOTO in entry.assets, entry.code
        photo = entry.assets[EXAMPLE_PHOTO]
        assert photo.content_type == "image/jpeg" and len(photo.content) < 300_000
        # Chaque champ a un exemple : la galerie montre une carte complète.
        assert all(f.get("example") for f in entry.definition["fields"]), entry.code


def sync_again() -> int:
    async def run() -> int:
        from sqlalchemy.ext.asyncio import async_sessionmaker

        engine = create_async_engine(get_settings().database_url)
        async with async_sessionmaker(engine)() as db:
            changed = await sync_catalog(db)
        await engine.dispose()
        return changed

    return asyncio.run(run())


@pytest.mark.db
def test_catalog_synced_and_listed(
    client: TestClient, organizer: dict[str, str]
) -> None:
    # Enregistré au démarrage : une nouvelle synchronisation ne change rien.
    assert sync_again() == 0

    assert client.get("/v1/card-templates").status_code == 401
    templates = client.get("/v1/card-templates", headers=organizer).json()
    assert [t["code"] for t in templates] == CODES
    dot = templates[0]
    assert dot["style"] == "wax_afro" and dot["event_types"] == ["dot", "mariage"]
    assert dot["assets"] == ["exemple-photo", "fond", "ornement-haut"]
    assert dot["definition"]["fields"][0]["key"] == "fiances"
    # Les modèles classiques (sans définition) ne sont pas dans le catalogue.
    assert "ceremonie" not in [t["code"] for t in templates]

    one = client.get("/v1/card-templates/festival-couleurs", headers=organizer).json()
    assert one["name"] == "Festival des couleurs" and one["assets"][0] == "eclats"
    assert (
        client.get("/v1/card-templates/ceremonie", headers=organizer).status_code == 404
    )

    by_type = client.get(
        "/v1/card-templates", params={"event_type": "reunion"}, headers=organizer
    ).json()
    assert [t["code"] for t in by_type] == ["reunion-pro", "seminaire-conference"]
    assert (
        client.get(
            "/v1/card-templates",
            params={"event_type": "funerailles"},
            headers=organizer,
        ).json()
        == []
    )


@pytest.mark.db
def test_template_assets_are_public(client: TestClient) -> None:
    photo = client.get("/v1/card-templates/dot-wax/assets/exemple-photo")
    assert photo.status_code == 200
    assert photo.headers["content-type"] == "image/jpeg"
    assert photo.headers["cache-control"] == "public, max-age=3600"
    assert photo.content[:2] == b"\xff\xd8"
    svg = client.get("/v1/card-templates/dot-wax/assets/fond")
    assert svg.headers["content-type"].startswith("image/svg+xml")
    assert b"currentColor" in svg.content
    assert client.get("/v1/card-templates/dot-wax/assets/inconnu").status_code == 404
    assert client.get("/v1/card-templates/inconnu/assets/fond").status_code == 404
