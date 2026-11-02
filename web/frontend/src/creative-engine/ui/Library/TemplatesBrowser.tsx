import { useEffect, useState } from "react";
import type { PagePreset } from "../../domain/document/types.ts";
import { templateCatalog } from "../../editor/library.ts";
import type { TemplateCategory, TemplateFacets, TemplateSummary } from "../../library/contracts.ts";
import { fail } from "../../library/contracts.ts";
import { CATEGORY_LABELS, presetLabel, templateMeta } from "../../library/labels.ts";
import { Icon } from "../icons/Icon.tsx";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog.tsx";
import { Thumbnail } from "./Thumbnail.tsx";
import { useDebouncedValue, usePagedQuery } from "./usePagedQuery.ts";
import styles from "./Library.module.css";

const PAGE_SIZE = 12;

/** Modèles : recherche, catégories et formats réellement présents, grille de vignettes, aperçu. */
export function TemplatesBrowser() {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<TemplateCategory | null>(null);
  const [preset, setPreset] = useState<PagePreset | null>(null);
  const [facets, setFacets] = useState<TemplateFacets | null>(null);
  const [previewed, setPreviewed] = useState<TemplateSummary | null>(null);
  const search = useDebouncedValue(text, 200);

  useEffect(() => {
    let active = true;
    void templateCatalog()
      ?.facets()
      .then((result) => {
        if (active && result.ok) setFacets(result.value);
      });
    return () => {
      active = false;
    };
  }, []);

  const { state, loadMore, retry } = usePagedQuery<TemplateSummary>(
    JSON.stringify([search, category, preset]),
    (cursor) => {
      const catalog = templateCatalog();
      if (!catalog) return Promise.resolve(fail("unavailable", "Les modèles sont indisponibles."));
      return catalog.list({ text: search, category, preset, cursor, limit: PAGE_SIZE });
    },
  );

  const filtered = search.trim() !== "" || category !== null || preset !== null;
  const reset = () => {
    setText("");
    setCategory(null);
    setPreset(null);
  };

  return (
    <div className={styles.browser}>
      <p className={styles.intro}>
        Modèles de départ fournis avec l'éditeur. Chaque modèle crée un nouveau document.
      </p>

      <label className={styles.search}>
        <Icon name="search" size={18} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Mariage, anniversaire, A5…"
          aria-label="Rechercher un modèle"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      </label>

      {facets && facets.categories.length > 1 && (
        <div className={styles.chips} role="group" aria-label="Catégorie">
          <button
            type="button"
            className={styles.chip}
            aria-pressed={category === null}
            onClick={() => {
              setCategory(null);
            }}
          >
            Toutes
          </button>
          {facets.categories.map((c) => (
            <button
              key={c}
              type="button"
              className={styles.chip}
              aria-pressed={category === c}
              onClick={() => {
                setCategory(category === c ? null : c);
              }}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      )}

      {facets && facets.presets.length > 1 && (
        <label className={styles.filter}>
          <span>Format</span>
          <select
            className={styles.select}
            value={preset ?? ""}
            onChange={(event) => {
              setPreset(event.target.value === "" ? null : (event.target.value as PagePreset));
            }}
          >
            <option value="">Tous les formats</option>
            {facets.presets.map((p) => (
              <option key={p} value={p}>
                {presetLabel(p)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className={styles.results} aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "loading" && <p className={styles.state}>Chargement des modèles…</p>}
        {state.status === "error" && (
          <div className={styles.state} role="alert">
            <p>{state.message}</p>
            <button type="button" className={styles.textButton} onClick={retry}>
              Réessayer
            </button>
          </div>
        )}
        {state.status === "ready" && state.items.length === 0 && (
          <div className={styles.state}>
            <p>
              {filtered
                ? "Aucun modèle ne correspond à votre recherche. Essayez un autre mot ou retirez les filtres."
                : "Aucun modèle n'est disponible pour l'instant."}
            </p>
            {filtered && (
              <button type="button" className={styles.textButton} onClick={reset}>
                Effacer la recherche et les filtres
              </button>
            )}
          </div>
        )}
        {state.status === "ready" && state.items.length > 0 && (
          <>
            <p className={styles.count}>{state.total === 1 ? "1 modèle" : `${state.total} modèles`}</p>
            <ul className={styles.templateGrid}>
              {state.items.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    className={styles.templateCard}
                    aria-haspopup="dialog"
                    onClick={() => {
                      setPreviewed(template);
                    }}
                  >
                    <Thumbnail
                      url={template.thumbnailUrl}
                      width={template.page.width}
                      height={template.page.height}
                    />
                    <span className={styles.cardName}>{template.name}</span>
                    <span className={styles.cardMeta}>{templateMeta(template)}</span>
                  </button>
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
                {state.loadingMore ? "Chargement…" : "Afficher plus de modèles"}
              </button>
            )}
          </>
        )}
      </div>

      <TemplatePreviewDialog
        template={previewed}
        onClose={() => {
          setPreviewed(null);
        }}
      />
    </div>
  );
}
