import type { HexColor } from "../domain/elements/types.ts";
import { dominantColors } from "../editor/colors.ts";

// Palette tirée d'une photo (recommandation 7) : la photo réduite à 64 px de côté, puis ses couleurs
// dominantes. Une fois par URL : le résultat est gardé.

const SIDE = 64;
const cache = new Map<string, Promise<HexColor[]>>();

function analyse(url: string): Promise<HexColor[]> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const scale = Math.min(1, SIDE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return resolve([]);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        resolve(dominantColors(context.getImageData(0, 0, canvas.width, canvas.height).data));
      } catch {
        // Image d'une autre origine sans CORS : pas de palette, l'éditeur fonctionne sans.
        resolve([]);
      }
    };
    image.onerror = () => resolve([]);
    image.src = url;
  });
}

/** Couleurs dominantes de la photo à cette URL, de la plus présente à la moins présente. */
export function photoColors(url: string): Promise<HexColor[]> {
  const known = cache.get(url);
  if (known) return known;
  const created = analyse(url);
  cache.set(url, created);
  return created;
}
