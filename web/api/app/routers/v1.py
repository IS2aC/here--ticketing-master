from fastapi import APIRouter

from app.routers import (
    admin,
    auth,
    events,
    guests,
    invitations,
    questions,
    scan,
    support,
    webhooks,
    whatsapp,
)

# Toutes les routes métier (web et mobile) vivent sous /v1.
router = APIRouter(prefix="/v1")


@router.get("", tags=["méta"])
async def root() -> dict[str, str]:
    return {"name": "Here! API", "version": "v1"}


router.include_router(auth.router)
router.include_router(events.router)
router.include_router(guests.router)
router.include_router(invitations.router)
router.include_router(scan.router)
router.include_router(whatsapp.router)
router.include_router(webhooks.router)
router.include_router(admin.router)
router.include_router(support.router)
router.include_router(questions.router)
