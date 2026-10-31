"""Catalogue des modèles de cartes Here! (app/card_catalog) : enregistré en base au démarrage de l'API.

Chaque dossier contient definition.json, ses ornements SVG (clé = nom du fichier) et exemple.jpg, la photo des
aperçus (clé « exemple-photo »). catalogue.json donne le nom, le style et les types d'événements de chaque modèle.
La synchronisation ne réécrit que ce qui a changé : modifier un fichier puis redéployer suffit.
"""

import io
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import cache
from pathlib import Path

from PIL import Image
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.card_templates import CardDefinition, ImageLayer
from app.models import CardAsset, CardStyle, CardTemplate, EventType

CATALOG_DIR = Path(__file__).parent / "card_catalog"
EXAMPLE_PHOTO = "exemple-photo"


@dataclass
class Asset:
    content_type: str
    content: bytes
    width: int | None = None
    height: int | None = None


@dataclass
class Entry:
    code: str
    name: str
    style: CardStyle
    event_types: list[EventType]
    definition: dict
    assets: dict[str, Asset]


@cache
def catalog_order() -> dict[str, int]:
    """Rang de chaque modèle dans catalogue.json : l'ordre de la galerie."""
    items = json.loads((CATALOG_DIR / "catalogue.json").read_text())
    return {item["code"]: i for i, item in enumerate(items)}


def load_catalog(directory: Path = CATALOG_DIR) -> list[Entry]:
    entries = []
    for item in json.loads((directory / "catalogue.json").read_text()):
        folder = directory / item["code"]
        raw = json.loads((folder / "definition.json").read_text())
        definition = CardDefinition.model_validate(raw)
        assets = {
            svg.stem: Asset("image/svg+xml", svg.read_bytes())
            for svg in sorted(folder.glob("*.svg"))
        }
        photo = folder / "exemple.jpg"
        if photo.exists():
            content = photo.read_bytes()
            width, height = Image.open(io.BytesIO(content)).size
            assets[EXAMPLE_PHOTO] = Asset("image/jpeg", content, width, height)
        missing = {
            layer.asset
            for layer in definition.layers
            if isinstance(layer, ImageLayer) and layer.asset not in assets
        }
        if missing:
            raise ValueError(f"{item['code']} : images absentes {sorted(missing)}")
        entries.append(
            Entry(
                code=item["code"],
                name=item["name"],
                style=CardStyle(item["style"]),
                event_types=[EventType(t) for t in item["event_types"]],
                definition=raw,
                assets=assets,
            )
        )
    return entries


async def sync_catalog(db: AsyncSession, entries: list[Entry] | None = None) -> int:
    """Crée ou met à jour les modèles du catalogue ; renvoie le nombre de modèles modifiés."""
    changed = 0
    for entry in entries if entries is not None else load_catalog():
        template = await db.scalar(
            select(CardTemplate).where(CardTemplate.code == entry.code)
        )
        if template is None:
            template = CardTemplate(code=entry.code, name=entry.name)
            db.add(template)
            await db.flush()
        fields = {
            "name": entry.name,
            "style": entry.style,
            "event_types": entry.event_types,
            "definition": entry.definition,
            "is_active": True,
        }
        dirty = any(getattr(template, k) != v for k, v in fields.items())
        for key, value in fields.items():
            setattr(template, key, value)

        stored = {
            a.key: a
            for a in await db.scalars(
                select(CardAsset).where(CardAsset.template_id == template.id)
            )
        }
        for key, asset in entry.assets.items():
            current = stored.get(key)
            if current is None:
                db.add(
                    CardAsset(
                        template_id=template.id,
                        key=key,
                        content_type=asset.content_type,
                        content=asset.content,
                        width=asset.width,
                        height=asset.height,
                    )
                )
                dirty = True
            elif current.content != asset.content:
                current.content_type = asset.content_type
                current.content = asset.content
                current.width, current.height = asset.width, asset.height
                dirty = True
        gone = set(stored) - set(entry.assets)
        if gone:
            await db.execute(
                delete(CardAsset).where(
                    CardAsset.template_id == template.id, CardAsset.key.in_(gone)
                )
            )
            dirty = True
        if dirty:
            template.updated_at = datetime.now(UTC)
            changed += 1
    await db.commit()
    return changed
