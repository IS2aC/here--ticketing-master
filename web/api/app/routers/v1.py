from fastapi import APIRouter

from app.routers import auth

# Toutes les routes métier (web et mobile) vivent sous /v1.
router = APIRouter(prefix="/v1")


@router.get("", tags=["méta"])
async def root() -> dict[str, str]:
    return {"name": "Here! API", "version": "v1"}


router.include_router(auth.router)
