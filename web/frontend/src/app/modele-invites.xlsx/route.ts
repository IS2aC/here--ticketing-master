import { apiFetch } from "@/lib/api";

// Modèle Excel de la liste d'invités, généré par l'API.
export async function GET() {
  const response = await apiFetch("/v1/guests/import-template");
  if (!response.ok) return new Response("Modèle indisponible", { status: 502 });
  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": 'attachment; filename="modele-invites-here.xlsx"',
    },
  });
}
