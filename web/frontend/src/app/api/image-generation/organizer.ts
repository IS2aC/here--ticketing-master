import "server-only";
import { apiFetch } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

/** Vrai si la requête vient d'un organisateur connecté : la génération d'images coûte, elle lui est réservée. */
export async function isOrganizer(): Promise<boolean> {
  const token = await getSessionToken();
  if (!token) return false;
  try {
    return (await apiFetch("/v1/me", { token })).ok;
  } catch {
    return false;
  }
}

export function reply({ status, body }: { status: number; body: unknown }): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export const UNAUTHORIZED = () => reply({ status: 401, body: { error: { code: "invalid_request" } } });
