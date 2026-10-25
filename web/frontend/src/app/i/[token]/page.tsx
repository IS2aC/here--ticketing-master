import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import QRCode from "qrcode";
import { Icon, type IconName } from "@/components/icons";
import { apiFetch } from "@/lib/api";
import { invitationUrl, type PublicCard } from "@/lib/card/data";
import { CARD_LIBRARY, type CardFamily } from "@/lib/card/library";
import { eventType } from "@/lib/event-types";
import { formatDate, formatDuration, formatTime } from "@/lib/events";
import { respond } from "./actions";
import { DeclinedForm, Question } from "./forms";

export const metadata: Metadata = { title: "Votre invitation · Here!", robots: { index: false } };

// Page invité (lien du QR code et du message WhatsApp), maquettes mobile-invite*.
// Sans compte ni application : le jeton de l'adresse est la seule clé.
export default function InvitationPage({ params, searchParams }: PageProps<"/i/[token]">) {
  return (
    <Suspense fallback={<main className="flex-1 bg-background" aria-busy="true" />}>
      <Invitation params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** « à la famille », « à l'organisateur », « aux mariés ». */
function toHost(host: string): string {
  return host.startsWith("les ") ? `aux ${host.slice(4)}` : `à ${host}`;
}

// Bandeau aux couleurs du modèle de la carte (étage « hôte »).
const BAND: Record<CardFamily, { box: string; label: string; title: string }> = {
  ceremonie: { box: "bg-ivory text-ink border-b border-gold/40", label: "text-gold", title: "font-accent font-semibold" },
  rendez_vous: { box: "bg-red text-white", label: "text-white/80", title: "font-heading font-extrabold uppercase" },
  officiel: { box: "bg-background text-ink border-b border-border", label: "text-text-muted", title: "font-heading font-extrabold" },
  soiree: { box: "bg-ink text-white", label: "text-red-bright", title: "font-heading font-extrabold italic uppercase" },
  hommage: { box: "bg-stone-50 text-ink border-b border-border", label: "text-stone-600", title: "font-accent font-semibold" },
};

async function Invitation({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const response = await apiFetch(`/v1/invitations/${encodeURIComponent(token)}`);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error(`API /v1/invitations : ${response.status}`);
  const card = (await response.json()) as PublicCard;
  const style = CARD_LIBRARY[card.event_type];
  const action = respond.bind(null, token);

  if (card.rsvp_status === "confirmed" && query.modifier !== "1") {
    return <Confirmed card={card} token={token} host={style.host} />;
  }

  const band = BAND[style.family];
  const plural = card.seats > 1;
  const hommage = style.family === "hommage";
  let body: ReactNode;
  if (!card.responses_open) {
    body = (
      <div className="grid justify-items-center gap-3 py-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-surface text-text-muted">
          <Icon name="horloge" width={28} height={28} />
        </div>
        <h1 className="font-heading text-[24px] font-bold">Les réponses sont closes</h1>
        <p className="text-[17px] text-text-muted">
          Pour toute question, contactez directement {style.host}.
        </p>
      </div>
    );
  } else if (card.rsvp_status === "declined" && query.modifier !== "1") {
    body = (
      <div className="grid gap-6">
        <div className="grid justify-items-center gap-3 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-surface">
            <Icon name="message" width={28} height={28} />
          </div>
          <h1 className="font-heading text-[28px] leading-tight font-bold">
            {hommage ? "La famille vous remercie" : "Merci pour votre réponse"}
          </h1>
          <p className="text-[17px] text-text-muted">
            Votre réponse a été transmise {toHost(style.host)}. Vous pouvez changer d&apos;avis jusqu&apos;au{" "}
            <span className="font-semibold text-text">{formatDate(card.starts_at).toLowerCase()}</span>.
          </p>
        </div>
        {query.message === "envoye" ? (
          <p role="status" className="flex items-center justify-center gap-2 rounded-md bg-surface px-4 py-3 text-[17px] font-semibold text-success">
            <Icon name="valide" width={20} height={20} />
            Votre message a été transmis.
          </p>
        ) : null}
        <DeclinedForm
          action={action}
          label={`Un mot pour ${style.host} (facultatif)`}
          placeholder={hommage ? "Mes pensées vous accompagnent…" : card.event_type === "mariage" ? "Toutes nos félicitations…" : "Un petit mot…"}
        />
      </div>
    );
  } else {
    body = (
      <div className="grid gap-6">
        <div>
          <p className="text-[18px]">
            Bonjour <span className="font-semibold">{card.guest_name}</span>,
          </p>
          <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">
            {hommage ? "Pourrez-vous venir ?" : "Serez-vous des nôtres ?"}
          </h1>
        </div>
        <Question action={action} seats={card.seats} plural={plural} />
        <Details card={card} token={token} />
      </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-background">
      <header className={`px-5 py-7 text-center ${band.box}`}>
        <p className={`text-[13px] font-semibold tracking-[0.4em] uppercase ${band.label}`}>{style.label}</p>
        <p className={`mt-2 text-[34px] leading-[1.05] break-words ${band.title}`}>{card.title}</p>
        <p className="mt-2 text-[17px]">{formatDate(card.starts_at)}</p>
      </header>
      <div className="mx-auto w-full max-w-[480px] flex-1 px-5 py-7">{body}</div>
      <Footer host={style.host} />
    </main>
  );
}

function Details({ card, token }: { card: PublicCard; token: string }) {
  const place = [card.location_name, card.location_address].filter(Boolean).join(", ");
  const time = formatTime(card.starts_at).replace(" h 00", " h");
  const rows: { icon: IconName; title: string; sub?: string | null; href?: string; link?: string }[] = [
    {
      icon: eventType(card.event_type).icon,
      title: `${formatDate(card.starts_at)} · ${time}`,
      sub: card.duration_minutes ? `Durée : ${formatDuration(card.duration_minutes)}` : null,
    },
  ];
  if (place) {
    rows.push({
      icon: "lieu",
      title: card.location_name ?? place,
      sub: card.location_name ? card.location_address : null,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`,
      link: "Itinéraire",
    });
  }
  if (card.dress_code) rows.push({ icon: "etiquette", title: "Tenue", sub: card.dress_code });
  rows.push({
    icon: "calendrier",
    title: "Ajouter à mon agenda",
    sub: "Rappel la veille avec votre invitation",
    href: `/i/${encodeURIComponent(token)}/agenda.ics`,
    link: "Ajouter",
  });
  return (
    <ul className="grid gap-5">
      {rows.map((row) => (
        <li key={row.title} className="flex items-start gap-4 text-[17px]">
          <Icon name={row.icon} width={24} height={24} className="mt-0.5 shrink-0 text-text-muted" />
          <div className="min-w-0 flex-1">
            <p className="break-words">{row.title}</p>
            {row.sub ? <p className="break-words text-text-muted">{row.sub}</p> : null}
          </div>
          {row.href ? (
            <a href={row.href} target={row.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="shrink-0 font-semibold text-accent-text hover:underline">
              {row.link}
            </a>
          ) : null}
        </li>
      ))}
      <li>
        <a href={`/i/${encodeURIComponent(token)}/carte.png`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[17px] font-semibold text-accent-text hover:underline">
          <Icon name="invitation" width={20} height={20} />
          Voir ma carte d&apos;invitation
        </a>
      </li>
    </ul>
  );
}

async function Confirmed({ card, token, host }: { card: PublicCard; token: string; host: string }) {
  // QR code d'entrée en grand, avec le symbole Here! au centre (correction d'erreur élevée).
  const qr = await QRCode.toString(invitationUrl(token), { type: "svg", margin: 0, errorCorrectionLevel: "H" });
  const seats = card.attending_seats ?? card.seats;
  const time = formatTime(card.starts_at).replace(" h 00", " h");
  return (
    <main data-theme="dark" className="flex flex-1 flex-col items-center bg-ink px-5 py-10 text-white">
      <div className="grid w-full max-w-[400px] justify-items-center gap-6 text-center">
        <Icon name="valide" width={56} height={56} className="text-green-light" />
        <div>
          <h1 className="font-heading text-[30px] leading-tight font-bold">Votre présence est confirmée</h1>
          <p className="mt-2 text-[17px] text-gray-500">Votre réponse a bien été transmise {toHost(host)}.</p>
        </div>
        <div className="grid w-full justify-items-center gap-3 rounded-xl bg-white p-6 text-ink">
          <div className="relative size-[220px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR code généré côté serveur */}
            <img src={`data:image/svg+xml;base64,${Buffer.from(qr).toString("base64")}`} alt="QR code d'entrée" width={220} height={220} className="size-full" />
            {/* eslint-disable-next-line @next/next/no-img-element -- symbole de la marque */}
            <img src="/icon.svg" alt="" width={44} height={44} className="absolute top-1/2 left-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-[10px] ring-4 ring-white" />
          </div>
          <p className="font-heading text-[24px] font-semibold break-words">{card.guest_name}</p>
          <p className="text-[17px] text-gray-600">
            <span className="font-semibold text-ink">{seats}</span> personne{seats > 1 ? "s" : ""}
            {card.seat ? (
              <>
                {" · "}
                <span className="font-semibold text-ink">{card.seat}</span>
              </>
            ) : null}
          </p>
          <p className="font-mono text-[14px] tracking-[0.04em] text-gray-600">{card.code}</p>
        </div>
        <p className="flex items-center gap-2 text-[17px] text-gray-500">
          <Icon name="qr-code" width={20} height={20} />
          Présentez ce code à l&apos;entrée
        </p>
        <dl className="grid w-full gap-3 rounded-lg bg-ink-800 px-5 py-4 text-left text-[17px]">
          <div>
            <dt className="text-[15px] text-gray-500">{card.title}</dt>
            <dd className="font-semibold">{`${formatDate(card.starts_at)} · ${time}`}</dd>
          </div>
          {card.location_name || card.location_address ? (
            <div>
              <dt className="text-[15px] text-gray-500">Lieu</dt>
              <dd className="font-semibold">{[card.location_name, card.location_address].filter(Boolean).join(", ")}</dd>
            </div>
          ) : null}
        </dl>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[17px] font-semibold">
          {card.responses_open ? (
            <Link href={`/i/${encodeURIComponent(token)}?modifier=1`} className="text-red-bright hover:underline">
              Modifier ma réponse
            </Link>
          ) : null}
          <a href={`/i/${encodeURIComponent(token)}/agenda.ics`} className="text-white hover:underline">
            Ajouter à mon agenda
          </a>
        </div>
      </div>
    </main>
  );
}

function Footer({ host }: { host: string }) {
  return (
    <footer className="flex items-center gap-3 border-t border-border px-5 py-5">
      {/* eslint-disable-next-line @next/next/no-img-element -- symbole de la marque */}
      <img src="/icon.svg" alt="" width={40} height={40} className="shrink-0 rounded-[10px]" />
      <p className="text-[15px] text-text-muted">
        Invitation vérifiée par Here! Votre réponse n&apos;est vue que par {host}.
      </p>
    </footer>
  );
}
