import re

_E164 = re.compile(r"^\+[1-9][0-9]{7,14}$")
_SEPARATORS = re.compile(r"[\s.\-()]")


def normalize_phone(raw: str, default_country_code: str = "225") -> str | None:
    """Ramène un numéro au format E.164 (« 07 00 00 00 01 » → « +2250700000001 »), ou None s'il est invalide.

    Un numéro local à 10 chiffres commençant par 0 est considéré comme ivoirien.
    """
    phone = _SEPARATORS.sub("", raw)
    if phone.startswith("00"):
        phone = "+" + phone[2:]
    elif re.fullmatch(r"0[0-9]{9}", phone):
        phone = f"+{default_country_code}{phone}"
    return phone if _E164.fullmatch(phone) else None
