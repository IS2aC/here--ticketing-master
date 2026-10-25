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
  "mariage": (
    <>
      <circle cx="8.75" cy="14.5" r="5.5" /><circle cx="15.25" cy="14.5" r="5.5" /><path d="M10 5.5l2-3 2 3-2 2z" />
    </>
  ),
  "cadeau": (
    <>
      <rect x="3.5" y="8" width="17" height="5" rx="1" /><path d="M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 8v13" /><path d="M12 8C10.5 5 7 4 6.5 6S9 8 12 8zM12 8c1.5-3 5-4 5.5-2S15 8 12 8z" />
    </>
  ),
  "favori": <path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.2 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
  "hommage": (
    <>
      <path d="M9 21V11h6v10" /><path d="M12 11V9" /><path d="M12 3c1.6 1.9 1.9 3.2 0 4.7-1.9-1.5-1.6-2.8 0-4.7z" /><path d="M6.5 21h11" />
    </>
  ),
  "anniversaire": (
    <>
      <rect x="4" y="11" width="16" height="9.5" rx="1.5" /><path d="M4 15.5c2 1.5 4 1.5 5.33 0s3.34-1.5 5.34 0S18 17 20 15.5" /><path d="M12 11V8.5" /><path d="M12 3.5c1 1.2 1.2 2 0 3.2-1.2-1.2-1-2 0-3.2z" />
    </>
  ),
  "brunch": (
    <>
      <path d="M4 9.5h13V14a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17" /><path d="M8 3.5V6M12 3.5V6M3 21h15" />
    </>
  ),
  "retrouvailles": (
    <>
      <path d="M2.5 9L12 4.5 21.5 9 12 13.5z" /><path d="M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11" /><path d="M21.5 9v5" />
    </>
  ),
  "reunion": (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M3 12.5h18" />
    </>
  ),
  "conference": (
    <>
      <rect x="9" y="2.5" width="6" height="10" rx="3" /><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4M8.5 21h7" />
    </>
  ),
  "concert": (
    <>
      <path d="M9 18V5.5L20 3v12.5" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="15.5" r="2.5" />
    </>
  ),
  "festival": (
    <>
      <path d="M3 20L12 4l9 16z" /><path d="M12 4v16M8 20l4-6 4 6" /><path d="M12 4V2.5l3 1-3 1" />
    </>
  ),
  "lieu": (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  "horloge": (
    <>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </>
  ),
  "participants": (
    <>
      <circle cx="9" cy="8" r="3.25" /><path d="M3 20v-.5A5.5 5.5 0 0 1 8.5 14h1a5.5 5.5 0 0 1 5.5 5.5v.5" /><circle cx="17" cy="9" r="2.5" /><path d="M17.5 14a4.5 4.5 0 0 1 3.5 4.4V20" />
    </>
  ),
  "etiquette": (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="7.75" cy="7.75" r="1.5" />
    </>
  ),
  "modifier": (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" />
    </>
  ),
  "valide": (
    <>
      <circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" />
    </>
  ),
  "decline": (
    <>
      <circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  "importer": (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M12 17.5v-6M9.5 14L12 11.5l2.5 2.5" />
    </>
  ),
  alerte: (
    <>
      <path d="M12 3.5L2.5 20h19z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </>
  ),
  telecharger: (
    <>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  invitation: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </>
  ),
  message: (
    <>
      <path d="M20.5 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.4a8.5 8.5 0 1 1 15.6-4.6z" />
      <path d="M8.5 10h7M8.5 13.5h4.5" />
    </>
  ),
  "qr-code": (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 14h3v3h-3zM20 14v.01M20 20h-3M14 20v.01M20 17v3" />
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
