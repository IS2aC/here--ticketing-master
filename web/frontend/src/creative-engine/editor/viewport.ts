// Vue de la zone de travail : le seul endroit où se convertissent coordonnées du document et de l'écran.
// Repère écran : px CSS relatifs au coin supérieur gauche de la zone de travail.
// Vue : le point (0, 0) du document est affiché en (x, y), à l'échelle `zoom`.
// Zoom et déplacement de la vue ne modifient jamais le document.

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  zoom: number;
  x: number;
  y: number;
}

export const ZOOM_LIMITS = { min: 0.1, max: 4 } as const;

/** Paliers des boutons zoom avant / arrière. */
export const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

/** Marge autour de la page en mode « ajuster », et partie de la page qui reste toujours visible. */
export const FIT_PADDING = 48;
export const MIN_VISIBLE_PAGE = 48;

export interface FitOptions {
  /** Marge autour de la page, en pixels écran. */
  padding: number;
  /** Échelle maximale : une petite page n'est pas agrandie au-delà. */
  maxScale: number;
}

const DEFAULT_FIT: FitOptions = { padding: FIT_PADDING, maxScale: 1 };

/**
 * Échelle d'affichage qui fait tenir la page entière dans la zone de travail.
 * Renvoie null tant que la zone n'a pas de taille utilisable (pas encore mesurée, ou trop petite).
 */
export function fitPageToViewport(
  page: Size,
  viewport: Size,
  options: FitOptions = DEFAULT_FIT,
): number | null {
  if (page.width <= 0 || page.height <= 0) {
    throw new RangeError(`Dimensions de page invalides : ${page.width} × ${page.height}`);
  }
  const availableWidth = viewport.width - options.padding * 2;
  const availableHeight = viewport.height - options.padding * 2;
  if (availableWidth <= 0 || availableHeight <= 0) return null;

  return Math.min(availableWidth / page.width, availableHeight / page.height, options.maxScale);
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, zoom));
}

/** Page centrée dans la zone, à l'échelle donnée. */
export function centeredViewport(page: Size, container: Size, zoom: number): Viewport {
  const z = clampZoom(zoom);
  return { zoom: z, x: (container.width - page.width * z) / 2, y: (container.height - page.height * z) / 2 };
}

/** « Ajuster » : page entière et centrée ; null si la zone n'est pas encore mesurable. */
export function fitViewport(page: Size, container: Size): Viewport | null {
  const zoom = fitPageToViewport(page, container);
  return zoom === null ? null : centeredViewport(page, container, Math.max(zoom, ZOOM_LIMITS.min));
}

export function documentToScreen(point: Point, view: Viewport): Point {
  return { x: view.x + point.x * view.zoom, y: view.y + point.y * view.zoom };
}

export function screenToDocument(point: Point, view: Viewport): Point {
  return { x: (point.x - view.x) / view.zoom, y: (point.y - view.y) / view.zoom };
}

/** Change le zoom en gardant immobile, à l'écran, le point du document situé sous `anchor`. */
export function zoomAt(view: Viewport, zoom: number, anchor: Point): Viewport {
  const z = clampZoom(zoom);
  const fixed = screenToDocument(anchor, view);
  return { zoom: z, x: anchor.x - fixed.x * z, y: anchor.y - fixed.y * z };
}

/** Palier suivant (direction 1) ou précédent (-1), strictement différent du zoom courant. */
export function nextZoomStep(zoom: number, direction: 1 | -1): number {
  const tolerance = 0.001;
  const step =
    direction === 1
      ? ZOOM_STEPS.find((s) => s > zoom + tolerance)
      : ZOOM_STEPS.findLast((s) => s < zoom - tolerance);
  return step ?? (direction === 1 ? ZOOM_LIMITS.max : ZOOM_LIMITS.min);
}

/** Facteur de zoom pour une molette : proportionnel au défilement, borné pour éviter les sauts. */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-Math.max(-100, Math.min(100, deltaY)) * 0.002);
}

/** Empêche de « perdre » la page : au moins MIN_VISIBLE_PAGE px restent visibles sur chaque axe. */
export function clampPan(view: Viewport, page: Size, container: Size): Viewport {
  const keep = (offset: number, pageLength: number, containerLength: number) => {
    const visible = Math.min(MIN_VISIBLE_PAGE, pageLength, containerLength);
    return Math.min(containerLength - visible, Math.max(visible - pageLength, offset));
  };
  return {
    zoom: view.zoom,
    x: keep(view.x, page.width * view.zoom, container.width),
    y: keep(view.y, page.height * view.zoom, container.height),
  };
}

/** Pourcentage affiché à l'utilisateur (arrondi, au moins 1 %). */
export function formatZoom(scale: number): string {
  return `${Math.max(1, Math.round(scale * 100))} %`;
}
