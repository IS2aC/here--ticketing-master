import type { ImageAsset } from "../domain/document/types.ts";

// Formats d'image acceptés. Le type est reconnu à la signature du fichier, jamais à son extension ni au type
// annoncé par le navigateur : un fichier déguisé est refusé. Un SVG est un texte dont la première balise est
// <svg> (après un éventuel prologue XML) ; il est ensuite nettoyé avant tout usage (rendering/svg.ts).

export type ImageMimeType = ImageAsset["mimeType"];

export const IMAGE_SIGNATURES: Readonly<Record<ImageMimeType, (bytes: Uint8Array) => boolean>> = {
  "image/png": (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) =>
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  "image/svg+xml": (b) => isSvgText(new TextDecoder().decode(b.slice(0, 1024))),
};

/** Début de fichier SVG : prologue XML, commentaires et doctype facultatifs, puis la balise <svg. */
export function isSvgText(head: string): boolean {
  const rest = head
    .replace(/^\uFEFF/, "")
    .replace(/^\s*<\?xml[^>]*\?>/, "")
    .replace(/^(\s*<!--[\s\S]*?-->)*/, "")
    .replace(/^\s*<!DOCTYPE[^>]*>/i, "");
  return /^\s*<svg[\s>]/.test(rest);
}

/** Type réel d'après les premiers octets ; null : ni PNG, ni JPEG, ni WebP. */
export function sniffImageType(bytes: Uint8Array): ImageMimeType | null {
  for (const [type, matches] of Object.entries(IMAGE_SIGNATURES) as [
    ImageMimeType,
    (b: Uint8Array) => boolean,
  ][])
    if (matches(bytes)) return type;
  return null;
}
