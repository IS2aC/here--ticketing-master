// Ajustement automatique du texte : la plus grande taille entre min et max qui tient dans la zone.
// Les lignes sont coupées ici, avec la largeur réelle des glyphes (measure.ts) : le rendu les dessine telles quelles,
// la carte affiche donc exactement ce qui a été mesuré.

/** Largeur d'un texte en pixels. */
export type Measure = (
  text: string,
  font: { family: string; weight: number; italic: boolean },
  size: number,
  letterSpacing: number, // en pixels
) => number;

export type FitRequest = {
  text: string;
  font: { family: string; weight: number; italic: boolean };
  width: number;
  height: number;
  min: number;
  max: number;
  maxLines: number;
  lineHeight: number;
  letterSpacing: number; // en em
};

export type FitResult = { size: number; lines: string[]; overflow: boolean };

const SAFETY = 0.98; // marge pour les petits écarts de crénage entre la mesure et le rendu

/** Coupe le texte en lignes de `width` au plus ; un mot trop long est coupé entre deux lettres. */
export function wrap(text: string, width: number, widthOf: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (widthOf(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      while (widthOf(line) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && widthOf(line.slice(0, cut)) > width) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    if (line || !lines.length) lines.push(line);
  }
  return lines;
}

export function fitText(request: FitRequest, measure: Measure): FitResult {
  const { font, lineHeight, maxLines } = request;
  const width = request.width * SAFETY;
  const fits = (size: number) => {
    const widthOf = (s: string) => measure(s, font, size, request.letterSpacing * size);
    const lines = wrap(request.text, width, widthOf);
    const tooWide = lines.some((l) => widthOf(l) > width);
    const ok = !tooWide && lines.length <= maxLines && lines.length * size * lineHeight <= request.height + 0.5;
    return { ok, lines, widthOf };
  };

  for (let size = Math.floor(request.max); size >= Math.ceil(request.min); size--) {
    const attempt = fits(size);
    if (attempt.ok) return { size, lines: attempt.lines, overflow: false };
  }

  // Trop long même à la taille minimale : on garde ce qui tient et on termine par « … ».
  const size = Math.ceil(request.min);
  const { lines, widthOf } = fits(size);
  const room = Math.max(1, Math.min(maxLines, Math.floor((request.height + 0.5) / (size * lineHeight))));
  const kept = lines.slice(0, room);
  let last = kept[kept.length - 1] ?? "";
  if (lines.length > room || widthOf(last) > width) {
    while (last && widthOf(`${last}…`) > width) last = last.slice(0, -1).trimEnd();
    kept[kept.length - 1] = `${last}…`;
  }
  return { size, lines: kept, overflow: true };
}
