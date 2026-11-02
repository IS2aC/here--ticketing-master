import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { SAMPLE_CODE } from "@/lib/card/data";
import { cardFonts } from "@/lib/card/fonts";
import { CompactSeal, SEAL_SIZE } from "@/lib/card/seal";
import { svgUri } from "@/lib/card/templates/color";

// Sceau Here! d'exemple (QR code fictif), affiché dans l'éditeur à la place du QR code de chaque invité.
// Dessiné par le même composant que la carte envoyée : l'aperçu correspond au rendu final.
export async function GET() {
  const qr = svgUri(await QRCode.toString("https://here.example/i/apercu", { type: "svg", margin: 0, errorCorrectionLevel: "M" }));
  return new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: SEAL_SIZE.width, height: SEAL_SIZE.height, fontFamily: "Poppins" }}>
        <CompactSeal qr={qr} code={SAMPLE_CODE} left={0} top={0} />
      </div>
    ),
    { ...SEAL_SIZE, fonts: await cardFonts(), headers: { "Cache-Control": "private, max-age=86400" } },
  );
}
