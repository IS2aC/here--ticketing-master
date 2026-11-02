import { designPath, relay } from "../../relay";

// Empreintes des images déjà enregistrées pour la carte.
export async function GET(_: Request, { params }: RouteContext<"/tableau-de-bord/evenements/[id]/carte/design/images">) {
  return relay(`${designPath((await params).id)}/assets`);
}
