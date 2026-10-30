import io
import secrets
import uuid
from collections import Counter

from fastapi import APIRouter, HTTPException, Response, UploadFile, status
from openpyxl import Workbook
from openpyxl.styles import Font
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentAuth, DbSession
from app.guest_import import (
    DEFAULT_CATEGORY,
    FIELD_LABELS,
    IMPORTED,
    MAX_FILE_BYTES,
    CheckedRow,
    ImportFileError,
    RowStatus,
    check_rows,
    guest_key,
    parse_file,
    rows_from_json,
    rows_to_json,
)
from app.models import (
    Event,
    Guest,
    GuestCategory,
    GuestImport,
    ImportStatus,
    Invitation,
)
from app.phone import normalize_phone
from app.routers.events import owned_event
from app.schemas import (
    GuestIn,
    GuestOut,
    ImportColumnOut,
    ImportOut,
    ImportRowIn,
    ImportRowOut,
    ImportSummary,
)

router = APIRouter(tags=["invités"])

IMPORT_NOT_FOUND = HTTPException(
    status.HTTP_404_NOT_FOUND, detail="Import introuvable."
)


async def _categories(db: AsyncSession, event_id: uuid.UUID) -> list[GuestCategory]:
    return list(
        await db.scalars(
            select(GuestCategory).where(GuestCategory.event_id == event_id)
        )
    )


async def _check(db: AsyncSession, imp: GuestImport) -> list[CheckedRow]:
    categories = [c.name for c in await _categories(db, imp.event_id)]
    existing = await db.execute(
        select(Guest.phone, Guest.display_name).where(Guest.event_id == imp.event_id)
    )
    keys = {guest_key(phone, name) for phone, name in existing}
    return check_rows(rows_from_json(imp.rows), categories, keys)


def _import_out(imp: GuestImport, checked: list[CheckedRow]) -> ImportOut:
    imported = [r for r in checked if r.status in IMPORTED]
    if imp.status == ImportStatus.done:
        summary = ImportSummary(
            total=imp.total_rows,
            to_import=imp.imported_rows,
            to_verify=0,
            not_imported=imp.error_rows,
            duplicates=0,
            by_category={},
        )
    else:
        summary = ImportSummary(
            total=len(checked),
            to_import=len(imported),
            to_verify=sum(r.status != RowStatus.ready for r in imported),
            not_imported=sum(
                r.status in {RowStatus.name_missing, RowStatus.category_unknown}
                for r in checked
            ),
            duplicates=sum(r.status == RowStatus.duplicate for r in checked),
            by_category=dict(Counter(r.category for r in imported if r.category)),
        )
    # Lignes à corriger en tête de liste (DESIGN.md), puis dans l'ordre du fichier.
    ordered = sorted(checked, key=lambda r: (r.status == RowStatus.ready, r.line))
    return ImportOut(
        id=imp.id,
        event_id=imp.event_id,
        file_name=imp.file_name,
        status=imp.status,
        created_at=imp.created_at,
        columns=[
            ImportColumnOut(
                header=c["header"],
                field=c["field"],
                label=FIELD_LABELS.get(c["field"] or ""),
            )
            for c in imp.column_mapping or []
        ],
        summary=summary,
        imported_rows=imp.imported_rows,
        rows=[ImportRowOut.model_validate(r, from_attributes=True) for r in ordered],
    )


async def _owned_import(
    db: AsyncSession, event: Event, import_id: uuid.UUID, *, lock: bool = False
) -> GuestImport:
    query = select(GuestImport).where(
        GuestImport.id == import_id, GuestImport.event_id == event.id
    )
    imp = await db.scalar(query.with_for_update() if lock else query)
    if imp is None:
        raise IMPORT_NOT_FOUND
    return imp


@router.post("/events/{event_id}/imports", status_code=status.HTTP_201_CREATED)
async def upload_import(
    event_id: uuid.UUID, file: UploadFile, auth: CurrentAuth, db: DbSession
) -> ImportOut:
    """Lit le fichier et renvoie l'aperçu. Rien n'est ajouté à la liste avant la confirmation."""
    event = await owned_event(db, event_id, auth.user.id)
    content = await file.read(MAX_FILE_BYTES + 1)
    file_name = file.filename or "liste.xlsx"
    try:
        parsed = parse_file(file_name, content)
    except ImportFileError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"message": str(exc)}
        ) from None

    # Un seul aperçu en attente par événement : l'ancien (et ses données personnelles) est supprimé.
    await db.execute(
        delete(GuestImport).where(
            GuestImport.event_id == event.id, GuestImport.status == ImportStatus.pending
        )
    )
    imp = GuestImport(
        event_id=event.id,
        file_name=file_name[:200],
        column_mapping=[{"header": c.header, "field": c.field} for c in parsed.columns],
        rows=rows_to_json(parsed.rows),
        total_rows=len(parsed.rows),
    )
    db.add(imp)
    await db.commit()
    await db.refresh(imp)
    return _import_out(imp, await _check(db, imp))


@router.get("/events/{event_id}/imports/{import_id}")
async def get_import(
    event_id: uuid.UUID, import_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> ImportOut:
    event = await owned_event(db, event_id, auth.user.id)
    imp = await _owned_import(db, event, import_id)
    return _import_out(imp, await _check(db, imp))


@router.post("/events/{event_id}/imports/{import_id}/confirm")
async def confirm_import(
    event_id: uuid.UUID, import_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> ImportOut:
    """Ajoute à la liste les lignes importables (vérifiées à nouveau, la liste a pu changer entre-temps)."""
    event = await owned_event(db, event_id, auth.user.id)
    imp = await _owned_import(db, event, import_id, lock=True)
    if imp.status != ImportStatus.pending:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"message": "Cette liste a déjà été importée."},
        )

    checked = await _check(db, imp)
    rows = [r for r in checked if r.status in IMPORTED]
    categories = {c.name: c.id for c in await _categories(db, event.id)}
    if any(r.category not in categories for r in rows):
        # Catégorie par défaut absente de l'événement : créée à la première utilisation.
        default = GuestCategory(event_id=event.id, name=DEFAULT_CATEGORY)
        db.add(default)
        await db.flush()
        categories[DEFAULT_CATEGORY] = default.id

    db.add_all(
        Guest(
            event_id=event.id,
            category_id=categories[r.category],
            import_id=imp.id,
            display_name=r.display_name,
            last_name=r.last_name,
            first_names=r.first_names,
            phone=r.phone,
            phone_valid=r.phone_valid,
            seat=r.seat,
            seats=r.seats,
        )
        for r in rows
        if r.category
    )
    imp.status = ImportStatus.done
    imp.imported_rows = len(rows)
    imp.error_rows = len(checked) - len(rows)
    imp.rows = []  # les données personnelles du fichier ne sont plus nécessaires
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "message": "La liste a changé pendant l'import. Importez à nouveau votre fichier."
            },
        ) from None
    await db.refresh(imp)
    return _import_out(imp, [])


def _guest_query():
    return (
        select(Guest, GuestCategory.name, Invitation.token)
        .join(GuestCategory, GuestCategory.id == Guest.category_id)
        .outerjoin(Invitation, Invitation.guest_id == Guest.id)
    )


def _guest_out(guest: Guest, category: str, token: str | None) -> GuestOut:
    fields = [
        k for k in GuestOut.model_fields if k not in {"category", "invitation_token"}
    ]
    return GuestOut.model_validate(
        {
            **{k: getattr(guest, k) for k in fields},
            "category": category,
            "invitation_token": token,
        }
    )


@router.get("/events/{event_id}/guests")
async def list_guests(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> list[GuestOut]:
    event = await owned_event(db, event_id, auth.user.id)
    rows = await db.execute(
        _guest_query()
        .where(Guest.event_id == event.id)
        .order_by(Guest.phone_valid, Guest.display_name)
    )
    return [_guest_out(*row) for row in rows]


@router.get("/guests/import-template", response_class=Response)
async def import_template() -> Response:
    """Modèle Excel à remplir (public)."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Invités"
    sheet.append(["Nom", "Prénoms", "Numéro", "Catégorie", "Position", "Nb pers."])
    sheet.append(["Konan", "Kouadio Jean", "07 07 12 34 56", "VIP", "Table 1", 2])
    sheet.append(["Bamba", "Fatou", "05 44 81 81 07", "Normal", "Table 4", 1])
    sheet.append(["Ouattara", "Famille", "", "", "", 4])
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    for row in sheet.iter_rows(min_row=2, max_row=500, min_col=3, max_col=3):
        for cell in row:
            cell.number_format = "@"  # texte : Excel garde le 0 initial des numéros
    for column, width in zip("ABCDEF", (20, 24, 18, 14, 14, 10), strict=True):
        sheet.column_dimensions[column].width = width
    buffer = io.BytesIO()
    workbook.save(buffer)
    return Response(
        buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="modele-invites-here.xlsx"'
        },
    )


# --- Invités saisis à la main -------------------------------------------------------------


def _refused(field: str, message: str, code: int = status.HTTP_400_BAD_REQUEST):
    return HTTPException(code, detail={"field": field, "message": message})


async def _checked_guest(
    db: AsyncSession, event: Event, body: GuestIn, guest_id: uuid.UUID | None = None
) -> dict:
    """Champs de l'invité, vérifiés : nom, numéro valide ou vide, catégorie de l'événement, pas de doublon."""
    last_name, first_names = body.last_name or None, body.first_names or None
    display_name = " ".join(p for p in (first_names, last_name) if p)
    if not display_name:
        raise _refused("last_name", "Indiquez au moins un nom ou un prénom.")
    phone = None
    if body.phone:
        phone = normalize_phone(body.phone)
        if phone is None:
            raise _refused(
                "phone", "Ce numéro n'est pas valide. Exemple : 07 07 12 34 56."
            )
    category = await db.scalar(
        select(GuestCategory).where(
            GuestCategory.id == body.category_id, GuestCategory.event_id == event.id
        )
    )
    if category is None:
        raise _refused("category_id", "Choisissez une catégorie de l'événement.")
    others = await db.execute(
        select(Guest.phone, Guest.display_name).where(
            Guest.event_id == event.id, Guest.id != guest_id
        )
    )
    key = guest_key(phone, display_name)
    same = next((name for p, name in others if guest_key(p, name) == key), None)
    if same:
        raise _refused(
            "phone" if phone else "last_name",
            f"Déjà dans la liste : {same}.",
            status.HTTP_409_CONFLICT,
        )
    return {
        "last_name": last_name,
        "first_names": first_names,
        "display_name": display_name,
        "phone": phone,
        "phone_valid": phone is not None,
        "category_id": category.id,
        "seat": body.seat or None,
        "seats": body.seats,
    }


async def _owned_guest(db: AsyncSession, guest_id: uuid.UUID, user_id: uuid.UUID):
    row = (
        await db.execute(
            select(Guest, Event)
            .join(Event, Event.id == Guest.event_id)
            .where(Guest.id == guest_id, Event.user_id == user_id)
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Invité introuvable.")
    return row[0], row[1]


async def _guest_by_id(db: AsyncSession, guest_id: uuid.UUID) -> GuestOut:
    return _guest_out(
        *(await db.execute(_guest_query().where(Guest.id == guest_id))).one()
    )


@router.post("/events/{event_id}/guests", status_code=status.HTTP_201_CREATED)
async def add_guest(
    event_id: uuid.UUID, body: GuestIn, auth: CurrentAuth, db: DbSession
) -> GuestOut:
    """Ajoute un invité. Si les cartes de l'événement sont déjà préparées, il reçoit la sienne."""
    event = await owned_event(db, event_id, auth.user.id)
    guest = Guest(event_id=event.id, **await _checked_guest(db, event, body))
    db.add(guest)
    await db.flush()
    card_id = await db.scalar(
        select(Invitation.event_card_id)
        .join(Guest, Guest.id == Invitation.guest_id)
        .where(Guest.event_id == event.id)
        .limit(1)
    )
    if card_id is not None:
        db.add(
            Invitation(
                guest_id=guest.id,
                event_card_id=card_id,
                token=secrets.token_urlsafe(24),
            )
        )
    await db.commit()
    return await _guest_by_id(db, guest.id)


@router.get("/guests/{guest_id}")
async def get_guest(guest_id: uuid.UUID, auth: CurrentAuth, db: DbSession) -> GuestOut:
    guest, _ = await _owned_guest(db, guest_id, auth.user.id)
    return await _guest_by_id(db, guest.id)


@router.patch("/guests/{guest_id}")
async def update_guest(
    guest_id: uuid.UUID, body: GuestIn, auth: CurrentAuth, db: DbSession
) -> GuestOut:
    """Modifie un invité. Sa réponse et ses envois sont gardés ; sa carte suit les nouvelles informations."""
    guest, event = await _owned_guest(db, guest_id, auth.user.id)
    for field, value in (await _checked_guest(db, event, body, guest.id)).items():
        setattr(guest, field, value)
    if guest.attending_seats and guest.attending_seats > guest.seats:
        guest.attending_seats = (
            guest.seats
        )  # réponse donnée pour plus de places qu'il n'en reste
    await db.commit()
    return await _guest_by_id(db, guest.id)


@router.delete("/guests/{guest_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_guest(
    guest_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> Response:
    """Retire un invité de la liste, avec sa carte, ses envois et son entrée. Irréversible."""
    guest, _ = await _owned_guest(db, guest_id, auth.user.id)
    await db.delete(guest)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Aperçu d'import : corriger ou retirer une ligne ------------------------------------


async def _pending_import(
    db: AsyncSession, event_id: uuid.UUID, import_id: uuid.UUID, user_id: uuid.UUID
) -> GuestImport:
    event = await owned_event(db, event_id, user_id)
    imp = await _owned_import(db, event, import_id, lock=True)
    if imp.status != ImportStatus.pending:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"message": "Cette liste a déjà été importée."},
        )
    return imp


def _without_line(imp: GuestImport, line: int) -> list[dict]:
    rows = [r for r in imp.rows if r["line"] != line]
    if len(rows) == len(imp.rows):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ligne introuvable.")
    return rows


@router.patch("/events/{event_id}/imports/{import_id}/rows/{line}")
async def fix_import_row(
    event_id: uuid.UUID,
    import_id: uuid.UUID,
    line: int,
    body: ImportRowIn,
    auth: CurrentAuth,
    db: DbSession,
) -> ImportOut:
    """Corrige une ligne de l'aperçu : elle est vérifiée à nouveau, comme celles du fichier."""
    imp = await _pending_import(db, event_id, import_id, auth.user.id)
    rows = _without_line(imp, line)
    rows.append({"line": line, **{k: v or None for k, v in body.model_dump().items()}})
    imp.rows = sorted(
        rows, key=lambda r: r["line"]
    )  # nouvelle liste : JSONB à réécrire
    await db.commit()
    await db.refresh(imp)
    return _import_out(imp, await _check(db, imp))


@router.delete("/events/{event_id}/imports/{import_id}/rows/{line}")
async def drop_import_row(
    event_id: uuid.UUID,
    import_id: uuid.UUID,
    line: int,
    auth: CurrentAuth,
    db: DbSession,
) -> ImportOut:
    """Retire une ligne de l'aperçu : elle ne sera pas importée."""
    imp = await _pending_import(db, event_id, import_id, auth.user.id)
    imp.rows = _without_line(imp, line)
    imp.total_rows = len(imp.rows)
    await db.commit()
    await db.refresh(imp)
    return _import_out(imp, await _check(db, imp))
