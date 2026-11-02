import DOMPurify from "dompurify";

// Fichiers SVG (ornements, images importées) : un SVG est un document actif (scripts, liens, ressources
// externes). Il est nettoyé avant d'être enregistré ou affiché : seul le dessin reste.

/** Taille maximale d'un SVG importé : un ornement pèse quelques dizaines de Ko. */
export const MAX_SVG_BYTES = 2 * 1024 * 1024;

/**
 * Dessin seul : sans script, gestionnaire d'événement, objet étranger, ni lien vers l'extérieur (un `href` ne
 * peut viser qu'un élément du fichier, « #id »). null : ce n'est pas un SVG utilisable.
 */
export function sanitizeSvg(text: string): string | null {
  const purify = DOMPurify(window);
  purify.addHook("afterSanitizeAttributes", (node) => {
    for (const name of ["href", "xlink:href"]) {
      const value = node.getAttribute(name);
      if (value !== null && !value.trim().startsWith("#")) node.removeAttribute(name);
    }
  });
  const clean = purify.sanitize(text, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["foreignObject", "image", "script", "style"],
  });
  return /^\s*<svg[\s>]/.test(clean) ? clean : null;
}

function length(value: string | null): number | null {
  if (!value) return null;
  const match = /^\s*([\d.]+)\s*(px)?\s*$/.exec(value);
  const number = match ? Number(match[1]) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Dimensions intrinsèques : width et height en px, sinon la viewBox. null : inconnues. */
export function svgSize(text: string): { width: number; height: number } | null {
  const root = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
  if (root.nodeName !== "svg") return null;
  const width = length(root.getAttribute("width"));
  const height = length(root.getAttribute("height"));
  if (width && height) return { width: Math.round(width), height: Math.round(height) };
  const box = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  const [, , w = NaN, h = NaN] = box;
  return w > 0 && h > 0 ? { width: Math.round(w), height: Math.round(h) } : null;
}

/** Le SVG avec width et height explicites : sans eux, certains navigateurs le dessinent à 0 × 0 sur un canvas. */
export function withIntrinsicSize(text: string, size: { width: number; height: number }): string {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  root.setAttribute("width", String(size.width));
  root.setAttribute("height", String(size.height));
  if (!root.getAttribute("viewBox")) root.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
  return new XMLSerializer().serializeToString(doc);
}
