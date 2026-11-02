import { useEffect, useMemo, useState } from "react";
import type { HexColor } from "../../domain/elements/types.ts";
import { useAssetResolver } from "../../rendering/assetResolverContext.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { photoColors } from "../../rendering/photoPalette.ts";

/** Couleurs des photos du document (hors SVG), quelques-unes par photo, de la plus présente à la moins présente. */
export function usePhotoPalette(max = 4): readonly HexColor[] {
  const resolve = useAssetResolver();
  const assets = useDocumentStore((s) => s.history.present.assets);
  const elements = useDocumentStore((s) => s.history.present.elements);
  const key = useMemo(() => {
    const urls = new Set<string>();
    for (const element of elements) {
      if (element.type !== "image" || element.hidden) continue;
      const asset = assets[element.assetId];
      if (!asset || asset.mimeType === "image/svg+xml") continue;
      const url = resolve(element.assetId, asset);
      if (url) urls.add(url);
    }
    return [...urls].join("\n");
  }, [assets, elements, resolve]);
  const [result, setResult] = useState<{ key: string; colors: HexColor[] }>({ key: "", colors: [] });

  useEffect(() => {
    if (!key) return;
    let active = true;
    void Promise.all(key.split("\n").map(photoColors)).then((lists) => {
      // Les premières couleurs de chaque photo d'abord, puis les suivantes.
      const merged: HexColor[] = [];
      for (let rank = 0; rank < 5; rank++) for (const list of lists) if (list[rank]) merged.push(list[rank] as HexColor);
      if (active) setResult({ key, colors: [...new Set(merged)].slice(0, max) });
    });
    return () => {
      active = false;
    };
  }, [key, max]);

  return result.key === key ? result.colors : [];
}
