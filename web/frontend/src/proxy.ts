import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// Vérification rapide : sans cookie de session, inutile d'afficher le tableau de bord.
// La vraie vérification est faite auprès de l'API (lib/auth.ts).
// Page de garde (/) : l'écran de connexion, ou le tableau de bord pour un organisateur déjà connecté.
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has(SESSION_COOKIE);
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(signedIn ? "/tableau-de-bord" : "/connexion", request.url));
  }
  if (!signedIn) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/tableau-de-bord/:path*"],
};
