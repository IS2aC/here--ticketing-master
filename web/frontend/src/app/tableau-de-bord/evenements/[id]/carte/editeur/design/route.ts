import { designPath, relay } from "../relay";

// Document de l'éditeur de cartes : lecture et enregistrement (concurrence optimiste, voir l'API).
export async function GET(_: Request, { params }: RouteContext<"/tableau-de-bord/evenements/[id]/carte/editeur/design">) {
  return relay(designPath((await params).id));
}

export async function PUT(request: Request, { params }: RouteContext<"/tableau-de-bord/evenements/[id]/carte/editeur/design">) {
  return relay(designPath((await params).id), { method: "PUT", body: await request.text() });
}
