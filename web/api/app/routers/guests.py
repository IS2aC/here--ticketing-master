import io
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
from app.models import Event, Guest, GuestCategory, GuestImport, ImportStatus
from app.routers.events import owned_event
from app.schemas import (
    GuestOut,
    ImportColumnOut,
    ImportOut,
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


@router.get("/events/{event_id}/guests")
async def list_guests(
    event_id: uuid.UUID, auth: CurrentAuth, db: DbSession
) -> list[GuestOut]:
    event = await owned_event(db, event_id, auth.user.id)
    rows = await db.execute(
        select(Guest, GuestCategory.name)
        .join(GuestCategory, GuestCategory.id == Guest.category_id)
        .where(Guest.event_id == event.id)
        .order_by(Guest.phone_valid, Guest.display_name)
    )
    return [
        GuestOut.model_validate(
            {
                **{k: getattr(g, k) for k in GuestOut.model_fields if k != "category"},
                "category": name,
            }
        )
        for g, name in rows
    ]


@router.get("/guests/import-template", response_class=Response)
async def import_template() -> Response:
    """Modèle Excel à remplir (public)."""
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Invités"
    sheet.append(["Nom", "Prénoms", "Numéro", "Catégorie", "Position"])
    sheet.append(["Konan", "Kouadio Jean", "07 07 12 34 56", "VIP", "Table 1"])
    sheet.append(["Bamba", "Fatou", "05 44 81 81 07", "Normal", "Table 4"])
    sheet.append(["Ouattara", "Famille", "", "", ""])
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    for row in sheet.iter_rows(min_row=2, max_row=500, min_col=3, max_col=3):
        for cell in row:
            cell.number_format = "@"  # texte : Excel garde le 0 initial des numéros
    for column, width in zip("ABCDE", (20, 24, 18, 14, 14), strict=True):
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
