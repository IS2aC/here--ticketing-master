// Appels serveur vers l'API Here! (réseau interne Docker : http://api:8000).
export function apiUrl(path: string): string {
  const base = process.env.API_URL ?? "http://localhost:8000";
  return new URL(path, base).toString();
}
