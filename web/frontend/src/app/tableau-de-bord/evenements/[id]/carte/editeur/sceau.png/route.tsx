import { ImageResponse } from "next/og";
import { SAMPLE_CODE } from "@/lib/card/data";
import { cardFonts } from "@/lib/card/fonts";
import { parseQrStyle, SAMPLE_QR_VALUE, styledQrSvg } from "@/lib/card/qr";
import { CompactSeal, SEAL_SIZE } from "@/lib/card/seal";
import { svgUri } from "@/lib/card/templates/color";

// Sceau Here! d'exemple (QR code fictif), affiché dans l'éditeur à la place du QR code de chaque invité.
// Dessiné par le même composant que la carte envoyée : l'aperçu correspond au rendu final.
// ?points=, ?coins=, ?couleur= : style du QR code (lib/card/qr.ts).
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const style = parseQrStyle({ dots: query.get("points"), corners: query.get("coins"), color: query.get("couleur") });
  const qr = svgUri(styledQrSvg(SAMPLE_QR_VALUE, style));
  return new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: SEAL_SIZE.width, height: SEAL_SIZE.height, fontFamily: "Poppins" }}>
        <CompactSeal qr={qr} code={SAMPLE_CODE} left={0} top={0} />
      </div>
    ),
    { ...SEAL_SIZE, fonts: await cardFonts(), headers: { "Cache-Control": "private, max-age=86400" } },
  );
}
