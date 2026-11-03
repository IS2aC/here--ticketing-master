import { describe, expect, it } from "vitest";
import type { ImageGenerationConfig } from "./config.ts";
import { generateWithOpenRouter } from "./openrouter.ts";
import { validateGenerationRequest } from "./validate.ts";

// Photos de référence (lot D3) : vérifiées par le serveur, transmises au fournisseur.

const CONFIG: ImageGenerationConfig = {
  provider: "openrouter",
  baseUrl: "https://fournisseur.test/api/v1",
  apiKey: "clé",
  model: "modele-image",
  sizes: ["4:5"],
  resolution: null,
  maxImages: 1,
  timeoutMs: 5_000,
};
// En-tête PNG (signature) suivi de quelques octets : suffit à reconnaître le format.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]).toString("base64");

describe("photos de référence", () => {
  it("sont acceptées par OpenRouter, 4 au plus, images matricielles seulement", () => {
    const ok = validateGenerationRequest({ prompt: "fleurs", references: [{ data: PNG }] }, CONFIG);
    expect(ok?.references).toEqual([{ mimeType: "image/png", data: PNG }]);
    expect(validateGenerationRequest({ prompt: "fleurs", references: Array(5).fill({ data: PNG }) }, CONFIG)).toBeNull();
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>").toString("base64");
    expect(validateGenerationRequest({ prompt: "fleurs", references: [{ data: svg }] }, CONFIG)).toBeNull();
  });

  it("sont refusées par un fournisseur qui n'en prend pas", () => {
    const compatible = { ...CONFIG, provider: "openai-compatible" as const, sizes: ["1024x1024"] };
    expect(validateGenerationRequest({ prompt: "fleurs", references: [{ data: PNG }] }, compatible)).toBeNull();
    expect(validateGenerationRequest({ prompt: "fleurs" }, compatible)?.references).toEqual([]);
  });

  it("partent chez OpenRouter dans input_references, en data URL", async () => {
    const request = validateGenerationRequest({ prompt: "fleurs", references: [{ data: PNG }] }, CONFIG);
    if (!request) throw new Error("requête attendue");
    let sent: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ data: [{ b64_json: PNG }] }), { status: 200 });
    }) as unknown as typeof fetch;
    await generateWithOpenRouter(request, CONFIG, { fetchImpl });
    expect(sent.input_references).toEqual([{ type: "image_url", image_url: { url: `data:image/png;base64,${PNG}` } }]);
  });
});
