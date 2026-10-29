import "server-only";

// Appels serveur vers l'API Here! (réseau interne Docker : http://here-api:8000).
export function apiUrl(path: string): string {
  const base = process.env.API_URL ?? "http://localhost:8000";
  return new URL(path, base).toString();
}

export type User = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  role: "organizer" | "support" | "admin";
  organization: string | null;
  city: string | null;
  country: string | null;
  billing_address: string | null;
  tax_id: string | null;
};

export type SessionResponse = {
  access_token: string;
  token_type: "bearer";
  expires_at: string;
  user: User;
};

export async function apiFetch(path: string, init: RequestInit & { token?: string } = {}): Promise<Response> {
  const { token, headers, ...rest } = init;
  const url = apiUrl(path);
  // L'erreur est écrite dans les journaux du frontend : l'interface n'affiche qu'un message générique.
  const fail = (error: unknown): never => {
    console.error(`API injoignable : ${rest.method ?? "GET"} ${url}`, error);
    throw error;
  };
  return fetch(url, {
    ...rest,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: {
      // JSON par défaut ; un envoi de fichier (FormData) fixe lui-même son Content-Type.
      ...(typeof rest.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  }).then((response) => {
    if (response.status >= 500) console.error(`API en erreur : ${rest.method ?? "GET"} ${url} → ${response.status}`);
    return response;
  }, fail);
}
