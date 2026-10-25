/* eslint-disable @next/next/no-img-element -- Satori dessine une image : <img> est le seul moyen d'y placer QR code et pictogrammes. */
import "server-only";
import { ImageResponse } from "next/og";
import type { CSSProperties, ReactNode } from "react";
import QRCode from "qrcode";
import type { EventType } from "@/lib/event-types";
import { formatDate, formatDuration, formatTime } from "@/lib/events";
import { cardFonts } from "./fonts";
import { ICON_SVG } from "./icons";
import { CARD_LIBRARY, type CardStyle } from "./library";

// Carte d'invitation en image (1080 × 1350, format 4:5 optimal dans WhatsApp), d'après uiux/visual-identity/mockups/carte-*.
// Un seul rendu sert à l'aperçu de l'organisateur et à l'image envoyée à l'invité.
// Rendu par Satori : uniquement flexbox, et toute boîte à plusieurs enfants doit être en display: flex.

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export type CardData = {
  type: EventType;
  title: string;
  startsAt: string;
  durationMinutes: number | null;
  locationName: string | null;
  locationAddress: string | null;
  dressCode: string | null;
  guestName: string;
  category: string;
  seat: string | null;
  seats: number;
  code: string;
  qrValue: string; // contenu du QR code : lien de l'invitation
};

// Couleurs de l'identité (uiux/visual-identity/brand.json) : Satori ne lit pas les variables CSS.
const C = {
  red: "#E10600",
  redBright: "#FF4D3D",
  ink: "#0B0B0B",
  white: "#FFFFFF",
  gray300: "#E2E2E2",
  gray500: "#8A8A8A",
  gray600: "#6B6B6B",
  ivory: "#F7F1E8",
  gold: "#A8823C",
  stone50: "#F3F1EC",
  stone600: "#5E5A53",
};

const SEAL_TOP = CARD_HEIGHT - 42 - 228;

function svgUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function Icon({
  name,
  color,
  size,
}: {
  name: string;
  color: string;
  size: number;
}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICON_SVG[name] ?? ""}</svg>`;
  return <img src={svgUri(svg)} width={size} height={size} alt="" />;
}

/** Taille du titre selon sa longueur, pour qu'il tienne sur deux ou trois lignes. */
function fit(
  text: string,
  sizes: [number, number][],
  fallback: number,
): number {
  return sizes.find(([max]) => text.length <= max)?.[1] ?? fallback;
}

function when(data: CardData) {
  const time = formatTime(data.startsAt).replace(" h 00", " h");
  return {
    date: formatDate(data.startsAt),
    time: data.durationMinutes
      ? `${time} · ${formatDuration(data.durationMinutes)}`
      : time,
  };
}

function where(data: CardData): string | null {
  return (
    [data.locationName, data.locationAddress].filter(Boolean).join(", ") || null
  );
}

// --- Le sceau Here! : identique sur toutes les cartes, non modifiable -----------------------------

const HERE_SYMBOL = (mark: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${C.ink}"/><path fill="${mark}" d="M248.71 70L380.71 70L308.00 318L216.00 318Z"/><circle cx="244.57" cy="400" r="54" fill="${mark}"/></svg>`;

function Seal({
  data,
  qr,
  mono,
}: {
  data: CardData;
  qr: string;
  mono: boolean;
}) {
  const details = [
    `${data.seats} personne${data.seats > 1 ? "s" : ""}`,
    data.category,
    data.seat,
  ].filter(Boolean);
  return (
    <div
      style={{
        position: "absolute",
        left: 42,
        right: 42,
        top: SEAL_TOP,
        height: 228,
        borderRadius: 30,
        background: C.white,
        color: C.ink,
        display: "flex",
        alignItems: "center",
        gap: 33,
        padding: "21px 36px 21px 21px",
        boxShadow: "0 0 0 1.5px rgba(11,11,11,.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 186,
          height: 186,
          padding: 9,
          background: C.white,
        }}
      >
        <img src={qr} width={168} height={168} alt="" />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 2.2,
            textTransform: "uppercase",
            color: C.gray600,
          }}
        >
          Invitation personnelle
        </div>
        <div
          style={{
            fontSize: data.guestName.length > 22 ? 27 : 33,
            fontWeight: 600,
            lineHeight: 1.2,
            margin: "6px 0 9px",
            maxHeight: 80,
            overflow: "hidden",
          }}
        >
          {data.guestName}
        </div>
        <div style={{ display: "flex", fontSize: 19.5, color: C.gray600 }}>
          <span style={{ fontWeight: 600, color: C.ink }}>{details[0]}</span>
          {details.length > 1 ? (
            <span>{`\u00a0· ${details.slice(1).join(" · ")}`}</span>
          ) : null}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 10,
          height: "100%",
          paddingLeft: 33,
          borderLeft: `1.5px solid ${C.gray300}`,
          textAlign: "right",
        }}
      >
        <img
          src={svgUri(HERE_SYMBOL(mono ? C.gray500 : C.red))}
          width={51}
          height={51}
          alt=""
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            fontSize: 18,
            fontWeight: 600,
            lineHeight: 1.3,
          }}
        >
          <span>Invitation</span>
          <span>vérifiée par Here!</span>
        </div>
        <div
          style={{
            fontFamily: "DM Mono",
            fontSize: 16.5,
            letterSpacing: 0.6,
            color: C.gray600,
          }}
        >
          {data.code}
        </div>
      </div>
    </div>
  );
}

// --- Modèles ---------------------------------------------------------------------------------------

const column: CSSProperties = { display: "flex", flexDirection: "column" };

function Ceremonie({ data, style }: { data: CardData; style: CardStyle }) {
  const { date, time } = when(data);
  const place = where(data);
  return (
    <div
      style={{
        ...column,
        width: "100%",
        height: "100%",
        background: C.ivory,
        color: C.ink,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 30,
          top: 30,
          right: 30,
          bottom: 294,
          display: "flex",
          border: `2px solid ${C.gold}`,
          borderRadius: 9,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 9,
            top: 9,
            right: 9,
            bottom: 9,
            display: "flex",
            border: `1.5px solid ${C.gold}`,
            borderRadius: 5,
            opacity: 0.55,
          }}
        />
      </div>
      <div
        style={{
          ...column,
          position: "absolute",
          left: 96,
          right: 96,
          top: 0,
          height: 1056,
          alignItems: "center",
          textAlign: "center",
          padding: "120px 0 60px",
        }}
      >
        <div
          style={{
            fontSize: 19.5,
            fontWeight: 600,
            letterSpacing: 7.8,
            textTransform: "uppercase",
            color: C.gold,
          }}
        >
          {style.label}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            margin: "24px 0 0",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 84,
              height: 1.5,
              background: C.gold,
            }}
          />
          <Icon name={style.icon} color={C.gold} size={36} />
          <div
            style={{
              display: "flex",
              width: 84,
              height: 1.5,
              background: C.gold,
            }}
          />
        </div>
        <div
          style={{
            ...column,
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: "Playfair Display",
              fontStyle: "italic",
              fontSize: 30,
              lineHeight: 1.4,
            }}
          >
            {style.formula}
          </div>
          <div
            style={{
              fontFamily: "Playfair Display",
              fontWeight: 600,
              fontSize: fit(
                data.title,
                [
                  [14, 96],
                  [24, 78],
                  [40, 62],
                ],
                50,
              ),
              lineHeight: 1.08,
              margin: "14px 0 34px",
            }}
          >
            {data.title}
          </div>
          <div style={{ fontSize: 22.5 }}>Une invitation pour</div>
          <div style={{ fontSize: 30, fontWeight: 600, marginTop: 4 }}>
            {data.guestName}
          </div>
          <div
            style={{
              ...column,
              alignItems: "center",
              marginTop: 48,
              fontSize: 22.5,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600 }}>{`${date} · ${time}`}</div>
            {place ? <div>{place}</div> : null}
            {data.dressCode ? (
              <div
                style={{ color: C.stone600 }}
              >{`Tenue : ${data.dressCode}`}</div>
            ) : null}
          </div>
        </div>
        <div style={{ fontSize: 19.5, color: C.stone600 }}>{style.closing}</div>
      </div>
    </div>
  );
}

function RendezVous({ data, style }: { data: CardData; style: CardStyle }) {
  const { date, time } = when(data);
  // Haut de carte blanc avec le grand pictogramme, coupé en biais par le rouge (à la place de la photo).
  const top = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 760"><rect width="1080" height="760" fill="${C.white}"/><polygon points="0,760 0,500 1080,370 1080,760" fill="${C.red}"/></svg>`;
  return (
    <div
      style={{
        ...column,
        width: "100%",
        height: "100%",
        background: C.red,
        color: C.white,
      }}
    >
      <img
        src={svgUri(top)}
        width={1080}
        height={760}
        alt=""
        style={{ position: "absolute", left: 0, top: 0 }}
      />
      <div
        style={{
          position: "absolute",
          right: 96,
          top: 90,
          display: "flex",
          opacity: 0.9,
        }}
      >
        <Icon name={style.icon} color={C.red} size={250} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 42,
          top: 42,
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 66,
          padding: "0 30px 0 24px",
          borderRadius: 33,
          background: C.ink,
          fontSize: 22.5,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        <Icon name={style.icon} color={C.redBright} size={30} />
        {style.label}
      </div>
      <div
        style={{
          ...column,
          position: "absolute",
          left: 84,
          right: 84,
          top: 470,
          bottom: 1350 - SEAL_TOP + 48,
          justifyContent: "flex-end",
        }}
      >
        <div style={{ fontSize: 31.5, fontWeight: 500 }}>{style.formula}</div>
        <div
          style={{
            fontWeight: 800,
            fontSize: fit(
              data.title,
              [
                [10, 132],
                [18, 96],
                [30, 72],
                [50, 56],
              ],
              46,
            ),
            lineHeight: 1,
            letterSpacing: -2,
            textTransform: "uppercase",
            margin: "10px 0 28px",
          }}
        >
          {data.title}
        </div>
        <div style={{ display: "flex", fontSize: 27 }}>
          <span>Pour&nbsp;</span>
          <span style={{ fontWeight: 700 }}>{data.guestName}</span>
        </div>
        <div style={{ fontSize: 27, marginBottom: 32 }}>{style.closing}</div>
        <Details
          data={{
            date,
            time,
            place: data.locationName,
            sub: data.locationAddress,
          }}
          color={C.white}
          textColor={C.white}
        />
      </div>
    </div>
  );
}

function Details({
  data,
  color,
  textColor,
}: {
  data: {
    date: string;
    time: string;
    place: string | null;
    sub: string | null;
  };
  color: string;
  textColor: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 48,
        fontSize: 25.5,
        lineHeight: 1.4,
        color: textColor,
      }}
    >
      <div style={{ display: "flex", gap: 16 }}>
        <Icon name="calendrier" color={color} size={36} />
        <div style={column}>
          <span style={{ fontWeight: 600 }}>{data.date}</span>
          <span>{data.time}</span>
        </div>
      </div>
      {data.place || data.sub ? (
        <div style={{ display: "flex", gap: 16, flex: 1 }}>
          <Icon name="lieu" color={color} size={36} />
          <div style={column}>
            <span style={{ fontWeight: 600 }}>{data.place ?? data.sub}</span>
            {data.place && data.sub ? <span>{data.sub}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Officiel({ data, style }: { data: CardData; style: CardStyle }) {
  const { date, time } = when(data);
  const items: [string, string, string | null][] = [
    ["calendrier", date, time],
    [
      "lieu",
      data.locationName ?? data.locationAddress ?? "",
      data.locationName ? data.locationAddress : null,
    ],
    ["etiquette", data.dressCode ? `Tenue : ${data.dressCode}` : "", null],
    ["horloge", "Réponse attendue", style.closing],
  ];
  return (
    <div
      style={{
        ...column,
        width: "100%",
        height: "100%",
        background: C.white,
        color: C.ink,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 21,
          display: "flex",
          background: C.ink,
        }}
      />
      <div
        style={{
          ...column,
          position: "absolute",
          left: 111,
          right: 96,
          top: 120,
          bottom: 1350 - SEAL_TOP + 48,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 21,
            fontWeight: 600,
            letterSpacing: 5,
            textTransform: "uppercase",
          }}
        >
          <Icon name={style.icon} color={C.ink} size={30} />
          {style.label}
        </div>
        <div style={{ ...column, flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: 30, color: C.gray600 }}>{style.formula}</div>
          <div
            style={{
              fontWeight: 800,
              fontSize: fit(
                data.title,
                [
                  [20, 92],
                  [40, 70],
                ],
                54,
              ),
              lineHeight: 1.05,
              letterSpacing: -1.5,
              margin: "8px 0 30px",
            }}
          >
            {data.title}
          </div>
          <div style={{ fontSize: 27, color: C.gray600 }}>
            Une invitation pour
          </div>
          <div style={{ fontSize: 33, fontWeight: 600 }}>{data.guestName}</div>
        </div>
        <div
          style={{
            display: "flex",
            height: 1.5,
            background: C.gray300,
            margin: "0 0 36px",
          }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", rowGap: 30 }}>
          {items
            .filter(([, label]) => label)
            .map(([icon, label, sub]) => (
              <div
                key={icon}
                style={{
                  display: "flex",
                  gap: 18,
                  width: "50%",
                  fontSize: 25.5,
                  lineHeight: 1.4,
                }}
              >
                <Icon name={icon} color={C.ink} size={36} />
                <div style={{ ...column, flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  {sub ? <span style={{ color: C.gray600 }}>{sub}</span> : null}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function Hommage({ data, style }: { data: CardData; style: CardStyle }) {
  const { date, time } = when(data);
  const place = where(data);
  return (
    <div
      style={{
        ...column,
        width: "100%",
        height: "100%",
        background: C.stone50,
        color: C.ink,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 30,
          top: 30,
          right: 30,
          bottom: 294,
          display: "flex",
          border: `1.5px solid ${C.gray500}`,
        }}
      />
      <div
        style={{
          ...column,
          position: "absolute",
          left: 96,
          right: 96,
          top: 0,
          height: 1056,
          alignItems: "center",
          textAlign: "center",
          padding: "90px 0 70px",
        }}
      >
        <div
          style={{
            ...column,
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 132,
              height: 132,
              borderRadius: 66,
              border: `1.5px solid ${C.stone600}`,
              marginBottom: 48,
            }}
          >
            <Icon name={style.icon} color={C.stone600} size={60} />
          </div>
          <div
            style={{
              fontFamily: "Playfair Display",
              fontStyle: "italic",
              fontSize: 30,
              lineHeight: 1.4,
              color: C.stone600,
            }}
          >
            {style.formula}
          </div>
          <div
            style={{
              fontFamily: "Playfair Display",
              fontWeight: 600,
              fontSize: fit(
                data.title,
                [
                  [24, 76],
                  [40, 62],
                ],
                50,
              ),
              lineHeight: 1.1,
              margin: "16px 0 36px",
            }}
          >
            {data.title}
          </div>
          <div style={{ fontSize: 22.5, color: C.stone600 }}>
            À l&apos;attention de
          </div>
          <div style={{ fontSize: 28.5, fontWeight: 600, marginTop: 4 }}>
            {data.guestName}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            width: "100%",
            height: 1.5,
            background: C.gray300,
            margin: "0 0 34px",
          }}
        />
        <div
          style={{
            ...column,
            alignItems: "center",
            fontSize: 22.5,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600 }}>{`${date} · ${time}`}</div>
          {place ? <div style={{ color: C.stone600 }}>{place}</div> : null}
        </div>
        <div
          style={{
            fontFamily: "Playfair Display",
            fontStyle: "italic",
            fontSize: 27,
            color: C.stone600,
            marginTop: 30,
          }}
        >
          {style.closing}
        </div>
      </div>
    </div>
  );
}

function Soiree({ data, style }: { data: CardData; style: CardStyle }) {
  const { date, time } = when(data);
  // Fond de nuit et slash de la marque (18°), à la place de la photo.
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350"><defs><radialGradient id="g" cx="0.68" cy="0.18" r="0.55"><stop offset="0" stop-color="${C.red}" stop-opacity="0.62"/><stop offset="1" stop-color="${C.red}" stop-opacity="0"/></radialGradient></defs><rect width="1080" height="1350" fill="${C.ink}"/><rect width="1080" height="1350" fill="url(#g)"/><polygon points="927,0 1008,0 850,495 768,495" fill="${C.red}"/><polygon points="862,0 876,0 754,345 742,345" fill="${C.red}"/></svg>`;
  return (
    <div
      style={{
        ...column,
        width: "100%",
        height: "100%",
        background: C.ink,
        color: C.white,
      }}
    >
      <img
        src={svgUri(bg)}
        width={1080}
        height={1350}
        alt=""
        style={{ position: "absolute", left: 0, top: 0 }}
      />
      <div
        style={{
          ...column,
          position: "absolute",
          left: 84,
          right: 84,
          top: 300,
          bottom: 1350 - SEAL_TOP + 48,
          justifyContent: "flex-end",
        }}
      >
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            padding: "10px 18px",
            borderRadius: 9,
            background: C.red,
            fontSize: 19.5,
            fontWeight: 800,
            letterSpacing: 4.5,
            textTransform: "uppercase",
          }}
        >
          {style.label}
        </div>
        <div
          style={{
            fontWeight: 800,
            fontStyle: "italic",
            fontSize: fit(
              data.title,
              [
                [10, 150],
                [20, 112],
                [32, 86],
              ],
              64,
            ),
            lineHeight: 0.98,
            letterSpacing: -3,
            textTransform: "uppercase",
            margin: "18px 0 30px",
          }}
        >
          {data.title}
        </div>
        <div style={{ display: "flex", fontSize: 28.5, color: C.gray300 }}>
          <span>Une invitation pour&nbsp;</span>
          <span style={{ fontWeight: 600, color: C.white }}>
            {data.guestName}
          </span>
        </div>
        <div style={{ fontSize: 22.5, color: C.gray500, margin: "6px 0 30px" }}>
          {style.closing}
        </div>
        <Details
          data={{
            date,
            time,
            place: data.locationName,
            sub: data.locationAddress,
          }}
          color={C.redBright}
          textColor={C.white}
        />
      </div>
    </div>
  );
}

const FAMILIES = {
  ceremonie: Ceremonie,
  rendez_vous: RendezVous,
  officiel: Officiel,
  hommage: Hommage,
  soiree: Soiree,
} satisfies Record<
  CardStyle["family"],
  (props: { data: CardData; style: CardStyle }) => ReactNode
>;

export async function renderCard(
  data: CardData,
  headers?: Record<string, string>,
): Promise<ImageResponse> {
  const style = CARD_LIBRARY[data.type];
  const Family = FAMILIES[style.family];
  const qr = svgUri(
    await QRCode.toString(data.qrValue, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
    }),
  );
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fontFamily: "Poppins",
      }}
    >
      <Family data={data} style={style} />
      <Seal data={data} qr={qr} mono={style.family === "hommage"} />
    </div>,
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts: await cardFonts(),
      headers,
    },
  );
}
