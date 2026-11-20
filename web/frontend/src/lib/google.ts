import "server-only";
import { createHash, randomBytes } from "node:crypto";

// Connexion avec Google : le frontend envoie l'organisateur chez Google et reçoit le code au retour.
// L'API échange ce code (avec le secret) et vérifie l'identité ; le secret ne passe jamais par ici.

export const GOOGLE_FLOW_COOKIE = "here_google";
export const GOOGLE_CALLBACK_PATH = "/api/auth/callback/google";

/** Bouton proposé seulement si l'identifiant OAuth est configuré (lu à l'exécution, pas au build). */
export function googleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID || null;
}

export function publicUrl(path: string): URL {
  return new URL(path, process.env.PUBLIC_APP_URL ?? "http://localhost:3000");
}

/** Doit être identique, au caractère près, à l'URI déclarée dans la console Google Cloud. */
export function redirectUri(): string {
  return publicUrl(GOOGLE_CALLBACK_PATH).toString();
}

const random = () => randomBytes(32).toString("base64url");

/** État, vérificateur PKCE et nonce d'une demande, gardés dans un cookie httpOnly le temps de l'aller-retour. */
export function newFlow() {
  const verifier = random();
  return {
    state: random(),
    nonce: random(),
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

export type GoogleFlow = { state: string; nonce: string; verifier: string };

export function readFlow(raw: string | undefined): GoogleFlow | null {
  if (!raw) return null;
  try {
    const flow = JSON.parse(raw) as Partial<GoogleFlow>;
    return flow.state && flow.nonce && flow.verifier ? (flow as GoogleFlow) : null;
  } catch {
    return null;
  }
}
