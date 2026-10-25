// Pictogrammes de uiux/visual-identity/elements/icons (trait currentColor).
import type { SVGProps } from "react";

const paths = {
  calendrier: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </>
  ),
  statistiques: (
    <>
      <path d="M3 21h18" />
      <path d="M6 17v-5M11 17V7M16 17v-8M20 17v-3" />
    </>
  ),
  cadenas: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5" />
    </>
  ),
  ajouter: <path d="M12 5v14M5 12h14" />,
  "fleche-droite": <path d="M4 12h16M14 6l6 6-6 6" />,
  support: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="4" height="6" rx="1.5" />
      <rect x="17" y="14" width="4" height="6" rx="1.5" />
      <path d="M19 20a3 3 0 0 1-3 2h-3" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={20}
      height={20}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
