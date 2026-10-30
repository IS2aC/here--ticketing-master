import "server-only";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { cardFonts } from "../fonts";
import { svgUri } from "./color";
import { composeCard, type ComposeInput } from "./engine";
import type { Measure } from "./fit";
import { createMeasure } from "./measure";

// Image d'une carte de modèle (PNG), pour l'aperçu, l'invité et les exports.

let measure: Promise<Measure> | undefined;

function cardMeasure(): Promise<Measure> {
  measure ??= cardFonts().then(createMeasure);
  return measure;
}

export type TemplateCardInput = Omit<ComposeInput, "measure" | "guest"> & {
  guest?: { name: string; table: string | null; code: string; qrValue: string } | null;
};

export async function renderTemplateCard(input: TemplateCardInput, headers?: Record<string, string>): Promise<ImageResponse> {
  const guest = input.guest
    ? {
        ...input.guest,
        qr: svgUri(await QRCode.toString(input.guest.qrValue, { type: "svg", margin: 0, errorCorrectionLevel: "M" })),
      }
    : null;
  const card = composeCard({ ...input, guest, measure: await cardMeasure() });
  return new ImageResponse(card.element, { width: card.width, height: card.height, fonts: await cardFonts(), headers });
}
