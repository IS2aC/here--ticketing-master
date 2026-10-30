/* eslint-disable @next/next/no-img-element -- Satori dessine une image : <img> est le seul moyen d'y placer QR code et symbole. */
import { svgUri } from "./templates/color";

// Sceau Here! compact : QR code de l'invité sur blanc, symbole, « Invitation vérifiée par Here! » et code.
// Commun à « Mon propre modèle » (render.tsx) et aux modèles du catalogue (templates/engine.tsx). Taille de base : 260 × 318.

export const SEAL_SIZE = { width: 260, height: 318 };

const INK = "#0B0B0B";
const RED = "#E10600";

export const HERE_SYMBOL = (mark: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${INK}"/><path fill="${mark}" d="M248.71 70L380.71 70L308.00 318L216.00 318Z"/><circle cx="244.57" cy="400" r="54" fill="${mark}"/></svg>`;

export function CompactSeal({ qr, code, left, top, scale = 1 }: { qr: string; code: string; left: number; top: number; scale?: number }) {
  const s = (n: number) => n * scale;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: s(SEAL_SIZE.width),
        height: s(SEAL_SIZE.height),
        borderRadius: s(24),
        background: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: `${s(20)}px ${s(20)}px ${s(14)}px`,
        boxShadow: `0 0 0 ${s(1.5)}px rgba(11,11,11,.08)`,
      }}
    >
      <img src={qr} width={s(204)} height={s(204)} alt="" />
      <div style={{ display: "flex", alignItems: "center", gap: s(8), marginTop: s(12) }}>
        <img src={svgUri(HERE_SYMBOL(RED))} width={s(30)} height={s(30)} alt="" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "Poppins",
            fontSize: s(14),
            fontWeight: 600,
            lineHeight: 1.15,
            color: INK,
          }}
        >
          <span>Invitation vérifiée</span>
          <span>par Here!</span>
        </div>
      </div>
      <div style={{ fontFamily: "DM Mono", fontSize: s(13), letterSpacing: s(0.5), color: "#6B6B6B", marginTop: s(6) }}>{code}</div>
    </div>
  );
}
