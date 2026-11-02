import { useRef, useState } from "react";
import { useEditorStore } from "../../editor/editorStore.ts";
import { assetLibraries, insertLibraryAsset, removeDeviceImage } from "../../editor/library.ts";
import { fail, type AssetOrigin, type LibraryAsset } from "../../library/contracts.ts";
import { Icon } from "../icons/Icon.tsx";
import { ActionButton } from "../primitives/ActionButton.tsx";
import { Thumbnail } from "./Thumbnail.tsx";
import { useImageImport } from "./useImageImport.ts";
import { useDebouncedValue, usePagedQuery } from "./usePagedQuery.ts";
import styles from "./Library.module.css";

const PAGE_SIZE = 24;
const TABS: readonly { origin: AssetOrigin; label: string }[] = [
  { origin: "bundled", label: "Ornements" },
  { origin: "device", label: "Mes images" },
];
/** En dessous, le panneau couvre la page : on le ferme après une insertion pour montrer le résultat. */
const NARROW = "(max-width: 767px)";

/** Ressources : ornements fournis avec l'éditeur et images importées sur cet appareil. */
export function AssetsBrowser() {
  const [origin, setOrigin] = useState<AssetOrigin>("bundled");
  const [text, setText] = useState("");
  const [version, setVersion] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setLibraryPanel = useEditorStore((s) => s.setLibraryPanel);
  const search = useDebouncedValue(text, 200);
  const inputRef = useRef<HTMLInputElement>(null);
  const { importing, importFiles } = useImageImport(() => {
    setOrigin("device");
    setVersion((v) => v + 1);
  });

  const { state, loadMore, retry } = usePagedQuery<LibraryAsset>(
    JSON.stringify([origin, search, version]),
    (cursor) => {
      const library = assetLibraries().find((l) => l.origin === origin);
      if (!library) return Promise.resolve(fail("unavailable", "Cette bibliothèque est indisponible."));
      return library.list({ text: search, cursor, limit: PAGE_SIZE });
    },
  );

  const insert = async (asset: LibraryAsset) => {
    setBusyId(asset.id);
    setError(null);
    const failure = await insertLibraryAsset(asset);
    setBusyId(null);
    if (failure) setError(`${asset.name} : ${failure.message}`);
    else if (window.matchMedia(NARROW).matches) setLibraryPanel(null);
  };

  const remove = async (asset: LibraryAsset) => {
    setConfirming(null);
    const failure = await removeDeviceImage(asset);
    if (failure) setError(failure.message);
    setVersion((v) => v + 1);
  };

  const isDevice = origin === "device";

  return (
    <div className={styles.browser}>
      <div className={styles.tabs} role="group" aria-label="Bibliothèque">
        {TABS.map((tab) => (
          <button
            key={tab.origin}
            type="button"
            className={styles.tab}
            aria-pressed={origin === tab.origin}
            onClick={() => {
              setOrigin(tab.origin);
              setConfirming(null);
              setError(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <p className={styles.intro}>
        {isDevice
          ? "Images importées depuis cet appareil. Elles ne sont visibles que dans ce navigateur."
          : "Ornements fournis avec l'éditeur, à utiliser dans vos créations."}
      </p>

      {isDevice && (
        <>
          <button
            type="button"
            className={styles.importButton}
            disabled={importing}
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="upload" size={18} />
            {importing ? "Import en cours…" : "Importer des images"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            data-testid="image-import-input"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              void importFiles(files);
            }}
          />
        </>
      )}

      <label className={styles.search}>
        <Icon name="search" size={18} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder={isDevice ? "Nom de l'image" : "Feuilles, fête, wax…"}
          aria-label="Rechercher une ressource"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      </label>

      {error && (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      )}

      <div className={styles.results} aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "loading" && <p className={styles.state}>Chargement des ressources…</p>}
        {state.status === "error" && (
          <div className={styles.state} role="alert">
            <p>{state.message}</p>
            <button type="button" className={styles.textButton} onClick={retry}>
              Réessayer
            </button>
          </div>
        )}
        {state.status === "ready" && state.items.length === 0 && (
          <p className={styles.state}>
            {search.trim() !== ""
              ? "Aucune ressource ne correspond à votre recherche."
              : isDevice
                ? "Vous n'avez pas encore importé d'image. Les images importées restent sur cet appareil."
                : "Aucun ornement n'est disponible pour l'instant."}
          </p>
        )}
        {state.status === "ready" && state.items.length > 0 && (
          <>
            <ul className={styles.assetGrid}>
              {state.items.map((asset) => (
                <li key={asset.id} className={styles.assetItem}>
                  <button
                    type="button"
                    className={styles.assetTile}
                    aria-label={`Ajouter « ${asset.name} » à la page`}
                    aria-busy={busyId === asset.id || undefined}
                    disabled={busyId !== null}
                    onClick={() => void insert(asset)}
                  >
                    <Thumbnail url={asset.thumbnailUrl} width={asset.width} height={asset.height} />
                    <span className={styles.assetName}>{busyId === asset.id ? "Ajout…" : asset.name}</span>
                  </button>
                  {asset.origin === "device" &&
                    (confirming === asset.id ? (
                      <div
                        className={styles.assetConfirm}
                        role="group"
                        aria-label={`Retirer « ${asset.name} »`}
                      >
                        <span>Retirer de mes images ? Les documents qui l'utilisent la gardent.</span>
                        <button type="button" className={styles.danger} onClick={() => void remove(asset)}>
                          Retirer
                        </button>
                        <button
                          type="button"
                          className={styles.textButton}
                          onClick={() => {
                            setConfirming(null);
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div className={styles.assetRemove}>
                        <ActionButton
                          label={`Retirer « ${asset.name} » de mes images`}
                          icon="trash"
                          tooltipSide="top"
                          onClick={() => {
                            setConfirming(asset.id);
                          }}
                        />
                      </div>
                    ))}
                </li>
              ))}
            </ul>
            {state.moreError && (
              <p className={styles.inlineError} role="alert">
                {state.moreError}
              </p>
            )}
            {state.nextCursor && (
              <button type="button" className={styles.more} onClick={loadMore} disabled={state.loadingMore}>
                {state.loadingMore ? "Chargement…" : "Afficher plus"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
