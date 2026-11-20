import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { apiFetch, clientHeaders, type SessionResponse } from "@/lib/api";
import { GOOGLE_FLOW_COOKIE, publicUrl, readFlow, redirectUri } from "@/lib/google";
import { setSessionToken } from "@/lib/session";

const back = (reason: "annule" | "erreur") => NextResponse.redirect(publicUrl(`/connexion?google=${reason}`));

function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// Retour de Google : vérifie que la demande vient de ce navigateur, puis l'API ouvre la session.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const jar = await cookies();
  const flow = readFlow(jar.get(GOOGLE_FLOW_COOKIE)?.value);
  jar.delete({ name: GOOGLE_FLOW_COOKIE, path: "/api/auth" }); // une seule utilisation

  if (params.get("error")) return back("annule"); // l'organisateur a fermé l'écran de Google
  const code = params.get("code");
  const state = params.get("state");
  if (!flow || !code || !state || !sameState(state, flow.state)) return back("erreur");

  let response: Response;
  try {
    response = await apiFetch("/v1/auth/google", {
      method: "POST",
      headers: await clientHeaders(),
      body: JSON.stringify({ code, code_verifier: flow.verifier, nonce: flow.nonce, redirect_uri: redirectUri() }),
    });
  } catch {
    return back("erreur");
  }
  if (!response.ok) return back("erreur");

  const session = (await response.json()) as SessionResponse & { created: boolean };
  await setSessionToken(session.access_token, session.expires_at);
  // Premier passage sans numéro : on propose de l'ajouter (facultatif).
  const next = session.created && !session.user.phone ? "/tableau-de-bord/bienvenue" : "/tableau-de-bord";
  return NextResponse.redirect(publicUrl(next));
}
