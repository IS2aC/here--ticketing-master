import { SAMPLE_CODE, SAMPLE_GUEST, invitationUrl } from "@/lib/card/data";
import { CARD_LIBRARY } from "@/lib/card/library";
import { renderCard } from "@/lib/card/render";
import { EVENT_TYPES, type EventType } from "@/lib/event-types";

// Exemples de la bibliothèque : une carte par type d'événement, avec des données fictives.
const SAMPLE_TITLES: Record<EventType, string> = {
  mariage: "Aya & Koffi",
  dot: "Mariam & Ibrahim",
  bapteme: "Baptême de Grâce",
  funerailles: "Jean-Baptiste Kouadio Yao",
  anniversaire: "30 ans",
  brunch: "Brunch entre amis",
  retrouvailles: "Promo 2006",
  reunion: "Assemblée générale",
  seminaire: "Cap 2030 : grandir ensemble",
  concert_prive: "Babi Private Night",
  festival: "Abidjan Live",
  autre: "Inauguration",
};

export async function GET(_: Request, { params }: RouteContext<"/tableau-de-bord/cartes/[type]/carte.png">) {
  const { type } = await params;
  if (!(type in CARD_LIBRARY)) return new Response("Type inconnu", { status: 404 });
  const eventType = type as EventType;
  const startsAt = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 11, 13, 15)).toISOString();
  return renderCard(
    {
      type: eventType,
      title: SAMPLE_TITLES[eventType],
      startsAt,
      durationMinutes: null,
      locationName: "Espace Les Jardins",
      locationAddress: "Riviera 3, Abidjan",
      dressCode: eventType === "mariage" ? "Tenue traditionnelle" : null,
      ...SAMPLE_GUEST,
      code: SAMPLE_CODE,
      qrValue: invitationUrl("exemple"),
    },
    { "Cache-Control": "public, max-age=3600" },
  );
}

export function generateStaticParams() {
  return EVENT_TYPES.map((t) => ({ type: t.value }));
}
