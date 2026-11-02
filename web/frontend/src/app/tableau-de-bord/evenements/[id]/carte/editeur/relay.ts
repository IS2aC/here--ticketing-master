import "server-only";
import { apiFetch } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

// Routes de l'éditeur de cartes : le navigateur n'a pas le jeton de l'API (cookie httpOnly), le serveur
// Next relaie ses requêtes. Les réponses de l'API sont rendues telles quelles (statut, JSON ou image).

export async function relay(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await apiFetch(path, { ...init, token: await getSessionToken() });
  } catch {
    return Response.json({ detail: { message: "Le service est momentanément indisponible." } }, { status: 503 });
  }
  const headers = new Headers({ "Cache-Control": response.headers.get("Cache-Control") ?? "no-store" });
  const type = response.headers.get("Content-Type");
  if (type) headers.set("Content-Type", type);
  return new Response(response.body, { status: response.status, headers });
}

export const designPath = (eventId: string) => `/v1/events/${encodeURIComponent(eventId)}/card/design`;
