import type { PdfPage } from "./options.ts";

// Générateur PDF minimal (décision de la Phase 7 : aucune dépendance). Un PDF 1.4 d'une page, aux dimensions
// exactes, qui contient une seule image JPEG (filtre DCTDecode : les octets du JPEG sont intégrés tels quels,
// sans réencodage). Les marges sont nulles : l'image couvre toute la page, sans déformation (ses proportions
// sont celles de la page). Pas de texte sélectionnable : le PDF est matriciel (ADR-008).

export interface PdfImage {
  /** Fichier JPEG (RVB, 8 bits). */
  readonly jpeg: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export interface PdfMetadata {
  readonly title: string;
  readonly creationDate: Date;
}

const encoder = new TextEncoder();

/** Chaîne PDF : ASCII échappé, sinon UTF-16BE en hexadécimal (titres accentués). */
function pdfString(text: string): string {
  if (/^[\x20-\x7e]*$/.test(text)) return `(${text.replace(/[\\()]/g, (c) => `\\${c}`)})`;
  let hex = "FEFF";
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

/** Date PDF : D:AAAAMMJJHHmmSSZ (UTC). */
function pdfDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/** Nombre PDF : au plus 2 décimales, sans notation exponentielle. */
function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function createPdf(page: PdfPage, image: PdfImage, metadata: PdfMetadata): Uint8Array {
  const { widthPt: w, heightPt: h, trimBox } = page;
  const boxes = trimBox
    ? ` /BleedBox [0 0 ${num(w)} ${num(h)}] /TrimBox [${num(trimBox.x)} ${num(trimBox.y)} ${num(trimBox.x + trimBox.width)} ${num(trimBox.y + trimBox.height)}]`
    : "";
  const content = `q ${num(w)} 0 0 ${num(h)} 0 0 cm /Im0 Do Q\n`;

  // Objets dans l'ordre : catalogue, arbre des pages, page, image, contenu, informations.
  const parts: (string | Uint8Array)[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    parts.push(part);
    length += typeof part === "string" ? encoder.encode(part).length : part.length;
  };
  const object = (id: number, body: string | (string | Uint8Array)[]) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    for (const part of Array.isArray(body) ? body : [body]) push(part);
    push("\nendobj\n");
  };

  // En-tête ; la ligne de commentaire binaire signale aux outils un fichier binaire.
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(w)} ${num(h)}]${boxes} /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  object(4, [
    `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.jpeg.length} >>\nstream\n`,
    image.jpeg,
    "\nendstream",
  ]);
  object(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
  object(
    6,
    `<< /Title ${pdfString(metadata.title)} /Producer (Here! Creative Engine) /CreationDate (${pdfDate(metadata.creationDate)}) >>`,
  );

  const xref = length;
  const entries = offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`);
  push(`xref\n0 ${entries.length + 1}\n0000000000 65535 f \n${entries.join("")}`);
  push(`trailer\n<< /Size ${entries.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const bytes = new Uint8Array(length);
  let position = 0;
  for (const part of parts) {
    const chunk = typeof part === "string" ? encoder.encode(part) : part;
    bytes.set(chunk, position);
    position += chunk.length;
  }
  return bytes;
}
