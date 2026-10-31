import type { Palette } from "@/lib/card/templates/definition";

// Palettes d'un modèle en pastilles : le fond de la carte, et la couleur des titres au centre.
export function Swatch({ palette, size = 20 }: { palette: Palette; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(11,11,11,.12)]"
      style={{ width: size, height: size, background: palette.colors.background }}
    >
      <span className="rounded-full" style={{ width: size * 0.45, height: size * 0.45, background: palette.colors.primary }} />
    </span>
  );
}

export function Swatches({ palettes }: { palettes: Palette[] }) {
  return (
    <span className="flex items-center gap-1.5">
      {palettes.map((p) => (
        <Swatch key={p.id} palette={p} />
      ))}
      <span className="sr-only">Palettes : {palettes.map((p) => p.label).join(", ")}</span>
    </span>
  );
}
