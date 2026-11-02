import type { ImageElement } from "../../domain/elements/types.ts";
import { updateElements } from "../../editor/actions.ts";
import { Segmented } from "../primitives/Segmented.tsx";
import { orNull, shared } from "./selection.ts";
import styles from "./PropertiesPanel.module.css";

const FIT_OPTIONS = [
  { value: "cover", label: "Remplir" },
  { value: "contain", label: "Contenir" },
  { value: "fill", label: "Étirer" },
] as const satisfies readonly { value: ImageElement["fit"]; label: string }[];

/** Ajustement de l'image dans son cadre (le recadrage et le remplacement de l'image ne sont pas encore proposés). */
export function ImageSection({ images }: { images: readonly ImageElement[] }) {
  const ids = images.map((i) => i.id);
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
    </section>
  );
}
