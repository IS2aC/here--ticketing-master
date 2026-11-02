import type { ReactElement } from "react";

// Pictogrammes au trait (24 px, trait 1,75, currentColor), dans le style de elements/icons de l'identité Here!.
// « download » reprend telecharger.svg ; les autres manquaient à l'identité et sont dessinés dans le même style.
const PATHS = {
  select: <path d="M5 3.5l13.5 6-5.75 2-2 5.75z" />,
  text: <path d="M5 7V5h14v2M12 5v14M9 19h6" />,
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.75" />
      <path d="M20.5 15.5l-4.5-4.5-8.5 8.5" />
    </>
  ),
  shapes: (
    <>
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
      <circle cx="15.5" cy="15.5" r="5" />
    </>
  ),
  library: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  fit: (
    <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
  ),
  actualSize: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M8 10.5l1.5-1v5M14 10.5l1.5-1v5" />
    </>
  ),
  rect: <rect x="4" y="6" width="16" height="12" rx="1.5" />,
  ellipse: <ellipse cx="12" cy="12" rx="8.5" ry="6.5" />,
  line: <path d="M4.5 19.5l15-15" />,
  trash: (
    <>
      <path d="M4.5 7h15M10 11v6M14 11v6" />
      <path d="M6.5 7l1 12a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12M9.5 7V4.5h5V7" />
    </>
  ),
  duplicate: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  bringToFront: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="1.5" fill="currentColor" fillOpacity="0.15" />
      <path d="M5 15V6a1 1 0 0 1 1-1h9" />
    </>
  ),
  bringForward: <path d="M12 19V5M6.5 10.5L12 5l5.5 5.5" />,
  sendBackward: <path d="M12 5v14M6.5 13.5L12 19l5.5-5.5" />,
  sendToBack: (
    <>
      <rect x="5" y="5" width="11" height="11" rx="1.5" />
      <path d="M19 9v9a1 1 0 0 1-1 1H9" />
    </>
  ),
  folder: (
    <path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2.2h7.2a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
  ),
  filePlus: (
    <>
      <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
      <path d="M13.5 3.5V9H19M12 12.5v5M9.5 15h5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  save: (
    <>
      <path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  template: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M4 9h16M10 9v11.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M10 3.5l1.6 4.4 4.4 1.6-4.4 1.6L10 15.5l-1.6-4.4-4.4-1.6 4.4-1.6z" />
      <path d="M17.5 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  qr: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alignLeft: (
    <>
      <path d="M4 4v16" />
      <rect x="7" y="6" width="11" height="4" rx="1" />
      <rect x="7" y="14" width="7" height="4" rx="1" />
    </>
  ),
  alignCenter: (
    <>
      <path d="M12 4v16" />
      <rect x="6" y="6" width="12" height="4" rx="1" />
      <rect x="8" y="14" width="8" height="4" rx="1" />
    </>
  ),
  alignRight: (
    <>
      <path d="M20 4v16" />
      <rect x="6" y="6" width="11" height="4" rx="1" />
      <rect x="10" y="14" width="7" height="4" rx="1" />
    </>
  ),
  alignTop: (
    <>
      <path d="M4 4h16" />
      <rect x="6" y="7" width="4" height="11" rx="1" />
      <rect x="14" y="7" width="4" height="7" rx="1" />
    </>
  ),
  alignMiddle: (
    <>
      <path d="M4 12h16" />
      <rect x="6" y="6" width="4" height="12" rx="1" />
      <rect x="14" y="8" width="4" height="8" rx="1" />
    </>
  ),
  alignBottom: (
    <>
      <path d="M4 20h16" />
      <rect x="6" y="6" width="4" height="11" rx="1" />
      <rect x="14" y="10" width="4" height="7" rx="1" />
    </>
  ),
  distributeHorizontal: (
    <>
      <path d="M4 4v16M20 4v16" />
      <rect x="9.5" y="7" width="5" height="10" rx="1" />
    </>
  ),
  distributeVertical: (
    <>
      <path d="M4 4h16M4 20h16" />
      <rect x="7" y="9.5" width="10" height="5" rx="1" />
    </>
  ),
  guest: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
