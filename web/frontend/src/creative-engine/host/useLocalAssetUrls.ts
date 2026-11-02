import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDocumentStore } from "../editor/documentStore.ts";
import { readLocalAsset } from "../editor/persistence.ts";

/**
 * URL temporaires (blob:) des images stockées sur l'appareil et utilisées par le document. Elles ne sont jamais
 * enregistrées : seule la clé l'est (ADR-007). Chaque fichier n'est lu qu'une fois ; les URL sont libérées
 * quand l'éditeur se ferme. `skip` : clés servies autrement (fichiers de démonstration).
 */
export function useLocalAssetUrls(skip: (key: string) => boolean): ReadonlyMap<string, string> {
  const keys = useDocumentStore(
    useShallow((s) =>
      Object.values(s.history.present.assets)
        .filter((asset) => asset.source.type === "local" && !skip(asset.source.key))
        .map((asset) => asset.source.key),
    ),
  );
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() => new Map());
  const created = useRef<string[]>([]);

  useEffect(() => {
    const missing = keys.filter((key) => !urls.has(key));
    if (missing.length === 0) return;
    let active = true;
    void Promise.all(missing.map(async (key) => [key, await readLocalAsset(key)] as const)).then((found) => {
      if (!active) return;
      const entries = found.flatMap(([key, blob]) =>
        blob ? [[key, URL.createObjectURL(blob)] as const] : [],
      );
      // Fichier introuvable : l'image affiche son état d'erreur ; pas de nouvelle lecture en boucle.
      if (entries.length === 0) return;
      created.current.push(...entries.map(([, url]) => url));
      setUrls((previous) => new Map([...previous, ...entries]));
    });
    return () => {
      active = false;
    };
  }, [keys, urls]);

  // Les clés étant des empreintes, une URL reste valable d'un document à l'autre pendant la session.
  useEffect(
    () => () => {
      for (const url of created.current) URL.revokeObjectURL(url);
      created.current = [];
    },
    [],
  );

  return urls;
}
