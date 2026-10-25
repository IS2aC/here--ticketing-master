import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// Vérification rapide : sans cookie de session, inutile d'afficher le tableau de bord.
// La vraie vérification est faite auprès de l'API (lib/auth.ts).
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/tableau-de-bord/:path*",
};
