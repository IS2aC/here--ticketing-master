import { useMemo } from "react";
import type { HexColor } from "../../domain/elements/types.ts";
import { documentPalette, harmonies } from "../../editor/colors.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { usePhotoPalette } from "./usePhotoPalette.ts";

/**
 * Couleurs à proposer sous un champ : celles du document, celles de ses photos, puis les harmonies de la
 * couleur actuelle.
 */
export function useSwatches(value: HexColor | null): readonly HexColor[] {
  const doc = useDocumentStore((s) => s.history.present);
  const photos = usePhotoPalette();
  return useMemo(() => {
    const colors = [...documentPalette(doc, 6), ...photos, ...(value ? harmonies(value) : [])];
    return [...new Set(colors)].slice(0, 12);
  }, [doc, photos, value]);
}
