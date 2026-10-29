// Styles communs du portail admin (maquette Stitch, charte Here!).

export const CARD = "min-w-0 rounded-2xl border border-border/60 bg-background shadow-sm";

// Pastilles des pictogrammes : teinte légère de la couleur de la charte.
export const TONES = {
  red: "bg-primary/8 text-primary",
  green: "bg-status-confirmed/10 text-status-confirmed",
  amber: "bg-amber-light/20 text-status-pending",
  neutral: "bg-surface text-text-muted",
} as const;
export type Tone = keyof typeof TONES;

export const AVATARS = [TONES.red, TONES.amber, TONES.green, TONES.neutral];

export const EVENT_STATUS: Record<"draft" | "active" | "done" | "cancelled", { label: string; className: string }> = {
  active: { label: "Actif", className: "bg-primary/8 text-primary" },
  done: { label: "Terminé", className: "bg-ink/8 text-text" },
  draft: { label: "Brouillon", className: "bg-surface text-text-muted" },
  cancelled: { label: "Annulé", className: "bg-amber-light/20 text-status-pending" },
};
