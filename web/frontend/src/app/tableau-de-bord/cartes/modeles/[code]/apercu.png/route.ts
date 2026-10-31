import { SAMPLE_CODE, SAMPLE_GUEST, invitationUrl } from "@/lib/card/data";
import { tableText } from "@/lib/card/layout";
import { EXAMPLE_PHOTO, exampleValues, getCardTemplate, templateAssets } from "@/lib/card/templates/catalog";
import { FORMATS, type CardFormat } from "@/lib/card/templates/definition";
import { renderTemplateCard } from "@/lib/card/templates/render";

// Aperçu d'un modèle du catalogue avec ses valeurs d'exemple : ?format=, ?palette=, ?polices=.
// L'A5 à imprimer est la version générique : ni nom d'invité ni QR code.
export async function GET(request: Request, { params }: RouteContext<"/tableau-de-bord/cartes/modeles/[code]/apercu.png">) {
  const { code } = await params;
  const query = new URL(request.url).searchParams;
  const template = await getCardTemplate(code);
  const wanted = query.get("format") as CardFormat | null;
  const format = wanted && wanted in FORMATS && template.definition.formats.includes(wanted) ? wanted : "whatsapp_4_5";
  const { [EXAMPLE_PHOTO]: photo, ...assets } = await templateAssets(template);
  return renderTemplateCard(
    {
      definition: template.definition,
      format,
      values: exampleValues(template.definition),
      overrides: { palette: query.get("palette") ?? undefined, fonts: query.get("polices") ?? undefined },
      assets,
      photo: photo && "uri" in photo ? photo.uri : null,
      guest:
        format === "print_a5"
          ? null
          : { name: SAMPLE_GUEST.guestName, table: tableText(SAMPLE_GUEST.seat, SAMPLE_GUEST.category), code: SAMPLE_CODE, qrValue: invitationUrl("exemple") },
    },
    { "Cache-Control": "private, max-age=300" },
  );
}
