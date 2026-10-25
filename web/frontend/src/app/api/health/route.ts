// Utilisé par le healthcheck Docker et par Dokploy (frontend seul ; l'API a son propre /health).
export function GET() {
  return Response.json({ status: "ok" });
}
