import { useRef } from "react";
import type { ImageAsset } from "../../domain/document/types.ts";
import type { Id } from "../../domain/ids.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import { exportCurrentDocument, importDocumentFile, newDocument, saveNow } from "../../editor/persistence.ts";
import { FILE_EXTENSION } from "../../persistence/documentFile.ts";
import { useAssetResolver } from "../../rendering/assetResolverContext.ts";
import { download } from "../download.ts";
import { MenuButton } from "../primitives/MenuButton.tsx";

/** Menu « Document » : nouveau (vierge ou depuis un modèle), ouvrir, enregistrer, importer et exporter un fichier .here.json. */
export function DocumentMenu({ buttonClassName }: { buttonClassName?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resolve = useAssetResolver();
  const setNotice = useEditorStore((s) => s.setNotice);

  // Les images sont lues là où l'éditeur les affiche (fichiers embarqués ou stockés sur l'appareil).
  const readAsset = async (id: Id, asset: ImageAsset): Promise<Blob | null> => {
    const url = resolve(id, asset);
    if (!url) return null;
    try {
      const response = await fetch(url);
      return response.ok ? await response.blob() : null;
    } catch {
      return null;
    }
  };

  const exportFile = async () => {
    const result = await exportCurrentDocument(readAsset);
    if (!result.ok) {
      setNotice({ tone: "error", message: result.error.message });
      return;
    }
    download(result.value.blob, result.value.fileName);
    const missing = result.value.missingAssets.length;
    setNotice(
      missing > 0
        ? {
            tone: "error",
            message: `Fichier exporté sans ${missing === 1 ? "1 image introuvable" : `${missing} images introuvables`}.`,
          }
        : { tone: "info", message: `Fichier « ${result.value.fileName} » exporté.` },
    );
  };

  const importFile = async (file: File) => {
    const result = await importDocumentFile(file);
    setNotice(
      result.ok
        ? { tone: "info", message: `« ${file.name} » importé comme nouveau document.` }
        : { tone: "error", message: result.error.message },
    );
  };

  return (
    <MenuButton
      label="Document"
      menuLabel="Document"
      icon="folder"
      showLabel
      buttonClassName={buttonClassName}
      items={[
        {
          label: "Nouveau document",
          icon: "filePlus",
          onSelect: () => {
            void newDocument();
          },
        },
        {
          label: "Nouveau depuis un modèle…",
          icon: "template",
          onSelect: () => {
            useEditorStore.getState().setLibraryPanel("templates");
          },
        },
        {
          label: "Ouvrir un document…",
          icon: "folder",
          onSelect: () => {
            useEditorStore.getState().setDocumentsOpen(true);
          },
        },
        {
          label: "Enregistrer",
          icon: "save",
          hint: "Ctrl + S",
          onSelect: () => {
            void saveNow();
          },
        },
        {
          label: "Importer un fichier…",
          icon: "upload",
          onSelect: () => {
            inputRef.current?.click();
          },
        },
        {
          label: `Exporter en ${FILE_EXTENSION}`,
          icon: "download",
          onSelect: () => {
            void exportFile();
          },
        },
      ]}
    >
      <input
        ref={inputRef}
        type="file"
        accept={`${FILE_EXTENSION},.json,application/json`}
        hidden
        data-testid="import-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importFile(file);
        }}
      />
    </MenuButton>
  );
}
