import io

import pytest
from openpyxl import Workbook

from app.guest_import import ImportFileError, RawRow, RowStatus, check_rows, parse_file


def xlsx(rows: list[list[object]]) -> bytes:
    workbook = Workbook()
    for row in rows:
        workbook.active.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def test_parse_xlsx_headers_in_any_order_and_numeric_phones() -> None:
    content = xlsx(
        [
            ["Liste des invités du mariage"],  # titre au-dessus de l'en-tête
            ["Position", "PRÉNOM(S)", "Nom", "Téléphone", "Catégorie", "Remarque"],
            ["Table 1", "Jean", "Konan", 707123456, "vip", "arrive tard"],
            [None, None, None, None, None, None],  # ligne vide ignorée
            ["", "Fatou", "Bamba", 2250544818107, None, None],
        ]
    )
    parsed = parse_file("invites.xlsx", content)
    assert [c.field for c in parsed.columns] == [
        "seat",
        "first_names",
        "last_name",
        "phone",
        "category",
        None,
    ]
    assert parsed.rows == [
        RawRow(
            line=3,
            last_name="Konan",
            first_names="Jean",
            phone="0707123456",
            category="vip",
            seat="Table 1",
        ),
        RawRow(line=5, last_name="Bamba", first_names="Fatou", phone="+2250544818107"),
    ]


def test_parse_csv_semicolon_cp1252() -> None:
    content = "Nom;Prénoms;Numéro\nKoné;Hamed;07 58 20 66 14\n".encode("cp1252")
    parsed = parse_file("liste.csv", content)
    assert parsed.rows == [
        RawRow(line=2, last_name="Koné", first_names="Hamed", phone="07 58 20 66 14")
    ]


@pytest.mark.parametrize(
    ("name", "content", "message"),
    [
        ("liste.xls", b"x", "ancien"),
        ("liste.pdf", b"x", r"Excel \(\.xlsx\) ou CSV"),
        ("liste.csv", "Invités;Tél\nA;B\n".encode(), "pas reconnu les colonnes"),
        ("liste.csv", b"Nom;Numero\n", "aucun invit"),
        ("liste.xlsx", b"pas un fichier excel", "lire ce fichier Excel"),
    ],
)
def test_parse_errors(name: str, content: bytes, message: str) -> None:
    with pytest.raises(ImportFileError, match=message):
        parse_file(name, content)


def test_check_rows() -> None:
    rows = [
        RawRow(
            line=2,
            last_name="Konan",
            first_names="Jean",
            phone="0707123456",
            category="VIP",
        ),
        RawRow(
            line=3, last_name="Bamba", first_names="Fatou"
        ),  # sans numéro, catégorie par défaut
        RawRow(line=4, last_name="Assi", phone="07 07 12 3"),  # numéro incomplet
        RawRow(
            line=5, last_name="Konan bis", phone="+225 07 07 12 34 56"
        ),  # même numéro que la ligne 2
        RawRow(line=6, phone="0505050505"),  # sans nom
        RawRow(
            line=7, last_name="Diallo", phone="0101010101", category="Famille"
        ),  # catégorie inconnue
        RawRow(line=8, last_name="Yao", phone="0102030405"),  # déjà invité
        RawRow(
            line=9,
            last_name="Tanoh",
            first_names="Awa",
            phone="0102030406",
            category="  normal ",
        ),
    ]
    checked = check_rows(rows, ["VIP", "Normal"], {"+2250102030405"})
    assert [(r.line, r.status) for r in checked] == [
        (2, RowStatus.ready),
        (3, RowStatus.phone_missing),
        (4, RowStatus.phone_invalid),
        (5, RowStatus.duplicate),
        (6, RowStatus.name_missing),
        (7, RowStatus.category_unknown),
        (8, RowStatus.duplicate),
        (9, RowStatus.ready),
    ]
    assert checked[0].display_name == "Jean Konan"
    assert checked[0].phone == "+2250707123456"
    assert checked[1].category == "Normal"
    assert checked[2].phone == "07 07 12 3"
    assert not checked[2].phone_valid
    assert checked[7].category == "Normal"


def test_guests_without_phone_are_deduplicated_by_name() -> None:
    rows = [
        RawRow(line=2, last_name="Bamba", first_names="Fatou"),
        RawRow(line=3, last_name="BAMBA", first_names="Fatou"),
    ]
    checked = check_rows(rows, ["Normal"], {"nom:awa tanoh"})
    assert [r.status for r in checked] == [RowStatus.phone_missing, RowStatus.duplicate]
    assert (
        check_rows(
            [RawRow(line=2, last_name="Tanoh", first_names="Awa")],
            ["Normal"],
            {"nom:awa tanoh"},
        )[0].status
        == RowStatus.duplicate
    )


def test_default_category_when_event_has_no_normal() -> None:
    checked = check_rows([RawRow(line=2, last_name="Yao")], ["VIP"], set())
    assert checked[0].category == "Normal"
    assert checked[0].status == RowStatus.phone_missing
