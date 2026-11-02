import { useEffect, useState } from "react";
import type { ImageAsset } from "../domain/document/types.ts";
import type { HexColor, ImageElement } from "../domain/elements/types.ts";
import { sanitizeSvg } from "../persistence/svgFiles.ts";
import { recolorSvg } from "./svgRecolor.ts";

// Images SVG teintées : le fichier est relu, nettoyé, recoloré (svgRecolor.ts), puis servi par une URL blob:.
// Une même image dans une même teinte n'est préparée qu'une fois, pour l'écran comme pour l'export.

const tinted = new Map<string, Promise<string | null>>();

/** Teinte à appliquer à l'image d'un élément ; null : couleurs d'origine (ou image matricielle). */
export function tintOf(element: ImageElement, asset: ImageAsset | undefined): HexColor | null {
  return asset?.mimeType === "image/svg+xml" && element.tint ? element.tint : null;
}

/** Clé de l'image décodée d'un élément : sa ressource, et sa teinte s'il en a une. */
export function imageKey(element: ImageElement, asset: ImageAsset | undefined): string {
  const tint = tintOf(element, asset);
  return tint ? `${element.assetId}|${tint}` : element.assetId;
}

/** URL du SVG recoloré dans `tint` ; null si le fichier est illisible. */
export function tintedSvgUrl(url: string, tint: HexColor): Promise<string | null> {
  const key = `${url}|${tint}`;
  let promise = tinted.get(key);
  if (!promise) {
    promise = fetch(url)
      .then((response) => (response.ok ? response.text() : null))
      .then((text) => {
        const clean = text ? sanitizeSvg(text) : null;
        if (!clean) return null;
        return URL.createObjectURL(new Blob([recolorSvg(clean, tint)], { type: "image/svg+xml" }));
      })
      .catch(() => null);
    tinted.set(key, promise);
  }
  return promise;
}

/** URL à afficher pour l'image d'un élément : l'originale, ou sa version teintée une fois prête. */
export function useTintedUrl(url: string | null, tint: HexColor | null): string | null {
  const [ready, setReady] = useState<{ key: string; url: string | null } | null>(null);
  const key = url && tint ? `${url}|${tint}` : null;
  useEffect(() => {
    if (!key || !url || !tint) return;
    let active = true;
    void tintedSvgUrl(url, tint).then((result) => {
      if (active) setReady({ key, url: result });
    });
    return () => {
      active = false;
    };
  }, [key, url, tint]);
  if (!key) return url;
  // Pendant la préparation : l'originale, pour ne pas faire clignoter l'élément.
  return ready?.key === key ? ready.url : url;
}
