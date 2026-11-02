import { designPath, relay } from "../../../relay";

type Context = RouteContext<"/tableau-de-bord/evenements/[id]/carte/design/images/[key]">;

const path = async (params: Context["params"]) => {
  const { id, key } = await params;
  return `${designPath(id)}/assets/${encodeURIComponent(key)}`;
};

// Image de la carte, par empreinte de son contenu.
export async function GET(_: Request, { params }: Context) {
  return relay(await path(params));
}

export async function PUT(request: Request, { params }: Context) {
  return relay(await path(params), {
    method: "PUT",
    body: await request.arrayBuffer(),
    headers: { "Content-Type": request.headers.get("Content-Type") ?? "application/octet-stream" },
  });
}
