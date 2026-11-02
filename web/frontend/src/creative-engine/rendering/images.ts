import { useSyncExternalStore } from "react";

// Chargement des images par URL, partagé : un même fichier n'est téléchargé et décodé qu'une fois,
// quel que soit le nombre d'éléments qui l'affichent ou de rendus React.

export type ImageState =
  { status: "loading" } | { status: "loaded"; image: HTMLImageElement } | { status: "error" };

interface Entry {
  state: ImageState;
  listeners: Set<() => void>;
}

const cache = new Map<string, Entry>();
const LOADING: ImageState = { status: "loading" };
const MISSING: ImageState = { status: "error" };

function entryFor(url: string): Entry {
  const existing = cache.get(url);
  if (existing) return existing;

  const created: Entry = { state: LOADING, listeners: new Set() };
  cache.set(url, created);
  const image = new Image();
  // Requis pour que l'export (Phase 7) puisse lire les pixels d'une image d'une autre origine.
  image.crossOrigin = "anonymous";
  const settle = (state: ImageState) => {
    created.state = state;
    for (const listener of created.listeners) listener();
  };
  image.onload = () => {
    settle({ status: "loaded", image });
  };
  image.onerror = () => {
    settle({ status: "error" });
  };
  image.src = url;
  return created;
}

/** État de chargement d'une image ; `null` (pas d'URL résolue) est traité comme une erreur. */
export function useImage(url: string | null): ImageState {
  return useSyncExternalStore(
    (onChange) => {
      if (url === null) return () => undefined;
      const entry = entryFor(url);
      entry.listeners.add(onChange);
      return () => entry.listeners.delete(onChange);
    },
    () => (url === null ? MISSING : entryFor(url).state),
  );
}

/** Pour les tests : oublie les images chargées. */
export function clearImageCache(): void {
  cache.clear();
}
