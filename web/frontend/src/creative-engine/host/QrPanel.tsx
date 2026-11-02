"use client";

import { useEffect, useMemo, useState } from "react";
import { QR_SPOTS } from "@/lib/card/layout";
import { QR_CORNERS, QR_DOTS, QR_MIN_CONTRAST } from "@/lib/card/qr";
import type { HexColor } from "../domain/elements/types.ts";
import { contrastRatio, documentPalette, readableColor } from "../editor/colors.ts";
import { useDocumentStore } from "../editor/documentStore.ts";
import { ColorField } from "../ui/primitives/ColorField.tsx";
import { Toggle } from "../ui/primitives/Segmented.tsx";
import { usePhotoPalette } from "../ui/PropertiesPanel/usePhotoPalette.ts";
import { moveSealTo } from "./guestActions.ts";
import { nearestSpot } from "./guestFields.ts";
import { sealIsScannable, sealUrl, useQrStyle } from "./qrStyle.ts";
import styles from "./HereCardEditor.module.css";

const WHITE = "#FFFFFF" as HexColor;
type Check = "checking" | "ok" | "unreadable";

/** Réglages du QR code et du sceau Here! : emplacement, style, couleur, et relecture du code dessiné. */
export function QrPanel({ baseUrl, onClose }: { baseUrl: string; onClose: () => void }) {
  const style = useQrStyle((s) => s.style);
  const setStyle = useQrStyle((s) => s.set);
  const spot = useDocumentStore((s) => {
    const qr = s.history.present.elements.find((e) => e.slot === "guest-qr");
    return qr ? nearestSpot(qr) : null;
  });
  const doc = useDocumentStore((s) => s.history.present);
  // Résultat de la dernière relecture, pour un style donné : un autre style est « en cours de vérification ».
  const url = sealUrl(baseUrl, style);
  const [result, setResult] = useState<{ url: string; ok: boolean } | null>(null);
  const check: Check = result?.url !== url ? "checking" : result.ok ? "ok" : "unreadable";

  const photos = usePhotoPalette(3);
  // Couleurs de la carte et de ses photos, assombries si besoin pour rester lisibles au scan.
  const swatches = useMemo(
    () =>
      [
        ...new Set(["#0B0B0B" as HexColor, ...[...documentPalette(doc), ...photos].map((c) => readableColor(c, WHITE, QR_MIN_CONTRAST))]),
      ].slice(0, 10),
    [doc, photos],
  );
  const color = style.color as HexColor;
  const contrast = contrastRatio(color, WHITE);

  // Relecture du sceau tel que Satori le dessine, à chaque changement de style.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void sealIsScannable(url).then((ok) => {
        if (active) setResult({ url, ok });
      });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [url]);

  return (
    <div className={styles.qrPanel} role="dialog" aria-label="QR code et sceau Here!">
      <div className={styles.qrHeader}>
        <p className={styles.qrTitle}>QR code et sceau Here!</p>
        <button type="button" className={styles.qrClose} onClick={onClose}>
          Fermer
        </button>
      </div>

      <p className={styles.qrLabel}>Emplacement</p>
      <div className={styles.qrChoices} role="group" aria-label="Emplacement">
        {QR_SPOTS.map(({ id, label }) => (
          <Toggle key={id} label={label} pressed={spot === id} onChange={() => moveSealTo(id)} />
        ))}
      </div>

      <p className={styles.qrLabel}>Points</p>
      <div className={styles.qrChoices} role="group" aria-label="Points">
        {QR_DOTS.map(({ id, label }) => (
          <Toggle key={id} label={label} pressed={style.dots === id} onChange={() => setStyle({ dots: id })} />
        ))}
      </div>

      <p className={styles.qrLabel}>Coins</p>
      <div className={styles.qrChoices} role="group" aria-label="Coins">
        {QR_CORNERS.map(({ id, label }) => (
          <Toggle key={id} label={label} pressed={style.corners === id} onChange={() => setStyle({ corners: id })} />
        ))}
      </div>

      <ColorField
        label="Couleur des points"
        value={color}
        onPreview={() => undefined}
        onCommit={(next) => setStyle({ color: next.slice(0, 7).toUpperCase() })}
        swatches={swatches}
      />
      {contrast < QR_MIN_CONTRAST && (
        <div className={styles.qrWarning} role="status">
          Trop clair pour le scan ({contrast.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}:1, il faut{" "}
          {QR_MIN_CONTRAST.toLocaleString("fr-FR")}:1).
          <button type="button" onClick={() => setStyle({ color: readableColor(color, WHITE, QR_MIN_CONTRAST).slice(0, 7) })}>
            Assombrir
          </button>
        </div>
      )}

      <p className={styles.qrCheck} data-state={check} role="status">
        {check === "checking"
          ? "Vérification de la lecture…"
          : check === "ok"
            ? "Lu sans erreur : le code se scanne."
            : "Ce code ne se relit pas : choisissez une couleur plus foncée ou des points carrés."}
      </p>
      <p className={styles.qrNote}>Le sceau reste blanc et porte le code de l&apos;invitation : c&apos;est la garantie Here!.</p>
    </div>
  );
}
