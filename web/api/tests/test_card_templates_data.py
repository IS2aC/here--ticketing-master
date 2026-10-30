"""Modèles de cartes par type d'événement (étape 1) : tables, contraintes, correspondance ORM, migration réversible."""

import asyncio
import json
import re
from pathlib import Path

import asyncpg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings
from app.models import (
    CardAsset,
    CardFormat,
    CardStatus,
    CardStyle,
    CardTemplate,
    EventCard,
    EventType,
)
from tests.conftest import MIGRATIONS, TEST_DATABASE_URL
from tests.test_guest_response import invited

pytestmark = pytest.mark.db

MIGRATION = MIGRATIONS / "20261112000000_card_templates_v2.sql"
CLASSICS = ["ceremonie", "hommage", "officiel", "rendez_vous", "soiree"]
SVG = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>'


def run(work):
    """Exécute `work(conn)` sur une connexion à la base de test."""

    async def main():
        conn = await asyncpg.connect(TEST_DATABASE_URL)
        try:
            return await work(conn)
        finally:
            await conn.close()

    return asyncio.run(main())


def new_template(conn: asyncpg.Connection, code: str, **columns: object):
    names = ", ".join(["code", "name", *columns])
    marks = ", ".join(f"${i}" for i in range(1, len(columns) + 3))
    return conn.fetchval(
        f"INSERT INTO card_templates ({names}) VALUES ({marks}) RETURNING id",
        code,
        code.title(),
        *columns.values(),
    )


def test_classic_templates_kept(client: TestClient) -> None:
    async def work(conn):
        return await conn.fetch(
            "SELECT code, definition, event_types, style FROM card_templates "
            "WHERE code = ANY($1) ORDER BY code",
            CLASSICS,
        )

    rows = run(work)
    assert [r["code"] for r in rows] == CLASSICS
    assert all(
        r["definition"] is None and r["event_types"] == [] and r["style"] is None
        for r in rows
    )


def test_template_catalog_by_event_type(client: TestClient) -> None:
    definition = {"formats": ["whatsapp_4_5", "print_a5"], "fields": [], "layers": []}

    async def work(conn):
        dot = await new_template(
            conn,
            "test-dot-wax",
            event_types=["dot", "mariage"],
            style="wax_afro",
            definition=json.dumps(definition),
        )
        await new_template(conn, "test-anniv", event_types=["anniversaire"])
        found = await conn.fetch(
            "SELECT code FROM card_templates WHERE event_types @> ARRAY['dot']::event_type[]"
        )
        with pytest.raises(asyncpg.InvalidTextRepresentationError):
            await new_template(conn, "test-bad-style", style="paillettes")
        with pytest.raises(asyncpg.InvalidTextRepresentationError):
            await new_template(conn, "test-bad-type", event_types=["mariage_civil"])
        return dot, [r["code"] for r in found]

    dot, codes = run(work)
    assert codes == ["test-dot-wax"]

    async def orm():
        engine = create_async_engine(get_settings().database_url)
        async with engine.connect() as conn:
            template = (
                await conn.execute(select(CardTemplate).where(CardTemplate.id == dot))
            ).one()
        await engine.dispose()
        return template

    template = asyncio.run(orm())
    assert template.event_types == [EventType.dot, EventType.mariage]
    assert template.style is CardStyle.wax_afro
    assert template.definition == definition


def test_event_card_defaults_and_one_card_per_category(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id, _ = invited(client, organizer)

    async def work(conn):
        card = await conn.fetchrow(
            "SELECT * FROM event_cards WHERE event_id = $1 AND category_id IS NULL",
            event_id,
        )
        category = await conn.fetchval(
            "SELECT id FROM guest_categories WHERE event_id = $1 AND name = 'VIP'",
            event_id,
        )
        # Une carte par catégorie en plus de la carte par défaut ; jamais deux pour la même.
        insert = (
            "INSERT INTO event_cards (event_id, category_id, template_id) "
            "VALUES ($1, $2, $3) RETURNING id"
        )
        vip = await conn.fetchval(insert, event_id, category, card["template_id"])
        with pytest.raises(asyncpg.UniqueViolationError):
            await conn.fetchval(insert, event_id, category, card["template_id"])
        with pytest.raises(asyncpg.UniqueViolationError):
            await conn.fetchval(insert, event_id, None, card["template_id"])
        return card, vip

    card, vip = run(work)
    assert card["field_values"] == "{}" and card["theme_overrides"] == "{}"
    assert (card["format"], card["status"]) == ("whatsapp_4_5", "draft")

    async def orm():
        engine = create_async_engine(get_settings().database_url)
        async with engine.connect() as conn:
            row = (
                await conn.execute(select(EventCard).where(EventCard.id == vip))
            ).one()
        await engine.dispose()
        return row

    row = asyncio.run(orm())
    assert row.format is CardFormat.whatsapp_4_5
    assert row.status is CardStatus.draft
    assert row.field_values == {} and row.created_at is not None


def test_card_assets_belong_to_one_owner(
    client: TestClient, organizer: dict[str, str]
) -> None:
    event_id, _ = invited(client, organizer)
    insert = (
        "INSERT INTO card_assets (template_id, event_card_id, key, content_type, content) "
        "VALUES ($1, $2, $3, $4, $5) RETURNING id"
    )

    async def work(conn):
        template = await new_template(conn, "test-assets")
        # Carte de la catégorie VIP : la carte par défaut est liée aux invitations.
        card = await conn.fetchval(
            "INSERT INTO event_cards (event_id, category_id, template_id) "
            "SELECT event_id, id, $2 FROM guest_categories "
            "WHERE event_id = $1 AND name = 'VIP' RETURNING id",
            event_id,
            template,
        )
        await conn.fetchval(insert, template, None, "fond", "image/svg+xml", SVG)
        await conn.fetchval(insert, None, card, "photo", "image/png", b"png")
        # Même clé pour un autre propriétaire : permis.
        await conn.fetchval(insert, None, card, "fond", "image/svg+xml", SVG)
        with pytest.raises(asyncpg.UniqueViolationError):
            await conn.fetchval(insert, template, None, "fond", "image/png", b"png")
        with pytest.raises(asyncpg.CheckViolationError):  # ni modèle ni carte
            await conn.fetchval(insert, None, None, "fond", "image/png", b"png")
        with pytest.raises(asyncpg.CheckViolationError):  # les deux
            await conn.fetchval(insert, template, card, "autre", "image/png", b"png")
        with pytest.raises(asyncpg.CheckViolationError):
            await conn.fetchval(insert, template, None, "Fond Doré", "image/png", b"x")
        with pytest.raises(asyncpg.CheckViolationError):
            await conn.fetchval(insert, template, None, "pdf", "application/pdf", b"x")

        # Les images suivent leur modèle ou leur carte.
        await conn.execute("DELETE FROM event_cards WHERE id = $1", card)
        await conn.execute("DELETE FROM card_templates WHERE id = $1", template)
        return await conn.fetchval(
            "SELECT count(*) FROM card_assets WHERE template_id = $1 OR event_card_id = $2",
            template,
            card,
        )

    assert run(work) == 0
    assert CardAsset.__table__.c.keys() == [
        "id",
        "template_id",
        "event_card_id",
        "key",
        "content_type",
        "content",
        "width",
        "height",
        "created_at",
    ]


def sections(path: Path) -> tuple[str, str]:
    up, down = re.split(r"^-- migrate:down", path.read_text(), flags=re.MULTILINE)
    return up, down


def test_migration_is_reversible(client: TestClient) -> None:
    up, down = sections(MIGRATION)

    async def columns(conn, table):
        rows = await conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
            table,
        )
        return {r["column_name"] for r in rows}

    async def work(conn):
        tx = conn.transaction()
        await tx.start()
        try:
            await conn.execute(down)
            after_down = (
                await columns(conn, "card_templates"),
                await columns(conn, "event_cards"),
                await conn.fetchval("SELECT to_regclass('card_assets')"),
                await conn.fetchval("SELECT to_regtype('card_style')"),
            )
            await conn.execute(up)  # rejouable après le retour en arrière
            after_up = await columns(conn, "event_cards")
        finally:
            await tx.rollback()  # la base de test reste migrée
        return after_down, after_up

    (templates, cards, assets, style), cards_up = run(work)
    assert "definition" not in templates and "event_types" not in templates
    assert {"field_values", "status", "format"}.isdisjoint(cards)
    assert {"title", "layout", "palette"} <= cards  # rien d'antérieur n'est touché
    assert assets is None and style is None
    assert {"field_values", "status", "format"} <= cards_up
