import "server-only";

// Appels serveur vers l'API Here! (réseau interne Docker : http://api:8000).
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
};

export type SessionResponse = {
  access_token: string;
  token_type: "bearer";
  expires_at: string;
  user: User;
};

export async function apiFetch(path: string, init: RequestInit & { token?: string } = {}): Promise<Response> {
  const { token, headers, ...rest } = init;
  return fetch(apiUrl(path), {
    ...rest,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
}
