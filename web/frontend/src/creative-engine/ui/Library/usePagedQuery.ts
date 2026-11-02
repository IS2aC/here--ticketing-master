import { useEffect, useEffectEvent, useState } from "react";
import type { LibraryResult, ResultPage } from "../../library/contracts.ts";

// Lecture paginée d'une bibliothèque : première page à chaque changement de requête, pages suivantes à la
// demande. Une réponse arrivée après un changement de requête (frappe rapide, filtre) est ignorée.

export type PagedState<T> =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly items: readonly T[];
      readonly total: number;
      readonly nextCursor: string | null;
      readonly loadingMore: boolean;
      /** Échec du chargement de la page suivante (les résultats déjà affichés restent). */
      readonly moreError: string | null;
    };

const LOADING = { status: "loading" } as const;

export function usePagedQuery<T>(
  /** Change dès que la requête change (texte, filtres) : on repart de la première page. */
  queryKey: string,
  fetchPage: (cursor: string | null) => Promise<LibraryResult<ResultPage<T>>>,
): { state: PagedState<T>; loadMore: () => void; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${queryKey}#${attempt}`;
  const [result, setResult] = useState<{ key: string; state: PagedState<T> } | null>(null);
  const fetchLatest = useEffectEvent(fetchPage);

  useEffect(() => {
    let active = true;
    void fetchLatest(null).then((page) => {
      if (!active) return;
      setResult({
        key: requestKey,
        state: page.ok
          ? { status: "ready", ...page.value, loadingMore: false, moreError: null }
          : { status: "error", message: page.error.message },
      });
    });
    return () => {
      active = false;
    };
  }, [requestKey]);

  const state = result?.key === requestKey ? result.state : LOADING;

  const loadMore = () => {
    if (state.status !== "ready" || !state.nextCursor || state.loadingMore) return;
    const key = requestKey;
    setResult({ key, state: { ...state, loadingMore: true, moreError: null } });
    void fetchPage(state.nextCursor).then((page) => {
      setResult((current) => {
        if (current?.key !== key || current.state.status !== "ready") return current;
        const previous = current.state;
        return {
          key,
          state: page.ok
            ? {
                ...previous,
                items: [...previous.items, ...page.value.items],
                nextCursor: page.value.nextCursor,
                loadingMore: false,
              }
            : { ...previous, loadingMore: false, moreError: page.error.message },
        };
      });
    });
  };

  return {
    state,
    loadMore,
    retry: () => {
      setAttempt((n) => n + 1);
    },
  };
}

/** Valeur qui ne suit `value` qu'après `delay` ms sans changement (recherche pendant la frappe). */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);
  return debounced;
}
