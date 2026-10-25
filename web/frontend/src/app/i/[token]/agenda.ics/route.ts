import { apiFetch } from "@/lib/api";
import { invitationUrl, type PublicCard } from "@/lib/card/data";

// « Ajouter à mon agenda » : fichier .ics avec un rappel la veille.
function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
}

export async function GET(_: Request, { params }: RouteContext<"/i/[token]/agenda.ics">) {
  const { token } = await params;
  const response = await apiFetch(`/v1/invitations/${encodeURIComponent(token)}`);
  if (!response.ok) return new Response("Invitation introuvable", { status: 404 });
  const card = (await response.json()) as PublicCard;
  const start = new Date(card.starts_at);
  const end = new Date(start.getTime() + (card.duration_minutes ?? 120) * 60_000);
  const location = [card.location_name, card.location_address].filter(Boolean).join(", ");
  const link = invitationUrl(token);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Here!//Invitations//FR",
    "BEGIN:VEVENT",
    `UID:${card.code}@here`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(card.title)}`,
    location ? `LOCATION:${escape(location)}` : null,
    `DESCRIPTION:${escape(`Votre invitation et votre QR code : ${link}`)}`,
    `URL:${link}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(`Demain : ${card.title}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="invitation.ics"',
    },
  });
}
