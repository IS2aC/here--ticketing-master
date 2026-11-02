import jsQR from "jsqr";
import { create } from "zustand";
import { DEFAULT_QR_STYLE, SAMPLE_QR_VALUE, type QrStyle } from "@/lib/card/qr";

// Style du QR code du sceau : réglage de Here! (mise en page de la carte), pas du document de l'éditeur.
// Il part avec la mise en page à la validation, et revient de la carte enregistrée à l'ouverture.

export const useQrStyle = create<{ style: QrStyle; set: (patch: Partial<QrStyle>) => void }>()((set) => ({
  style: DEFAULT_QR_STYLE,
  set: (patch) => {
    set((state) => ({ style: { ...state.style, ...patch } }));
  },
}));

/** Adresse du sceau d'exemple dessiné par Satori avec ce style. */
export function sealUrl(baseUrl: string, style: QrStyle): string {
  const query = new URLSearchParams({ points: style.dots, coins: style.corners, couleur: style.color });
  return `${baseUrl}/sceau.png?${query.toString()}`;
}

/** Relit le QR code du sceau (jsQR), tel que Satori l'a dessiné : vrai s'il redonne le bon lien. */
export async function sealIsScannable(url: string): Promise<boolean> {
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    // Agrandi ×2 : un téléphone voit le code plus grand que l'image de 260 px.
    canvas.width = image.naturalWidth * 2;
    canvas.height = image.naturalHeight * 2;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(data, width, height)?.data === SAMPLE_QR_VALUE;
  } catch {
    return false;
  }
}
