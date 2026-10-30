/* eslint-disable @next/next/no-img-element -- Satori dessine une image : <img> est le seul moyen d'y placer fonds, ornements et photo. */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { CompactSeal, SEAL_SIZE } from "../seal";
import { contrastRatio, contrastThreshold, resolveColor, svgUri, tintSvg } from "./color";
import {
  FORMATS,
  PLACEHOLDER,
  placeholders,
  type Box,
  type CardDefinition,
  type CardFormat,
  type ColorKey,
  type Layer,
  type TemplateField,
  type TextLayer,
  type ThemeOverrides,
} from "./definition";
import { fitText, type Measure } from "./fit";

// Moteur de rendu des modèles : définition + valeurs + format → élément à dessiner, et alertes.
// Sans dépendance au serveur ni à l'interface : il sert aux images (render.tsx, Satori), et pourra servir
// à l'aperçu de l'éditeur et à la page d'invitation. Satori : uniquement flexbox ; une boîte à plusieurs enfants est en flex.

export type AssetData = { svg: string } | { uri: string };

/** Invité de la carte envoyée : nom, table / catégorie, code et QR code (data: URI). */
export type GuestData = { name: string; table: string | null; code: string; qr: string };

export type ComposeInput = {
  definition: CardDefinition;
  format: CardFormat;
  values: Record<string, string>; // valeurs des champs, déjà résolues (saisie, sinon événement, sinon défaut)
  overrides?: ThemeOverrides;
  assets: Record<string, AssetData>; // images du modèle, par clé
  photo?: string | null; // photo ajoutée par l'organisateur (data: URI)
  guest?: GuestData | null; // sans invité : carte générique (exports), sans nom ni QR code
  measure: Measure;
  placeholders?: boolean; // éditeur : zone photo vide signalée
};

export type CardWarning = { layer: string; kind: "overflow" | "contrast"; message: string };

export type ComposedCard = { width: number; height: number; element: ReactElement; warnings: CardWarning[] };

const DATE = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Valeur telle qu'affichée : « Samedi 1er novembre 2026 », « 15 h 30 ». */
export function displayValue(field: TemplateField | undefined, value: string): string {
  if (field?.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const text = DATE.format(new Date(`${value}T00:00:00Z`)).replace(/^(\S+) 1 /, "$1 1er ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (field?.type === "time" && /^\d{2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(":");
    return `${Number(h)} h${m === "00" ? "" : ` ${m}`}`;
  }
  return value;
}

/** Texte d'un calque avec ses champs ; null si l'un d'eux est vide (le calque n'est pas affiché). */
export function fillText(
  text: string,
  fields: TemplateField[],
  values: Record<string, string>,
  guest: GuestData | null | undefined,
): string | null {
  let missing = false;
  const filled = text.replace(PLACEHOLDER, (_, key: string) => {
    const raw =
      key === "invite.nom" ? guest?.name : key === "invite.table" ? guest?.table : displayValue(fields.find((f) => f.key === key), values[key] ?? "");
    const value = raw?.trim() ?? "";
    if (!value) missing = true;
    return value;
  });
  return missing ? null : filled;
}

/** Position d'un calque dans un format, ou null s'il n'y est pas affiché. */
export function layerBox(layer: Layer, format: CardFormat, overrides: ThemeOverrides = {}): Box | null {
  const own = layer.formats?.[format];
  if (layer.hidden || own?.hidden) return null;
  if (layer.type === "image" && layer.ornament && overrides.hidden?.includes(layer.id)) return null;
  const box = own?.box ?? layer.box;
  const moved = layer.movable ? overrides.moves?.[layer.id] : undefined;
  if (!moved) return box;
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  return { ...box, x: clamp(moved.x, 100 - box.w), y: clamp(moved.y, 100 - box.h) };
}

const JUSTIFY = { top: "flex-start", middle: "center", bottom: "flex-end" } as const;
const ALIGN = { left: "flex-start", center: "center", right: "flex-end" } as const;

export function composeCard(input: ComposeInput): ComposedCard {
  const { definition, format, values, overrides = {}, guest } = input;
  const f = FORMATS[format];
  const scale = f.width / 1080;
  const width = f.width + 2 * f.bleed;
  const height = f.height + 2 * f.bleed;
  const palette = definition.theme.palettes.find((p) => p.id === overrides.palette) ?? definition.theme.palettes[0];
  const fonts = definition.theme.fonts.find((p) => p.id === overrides.fonts) ?? definition.theme.fonts[0];
  const color = (ref: Parameters<typeof resolveColor>[0]) => resolveColor(ref, palette.colors as Record<ColorKey, string>);
  const warnings: CardWarning[] = [];

  // Pixels d'une zone ; fonds et formes qui touchent un bord s'étendent dans le fond perdu (A5).
  const px = (b: Box, toBleed: boolean) => {
    let left = f.bleed + (b.x / 100) * f.width;
    let top = f.bleed + (b.y / 100) * f.height;
    let w = (b.w / 100) * f.width;
    let h = (b.h / 100) * f.height;
    if (toBleed && f.bleed) {
      if (b.x <= 0) [left, w] = [left - f.bleed, w + f.bleed];
      if (b.y <= 0) [top, h] = [top - f.bleed, h + f.bleed];
      if (b.x + b.w >= 100) w += f.bleed;
      if (b.y + b.h >= 100) h += f.bleed;
    }
    return { left, top, width: w, height: h };
  };

  const labelOf = (layer: TextLayer) => {
    const key = placeholders(layer.text).find((k) => !k.startsWith("invite."));
    return definition.fields.find((field) => field.key === key)?.label ?? (layer.text.includes("{invite.nom}") ? "Nom de l'invité" : layer.text);
  };

  const drawn: ReactNode[] = [];
  for (const layer of definition.layers) {
    const box = layerBox(layer, format, overrides);
    if (!box) continue;
    const at = px(box, layer.type === "image" || layer.type === "shape");
    const place: CSSProperties = { position: "absolute", left: at.left, top: at.top, width: at.width, height: at.height };

    if (layer.type === "image") {
      const asset = input.assets[layer.asset];
      if (!asset) continue;
      const src = "svg" in asset ? svgUri(layer.tint ? tintSvg(asset.svg, color(layer.tint)) : asset.svg) : asset.uri;
      drawn.push(
        <img
          key={layer.id}
          src={src}
          width={at.width}
          height={at.height}
          alt=""
          style={{ ...place, objectFit: layer.fit ?? "cover", opacity: layer.opacity ?? 1 }}
        />,
      );
    } else if (layer.type === "shape") {
      const stroke = layer.stroke ? color(layer.stroke) : null;
      const strokeWidth = (layer.stroke_width ?? 0) * scale;
      if (layer.shape === "line") {
        const thickness = Math.max(strokeWidth, 1);
        drawn.push(
          <div
            key={layer.id}
            style={{ ...place, top: at.top + (at.height - thickness) / 2, height: thickness, background: stroke ?? (layer.fill ? color(layer.fill) : "transparent"), opacity: layer.opacity ?? 1 }}
          />,
        );
      } else {
        drawn.push(
          <div
            key={layer.id}
            style={{
              ...place,
              background: layer.fill ? color(layer.fill) : "transparent",
              border: stroke && strokeWidth ? `${strokeWidth}px solid ${stroke}` : undefined,
              borderRadius: layer.shape === "ellipse" ? "50%" : (layer.radius ?? 0) * scale,
              opacity: layer.opacity ?? 1,
            }}
          />,
        );
      }
    } else if (layer.type === "photo") {
      const radius =
        layer.mask === "circle" ? "50%" : layer.mask === "arch" ? `${at.width / 2}px ${at.width / 2}px 0 0` : 0;
      const border = layer.border && layer.border_width ? `${layer.border_width * scale}px solid ${color(layer.border)}` : undefined;
      if (input.photo) {
        drawn.push(
          <img key={layer.id} src={input.photo} width={at.width} height={at.height} alt="" style={{ ...place, objectFit: "cover", borderRadius: radius, border }} />,
        );
      } else if (input.placeholders) {
        drawn.push(
          <div
            key={layer.id}
            style={{
              ...place,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radius,
              border: `${2 * scale}px dashed ${color("text")}`,
              color: color("text"),
              opacity: 0.55,
              fontFamily: fonts.body,
              fontSize: 26 * scale,
            }}
          >
            Votre photo
          </div>,
        );
      }
    } else if (layer.type === "qr") {
      if (!guest) continue;
      const s = Math.min(at.width / SEAL_SIZE.width, at.height / SEAL_SIZE.height);
      drawn.push(
        <CompactSeal
          key={layer.id}
          qr={guest.qr}
          code={guest.code}
          scale={s}
          left={at.left + (at.width - SEAL_SIZE.width * s) / 2}
          top={at.top + (at.height - SEAL_SIZE.height * s) / 2}
        />,
      );
    } else {
      const filled = fillText(layer.text, definition.fields, values, guest);
      if (filled === null) continue;
      const text = layer.uppercase ? filled.toLocaleUpperCase("fr-FR") : filled;
      const font = { family: fonts[layer.font ?? "body"], weight: layer.weight ?? 400, italic: layer.italic ?? false };
      const lineHeight = layer.line_height ?? 1.2;
      const fit = fitText(
        {
          text,
          font,
          width: at.width,
          height: at.height,
          min: layer.size.min * scale,
          max: layer.size.max * scale,
          maxLines: layer.max_lines ?? 2,
          lineHeight,
          letterSpacing: layer.letter_spacing ?? 0,
        },
        input.measure,
      );
      const fg = color(layer.color ?? "text");
      if (fit.overflow) {
        warnings.push({ layer: layer.id, kind: "overflow", message: `« ${labelOf(layer)} » est trop long pour la carte : raccourcissez-le.` });
      }
      const ratio = contrastRatio(fg, color(layer.backdrop ?? "background"));
      if (ratio < contrastThreshold(fit.size, scale)) {
        warnings.push({ layer: layer.id, kind: "contrast", message: `« ${labelOf(layer)} » ressort mal sur le fond : choisissez une autre palette.` });
      }
      drawn.push(
        <div
          key={layer.id}
          style={{
            ...place,
            display: "flex",
            flexDirection: "column",
            justifyContent: JUSTIFY[layer.valign ?? "middle"],
            alignItems: ALIGN[layer.align ?? "center"],
            fontFamily: font.family,
            fontWeight: font.weight,
            fontStyle: font.italic ? "italic" : "normal",
            fontSize: fit.size,
            lineHeight,
            letterSpacing: (layer.letter_spacing ?? 0) * fit.size,
            color: fg,
          }}
        >
          {fit.lines.map((line, i) => (
            <div key={i} style={{ display: "flex", whiteSpace: "pre" }}>
              {line}
            </div>
          ))}
        </div>,
      );
    }
  }

  const element = (
    <div style={{ display: "flex", position: "relative", width, height, background: palette.colors.background, fontFamily: fonts.body }}>
      {drawn}
    </div>
  );
  return { width, height, element, warnings };
}
