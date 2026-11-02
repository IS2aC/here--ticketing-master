import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

// « Valider la carte » : le décor dessiné dans l'éditeur devient le fond de « Mon propre modèle », et les
// champs invité sa mise en page. Satori dessine ensuite la carte de chaque invité (nom, table, QR code).
// Corps : multipart, `decor` (PNG 1080 × 1350, sans les champs invité) et `layout` (JSON, CardLayout).

const UNAVAILABLE = "Le service est momentanément indisponible. Votre carte n'a pas été validée.";

async function failure(response: Response): Promise<Response> {
  let message = UNAVAILABLE;
  if (response.status === 409 || response.status === 422) {
    try {
      const { detail } = (await response.json()) as { detail: { message?: string } | unknown[] };
      message = (!Array.isArray(detail) && detail.message) || "Cette mise en page n'est pas valable.";
    } catch {
      // réponse illisible : message générique
    }
  }
  return Response.json({ message }, { status: response.status === 401 ? 401 : 400 });
}

export async function POST(request: Request, { params }: RouteContext<"/tableau-de-bord/evenements/[id]/carte/editeur/valider">) {
  const { id } = await params;
  const form = await request.formData();
  const decor = form.get("decor");
  const layout = form.get("layout");
  if (!(decor instanceof Blob) || typeof layout !== "string") return Response.json({ message: UNAVAILABLE }, { status: 400 });

  const token = await getSessionToken();
  const card = `/v1/events/${encodeURIComponent(id)}/card`;
  const body = new FormData();
  body.append("file", decor, "decor.png");
  try {
    const background = await apiFetch(`${card}/background`, { method: "PUT", token, body });
    if (!background.ok) return failure(background);
    const saved = await apiFetch(card, { method: "PATCH", token, body: JSON.stringify({ layout: JSON.parse(layout) as unknown }) });
    if (!saved.ok) return failure(saved);
  } catch {
    return Response.json({ message: UNAVAILABLE }, { status: 503 });
  }
  revalidatePath(`/tableau-de-bord/evenements/${id}/carte`);
  return Response.json({ ok: true });
}
