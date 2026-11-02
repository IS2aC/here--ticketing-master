import { useState } from "react";
import { useEditorStore } from "../../editor/editorStore.ts";
import { importImages } from "../../editor/library.ts";

/** Import d'images de l'appareil (bouton Image de la barre d'outils, « Mes images ») et message de résultat. */
export function useImageImport(onImported?: () => void): {
  importing: boolean;
  importFiles: (files: readonly File[]) => Promise<void>;
} {
  const [importing, setImporting] = useState(false);
  const setNotice = useEditorStore((s) => s.setNotice);

  const importFiles = async (files: readonly File[]) => {
    if (files.length === 0) return;
    setImporting(true);
    const outcome = await importImages(files);
    setImporting(false);
    if (outcome.inserted > 0) onImported?.();
    if (outcome.errors.length > 0) {
      const added =
        outcome.inserted > 0
          ? `${outcome.inserted === 1 ? "1 image ajoutée" : `${outcome.inserted} images ajoutées`}. `
          : "";
      setNotice({ tone: "error", message: `${added}${outcome.errors.join(" ")}` });
    } else {
      setNotice({
        tone: "info",
        message:
          outcome.inserted === 1
            ? "Image ajoutée à la page et à vos images."
            : `${outcome.inserted} images ajoutées à la page et à vos images.`,
      });
    }
  };

  return { importing, importFiles };
}
