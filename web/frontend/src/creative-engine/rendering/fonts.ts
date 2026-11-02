import { useEffect, useState } from "react";
import type { TextStyle } from "../domain/elements/types.ts";

// Chargement des polices avant le dessin d'un texte : Konva mesure le texte au moment où il le dessine ;
// dessiner avant le chargement donnerait des retours à la ligne faux, qui ne se corrigeraient pas seuls.
// Les polices sont déclarées en @font-face (styles/fonts.css) et ne sont téléchargées qu'à la demande.

/** Délai au-delà duquel le texte est dessiné avec la police de secours plutôt que de rester invisible. */
const FONT_TIMEOUT_MS = 3000;

const settled = new Set<string>();
const pending = new Map<string, Promise<void>>();

function fontKey(style: Pick<TextStyle, "fontFamily" | "fontWeight" | "fontStyle">): string {
  return `${style.fontStyle} ${style.fontWeight} 16px "${style.fontFamily}"`;
}

/** Charge une police ; se résout aussi en cas d'échec ou de dépassement du délai (police de secours). */
export function ensureFont(style: Pick<TextStyle, "fontFamily" | "fontWeight" | "fontStyle">): Promise<void> {
  const key = fontKey(style);
  if (settled.has(key)) return Promise.resolve();
  let promise = pending.get(key);
  if (!promise) {
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS));
    const load = document.fonts.load(key).then(
      () => undefined,
      () => undefined,
    );
    promise = Promise.race([load, timeout]).then(() => {
      settled.add(key);
      pending.delete(key);
    });
    pending.set(key, promise);
  }
  return promise;
}

/**
 * Vrai si la police est déclarée (@font-face) et chargée. `document.fonts.check` seul répond « oui » pour une
 * famille inconnue (le navigateur prendrait une police système) : on exige aussi qu'elle soit déclarée.
 */
export function isFontAvailable(style: Pick<TextStyle, "fontFamily" | "fontWeight" | "fontStyle">): boolean {
  const declared = Array.from(document.fonts).some(
    (face) => face.family.replace(/^["']|["']$/g, "") === style.fontFamily && face.status === "loaded",
  );
  return declared && document.fonts.check(fontKey(style));
}

/** Vrai quand la police du style peut être utilisée pour mesurer et dessiner. */
export function useFontReady(style: Pick<TextStyle, "fontFamily" | "fontWeight" | "fontStyle">): boolean {
  const { fontFamily, fontWeight, fontStyle } = style;
  const key = fontKey(style);
  const [readyKey, setReadyKey] = useState(() => (settled.has(key) ? key : null));

  useEffect(() => {
    if (settled.has(key)) return;
    let active = true;
    void ensureFont({ fontFamily, fontWeight, fontStyle }).then(() => {
      if (active) setReadyKey(key);
    });
    return () => {
      active = false;
    };
  }, [key, fontFamily, fontWeight, fontStyle]);

  return settled.has(key) || readyKey === key;
}
