from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.auth import CurrentAuth, DbSession
from app.catalog import catalog_order
from app.models import CardAsset, CardTemplate, EventType
from app.schemas import CardTemplateOut

# Modèles de cartes du catalogue Here! (voir app/catalog.py).
router = APIRouter(prefix="/card-templates", tags=["cartes"])


def _catalog():
    return select(CardTemplate).where(
        CardTemplate.is_active,
        CardTemplate.definition.is_not(None),
        CardTemplate.owner_user_id.is_(None),
    )


async def _out(db: DbSession, templates: list[CardTemplate]) -> list[CardTemplateOut]:
    keys: dict = {}
    for asset in await db.execute(
        select(CardAsset.template_id, CardAsset.key).where(
            CardAsset.template_id.in_([t.id for t in templates])
        )
    ):
        keys.setdefault(asset.template_id, []).append(asset.key)
    return [
        CardTemplateOut(
            id=t.id,
            code=t.code,
            name=t.name,
            style=t.style,
            event_types=t.event_types,
            definition=t.definition,
            assets=sorted(keys.get(t.id, [])),
        )
        for t in templates
    ]


@router.get("")
async def list_templates(
    auth: CurrentAuth, db: DbSession, event_type: EventType | None = None
) -> list[CardTemplateOut]:
    """Modèles actifs ; avec `event_type`, ceux proposés pour ce type d'événement."""
    query = _catalog()
    if event_type:
        query = query.where(
            CardTemplate.event_types.contains([event_type])
            | (CardTemplate.event_types == [])
        )
    order = catalog_order()
    templates = sorted(
        await db.scalars(query), key=lambda t: (order.get(t.code, len(order)), t.code)
    )
    return await _out(db, templates)


@router.get("/{code}")
async def get_template(code: str, auth: CurrentAuth, db: DbSession) -> CardTemplateOut:
    template = await db.scalar(_catalog().where(CardTemplate.code == code))
    if template is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Modèle introuvable.")
    return (await _out(db, [template]))[0]


@router.get("/{code}/assets/{key}")
async def template_asset(code: str, key: str, db: DbSession) -> Response:
    """Image d'un modèle : publique, comme les modèles eux-mêmes (cartes des invités, aperçus)."""
    asset = await db.scalar(
        select(CardAsset)
        .join(CardTemplate, CardTemplate.id == CardAsset.template_id)
        .where(CardTemplate.code == code, CardAsset.key == key)
    )
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Image introuvable.")
    return Response(
        asset.content,
        media_type=asset.content_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )
