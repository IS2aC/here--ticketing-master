import type { HexColor } from "../../domain/elements/types.ts";

const HEX = /^#?([0-9a-f]{6}([0-9a-f]{2})?)$/i;

/** Couleur saisie au clavier (« e10600 », « #E10600CC »), normalisée en majuscules ; sinon null. */
export function parseHexColor(text: string): HexColor | null {
  const match = HEX.exec(text.trim());
  return match?.[1] ? `#${match[1].toUpperCase()}` : null;
}
