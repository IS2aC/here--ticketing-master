import type { HexColor, ImageElement } from "../../domain/elements/types.ts";
import { commitLiveEdit, previewElements, updateElements } from "../../editor/actions.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { ColorField } from "../primitives/ColorField.tsx";
import { Segmented, Toggle } from "../primitives/Segmented.tsx";
import { PhotoSection } from "./PhotoSection.tsx";
import { MIXED, orNull, shared } from "./selection.ts";
import { useSwatches } from "./useSwatches.ts";
import styles from "./PropertiesPanel.module.css";

const FIT_OPTIONS = [
  { value: "cover", label: "Remplir" },
  { value: "contain", label: "Contenir" },
  { value: "fill", label: "Étirer" },
] as const satisfies readonly { value: ImageElement["fit"]; label: string }[];

/** Image : ajustement dans le cadre, teinte d'un SVG, cadrage, médaillon et réglages (le remplacement n'est pas encore proposé). */
export function ImageSection({ images }: { images: readonly ImageElement[] }) {
  const ids = images.map((i) => i.id);
  // Teinte : seulement si toutes les images sont des SVG (une image matricielle ne se recolore pas).
  const vector = useDocumentStore((s) => images.every((i) => s.history.present.assets[i.assetId]?.mimeType === "image/svg+xml"));
  const tint = shared(images, (i) => i.tint ?? null);
  const swatches = useSwatches(tint === MIXED ? null : tint);
  return (
    <section aria-labelledby="properties-image-title" className={styles.section}>
      <h3 id="properties-image-title" className={styles.sectionTitle}>
        Image
      </h3>
      <Segmented
        label="Ajustement dans le cadre"
        value={orNull(shared(images, (i) => i.fit))}
        options={FIT_OPTIONS}
        onChange={(fit) => {
          updateElements(ids, { fit }, "Ajuster l'image");
        }}
      />
      <p className={styles.help}>
        Remplir : couvre le cadre en rognant. Contenir : image entière. Étirer : déformée au cadre.
      </p>
      {vector && (
        <div className={`${styles.stack} ${styles.subsection}`}>
          <div className={styles.withSwitch}>
            <ColorField
              label="Teinte"
              value={tint === MIXED ? null : tint}
              none={tint === null}
              onPreview={(color: HexColor) => {
                previewElements(ids, { tint: color }, "Teinter l'image");
              }}
              onCommit={(color: HexColor) => {
                previewElements(ids, { tint: color }, "Teinter l'image");
                commitLiveEdit();
              }}
              swatches={swatches}
            />
            <Toggle
              label="D'origine"
              pressed={tint === MIXED ? null : tint === null}
              onChange={(original) => {
                updateElements(ids, { tint: original ? null : "#B8924A" }, original ? "Couleurs d'origine" : "Teinter l'image");
              }}
            />
          </div>
          <p className={styles.help}>Image vectorielle : nette à toute taille. La teinte garde ses ombres et ses reflets.</p>
        </div>
      )}
      <PhotoSection images={images} />
    </section>
  );
}
