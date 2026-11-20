import { cookies } from "next/headers";
import { connection, NextResponse } from "next/server";
import { GOOGLE_FLOW_COOKIE, googleClientId, newFlow, publicUrl, redirectUri } from "@/lib/google";

// « Continuer avec Google » : départ vers l'écran de choix du compte Google.
export async function GET() {
  await connection(); // à chaque demande : nouvel état, et GOOGLE_CLIENT_ID lu à l'exécution (jamais figé au build)
  const clientId = googleClientId();
  if (!clientId) return NextResponse.redirect(publicUrl("/connexion"));

  const { state, nonce, verifier, challenge } = newFlow();
  (await cookies()).set(GOOGLE_FLOW_COOKIE, JSON.stringify({ state, nonce, verifier }), {
    httpOnly: true,
    sameSite: "lax", // renvoyé au retour de Google (navigation de premier niveau)
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/api/auth",
    maxAge: 600,
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return NextResponse.redirect(url);
}
