"""Donne ou retire le rôle admin ou support (portail admin de l'équipe Here!).

    python -m app.admin 07 07 12 34 56            # le compte devient admin
    python -m app.admin 07 07 12 34 56 --support  # conseillère : appels et messages des invités
    python -m app.admin 07 07 12 34 56 --retirer  # il redevient organisateur

Sur Dokploy : terminal du conteneur here-api. Le compte doit déjà exister (inscription sur le site).
"""

import argparse
import asyncio
import sys

from sqlalchemy import select

from app.db import dispose_engine, get_session
from app.models import User, UserRole
from app.phone import normalize_phone


async def set_role(phone: str, role: UserRole) -> tuple[bool, str]:
    normalized = normalize_phone(phone)
    if normalized is None:
        return False, f"Numéro invalide : {phone}"
    try:
        async for db in get_session():
            user = await db.scalar(select(User).where(User.phone == normalized))
            if user is None:
                return (
                    False,
                    f"Aucun compte avec le numéro {normalized}. Inscrivez-vous d'abord sur le site.",
                )
            user.role = role
            await db.commit()
            return (
                True,
                f"{user.first_name} {user.last_name} ({normalized}) : rôle {role.value}.",
            )
    finally:
        await dispose_engine()
    return False, "Base indisponible."


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="python -m app.admin", description=__doc__.splitlines()[0]
    )
    parser.add_argument(
        "phone",
        nargs="+",
        help="numéro du compte (« 07 07 12 34 56 » ou « +2250707123456 »)",
    )
    parser.add_argument(
        "--retirer", action="store_true", help="retirer le rôle admin ou support"
    )
    parser.add_argument(
        "--support",
        action="store_true",
        help="rôle support (conseillère) : seulement l'écran des appels et des messages",
    )
    args = parser.parse_args()
    role = (
        UserRole.organizer
        if args.retirer
        else UserRole.support
        if args.support
        else UserRole.admin
    )
    ok, message = asyncio.run(set_role(" ".join(args.phone), role))
    print(message)
    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
