import { useState } from "react";
import smartcrop from "smartcrop";
import type { ImageAsset } from "../../domain/document/types.ts";
import type { ImageElement, ImageMask, PhotoAdjustments } from "../../domain/elements/types.ts";
import { commitLiveEdit, previewElements, updateElements } from "../../editor/actions.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { cropFor, cropFromPixels, framingOf, MAX_ZOOM, type Framing } from "../../editor/photoCrop.ts";
import { useAssetResolver } from "../../rendering/assetResolverContext.ts";
import { useImage } from "../../rendering/images.ts";
import { Slider } from "../primitives/Slider.tsx";
import { Toggle } from "../primitives/Segmented.tsx";
import { MIXED, shared } from "./selection.ts";
import styles from "./PropertiesPanel.module.css";

// Photo (recommandation 5) : cadrage sur le sujet, médaillon avec fondu des bords, réglages. Le médaillon et
// les réglages s'appliquent à toutes les images sélectionnées ; le cadrage, à une seule.

const SHAPES = [
  { value: "rect", label: "Cadre" },
  { value: "rounded", label: "Arrondi" },
  { value: "ellipse", label: "Ovale" },
  { value: "arch", label: "Arche" },
] as const satisfies readonly { value: ImageMask["shape"]; label: string }[];

const NEUTRAL: PhotoAdjustments = { brightness: 0, contrast: 0, saturation: 0, blur: 0 };

const LOOKS: readonly { label: string; value: PhotoAdjustments | null }[] = [
  { label: "Naturel", value: null },
  { label: "Lumineux", value: { brightness: 0.25, contrast: 0.15, saturation: 0.15, blur: 0 } },
  { label: "Contrasté", value: { brightness: 0, contrast: 0.45, saturation: 0.25, blur: 0 } },
  { label: "Noir et blanc", value: { brightness: 0.05, contrast: 0.3, saturation: -1, blur: 0 } },
  { label: "Pastel", value: { brightness: 0.2, contrast: -0.3, saturation: -0.45, blur: 0 } },
  { label: "Flou d'ambiance", value: { brightness: 0.1, contrast: -0.1, saturation: 0, blur: 14 } },
];

const ADJUSTMENTS: readonly { key: keyof PhotoAdjustments; label: string; min: number; max: number }[] = [
  { key: "brightness", label: "Luminosité", min: -1, max: 1 },
  { key: "contrast", label: "Contraste", min: -1, max: 1 },
  { key: "saturation", label: "Couleurs", min: -1, max: 1 },
  { key: "blur", label: "Flou", min: 0, max: 40 },
];

const percent = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 100)} %`;
const sameLook = (a: PhotoAdjustments | null, b: PhotoAdjustments | null) =>
  a === b || (a !== null && b !== null && ADJUSTMENTS.every(({ key }) => a[key] === b[key]));

function FramingControls({ element, asset }: { element: ImageElement; asset: ImageAsset }) {
  const resolve = useAssetResolver();
  const state = useImage(resolve(element.assetId, asset));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const frame = { width: element.width, height: element.height };
  const image = { width: asset.width, height: asset.height };
  const framing = framingOf(element.crop, frame, image);

  const preview = (next: Partial<Framing>) => {
    previewElements([element.id], { fit: "cover", crop: cropFor({ ...framing, ...next }, frame, image) }, "Cadrer la photo");
  };

  const centerOnSubject = async () => {
    if (state.status !== "loaded") return;
    setBusy(true);
    setNotice(null);
    try {
      // Zone aux proportions du cadre qui garde le plus de détails, de peau et de couleurs ; resserrée jusqu'à 70 %.
      const { topCrop } = await smartcrop.crop(state.image, { width: frame.width, height: frame.height, minScale: 0.7 });
      const scale = { width: state.image.naturalWidth, height: state.image.naturalHeight };
      updateElements([element.id], { fit: "cover", crop: cropFromPixels(topCrop, scale) }, "Cadrer sur le sujet");
    } catch {
      setNotice("Cette image ne peut pas être analysée. Cadrez-la avec les curseurs.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${styles.stack} ${styles.subsection}`}>
      <p className={styles.help}>Cadrage</p>
      <div className={styles.toggles}>
        <button
          type="button"
          className={styles.textButton}
          disabled={busy || state.status !== "loaded"}
          onClick={() => void centerOnSubject()}
        >
          {busy ? "Analyse de la photo…" : "Cadrer sur le sujet"}
        </button>
        {element.crop && (
          <button
            type="button"
            className={styles.textButton}
            onClick={() => updateElements([element.id], { crop: null }, "Photo entière")}
          >
            Photo entière
          </button>
        )}
      </div>
      {notice && <p className={styles.help}>{notice}</p>}
      <Slider
        label="Zoom"
        value={framing.zoom}
        min={1}
        max={MAX_ZOOM}
        format={(zoom) => `× ${zoom.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`}
        onPreview={(zoom) => preview({ zoom })}
        onCommit={commitLiveEdit}
      />
      <Slider
        label="Gauche – droite"
        value={framing.centerX}
        min={0}
        max={1}
        format={(x) => `${Math.round(x * 100)} %`}
        onPreview={(centerX) => preview({ centerX })}
        onCommit={commitLiveEdit}
      />
      <Slider
        label="Haut – bas"
        value={framing.centerY}
        min={0}
        max={1}
        format={(y) => `${Math.round(y * 100)} %`}
        onPreview={(centerY) => preview({ centerY })}
        onCommit={commitLiveEdit}
      />
    </div>
  );
}

export function PhotoSection({ images }: { images: readonly ImageElement[] }) {
  const ids = images.map((i) => i.id);
  const [first] = images;
  const asset = useDocumentStore((s) => (first ? s.history.present.assets[first.assetId] : undefined));
  if (!first) return null;

  const mask = shared(images, (i) => i.mask ?? null);
  const shape = mask === MIXED ? null : (mask?.shape ?? "rect");
  const feather = mask === MIXED ? null : (mask?.feather ?? 0);
  const look = shared(images, (i) => i.adjustments ?? null);
  const adjustments = look === MIXED ? null : (look ?? NEUTRAL);
  // Fondu exprimé en part du plus petit côté : un même réglage donne le même effet sur toutes les images.
  const side = Math.min(first.width, first.height);
  const maxFeather = Math.round(side / 4);

  const maskFor = (next: ImageMask): ImageMask | null => (next.shape === "rect" && next.feather === 0 ? null : next);
  const previewAdjustment = (key: keyof PhotoAdjustments, value: number) => {
    const next = { ...(adjustments ?? NEUTRAL), [key]: value };
    previewElements(ids, { adjustments: sameLook(next, NEUTRAL) ? null : next }, "Régler la photo");
  };

  return (
    <>
      {images.length === 1 && asset && <FramingControls element={first} asset={asset} />}

      <div className={`${styles.stack} ${styles.subsection}`}>
        <p className={styles.help}>Médaillon</p>
        <div className={styles.toggles} role="group" aria-label="Forme du médaillon">
          {SHAPES.map(({ value, label }) => (
            <Toggle
              key={value}
              label={label}
              pressed={shape === value}
              onChange={() => updateElements(ids, { mask: maskFor({ shape: value, feather: feather ?? 0 }) }, "Forme de la photo")}
            />
          ))}
        </div>
        <Slider
          label="Fondu des bords"
          value={feather}
          min={0}
          max={maxFeather}
          step={1}
          format={(value) => `${Math.round((value / maxFeather) * 100)} %`}
          onPreview={(value) => previewElements(ids, { mask: maskFor({ shape: shape ?? "rect", feather: value }) }, "Fondu des bords")}
          onCommit={commitLiveEdit}
        />
      </div>

      <div className={`${styles.stack} ${styles.subsection}`}>
        <p className={styles.help}>Réglages</p>
        <div className={styles.toggles} role="group" aria-label="Ambiance">
          {LOOKS.map(({ label, value }) => (
            <Toggle
              key={label}
              label={label}
              pressed={look === MIXED ? null : sameLook(look, value)}
              onChange={() => updateElements(ids, { adjustments: value }, "Ambiance de la photo")}
            />
          ))}
        </div>
        {ADJUSTMENTS.map(({ key, label, min, max }) => (
          <Slider
            key={key}
            label={label}
            value={adjustments ? adjustments[key] : null}
            min={min}
            max={max}
            step={key === "blur" ? 1 : 0.05}
            format={key === "blur" ? (value) => `${value} px` : key === "saturation" ? (value) => (value <= -1 ? "N et B" : percent(value)) : percent}
            onPreview={(value) => previewAdjustment(key, value)}
            onCommit={commitLiveEdit}
          />
        ))}
      </div>
    </>
  );
}
