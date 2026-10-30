"""Fond de carte importé par l'organisateur : vérifié, redressé, recadré au format de la carte et compressé.

Format de la carte : portrait 4:5, 1080 × 1350 (optimal dans WhatsApp). Une image d'un autre format est
recadrée au centre ; l'aperçu montre le résultat avant l'envoi des invitations.
"""

import io

from PIL import Image, ImageOps, UnidentifiedImageError

CARD_SIZE = (1080, 1350)
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MIN_SIZE = (540, 675)  # en dessous, le fond serait flou une fois agrandi
FORMATS = {"JPEG", "PNG", "WEBP"}


class BackgroundError(ValueError):
    """Image refusée : le message est affiché tel quel à l'organisateur."""


def prepare_background(content: bytes) -> tuple[bytes, bool]:
    """Renvoie (JPEG 1080 × 1350, recadrée ?)."""
    if len(content) > MAX_UPLOAD_BYTES:
        raise BackgroundError(
            "Cette image dépasse 8 Mo : choisissez une image plus légère."
        )
    try:
        image = Image.open(io.BytesIO(content))
        image.load()
    except (UnidentifiedImageError, OSError):
        raise BackgroundError(
            "Nous n'arrivons pas à lire cette image. Utilisez une image JPEG, PNG ou WebP."
        ) from None
    if image.format not in FORMATS:
        raise BackgroundError("Utilisez une image JPEG, PNG ou WebP.")
    image = ImageOps.exif_transpose(image)  # photo prise de côté au téléphone
    if image.width < MIN_SIZE[0] or image.height < MIN_SIZE[1]:
        raise BackgroundError(
            f"Image trop petite ({image.width} × {image.height}) : il faut au moins "
            f"{MIN_SIZE[0]} × {MIN_SIZE[1]} pixels, idéalement 1080 × 1350."
        )
    ratio, target = image.width / image.height, CARD_SIZE[0] / CARD_SIZE[1]
    cropped = abs(ratio - target) / target > 0.03
    fitted = ImageOps.fit(
        image.convert("RGB"), CARD_SIZE, method=Image.Resampling.LANCZOS
    )
    out = io.BytesIO()
    fitted.save(out, "JPEG", quality=85, optimize=True, progressive=True)
    return out.getvalue(), cropped
