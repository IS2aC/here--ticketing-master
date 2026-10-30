import type { Metadata } from "next";
import { BackToEvent } from "@/components/back-link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { apiFetch } from "@/lib/api";
import { EVENT_TIME_ZONE } from "@/lib/event-types";
import { getEvent } from "@/lib/events";
import type { ScanLinkOut } from "@/lib/scan";
import { getSessionToken } from "@/lib/session";
import { createScanLink, revokeScanLink } from "./actions";
import { CopyButton, NewLinkForm } from "./link-tools";

export const metadata: Metadata = { title: "Contrôle d'accès · Here!" };

const until = new Intl.DateTimeFormat("fr-FR", {
  timeZone: EVENT_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

function scanUrl(token: string): string {
  return new URL(`/scan/${token}`, process.env.PUBLIC_APP_URL ?? "http://localhost:3000").toString();
}

export default function AccessPage({ params }: PageProps<"/tableau-de-bord/evenements/[id]/acces">) {
  return (
    <Suspense fallback={<div className="h-[480px] rounded-lg bg-background" aria-busy="true" />}>
      <Access params={params} />
    </Suspense>
  );
}

async function Access({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, linksResponse] = await Promise.all([
    getEvent(id),
    apiFetch(`/v1/events/${encodeURIComponent(id)}/scan-links`, { token: await getSessionToken() }),
  ]);
  if (!linksResponse.ok) notFound();
  const links = (await linksResponse.json()) as ScanLinkOut[];
  const { stats } = event;

  return (
    <>
      <header>
        <BackToEvent eventId={event.id} />
        <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Contrôle d&apos;accès</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="grid content-start gap-5 rounded-lg bg-background p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="font-heading text-[16px] font-semibold">Liens de scan</h2>
            <p className="mt-1 text-[14px] text-text-muted">
              Un lien par entrée ou par agent d&apos;accueil. Il s&apos;ouvre sur n&apos;importe quel téléphone, sans
              application, et ne donne accès qu&apos;au scan des invitations.
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-[13px] text-text-muted">
              <Icon name="scanner" width={15} height={15} className="mt-0.5 shrink-0" />
              <span>
                Entrées et sorties : <span className="font-semibold text-text">{event.track_entries ? "gérées" : "non gérées"}</span>
                {event.track_entries ? " (« Déjà entré » au 2e scan)" : " (le scan vérifie seulement l'invitation)"}. Modifiable sur la page de
                l&apos;événement.
              </span>
            </p>
          </div>
          <NewLinkForm action={createScanLink.bind(null, event.id)} />
          {links.length ? (
            <ul className="grid gap-3">
              {links.map((link) => {
                const url = scanUrl(link.token);
                const state = link.revoked_at ? "Désactivé" : link.active ? "Actif" : "Expiré";
                return (
                  <li key={link.id} className={`grid gap-3 rounded-md p-4 shadow-[inset_0_0_0_1px_var(--color-border)] ${link.active ? "" : "opacity-60"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-heading text-[15px] font-semibold">
                        <Icon name="scanner" width={18} height={18} className={link.active ? "text-primary" : "text-text-muted"} />
                        {link.label}
                      </p>
                      <p className="flex items-center gap-3 text-[13px]">
                        <span className="font-data tabular-nums">
                          {link.checkins} entrée{link.checkins > 1 ? "s" : ""}
                        </span>
                        <span className={`inline-flex h-[22px] items-center rounded-sm px-2 text-[11px] font-semibold tracking-[0.04em] uppercase ${link.active ? "bg-ink text-white" : "bg-surface"}`}>
                          {state}
                        </span>
                      </p>
                    </div>
                    {link.active ? (
                      <>
                        <p className="truncate rounded-sm bg-surface px-3 py-2 font-mono text-[12px] text-text-muted">{url}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <CopyButton value={url} />
                          <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface">
                            <Icon name="scanner" width={16} height={16} />
                            Ouvrir
                          </a>
                          <form action={revokeScanLink.bind(null, event.id, link.id)} className="ml-auto">
                            <button type="submit" className="h-9 px-2 text-[13px] font-semibold text-error hover:underline">
                              Désactiver
                            </button>
                          </form>
                        </div>
                        <p className="text-[12px] text-text-muted">Valable jusqu&apos;au {until.format(new Date(link.expires_at))}.</p>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <aside className="grid content-start gap-4">
          <div className="grid gap-2 rounded-lg bg-background p-5 shadow-sm">
            <h2 className="font-heading text-[16px] font-semibold">À l&apos;entrée</h2>
            <p>
              <span className="font-data text-[40px] leading-none font-semibold tabular-nums">{stats.arrived}</span>{" "}
              <span className="text-text-muted">
                invitation{stats.arrived > 1 ? "s" : ""} scannée{stats.arrived > 1 ? "s" : ""} sur {stats.guests}
              </span>
            </p>
          </div>
          <div className="grid gap-2 rounded-lg bg-background p-5 text-[14px] text-text-muted shadow-sm">
            <p className="flex items-center gap-2 font-heading text-[15px] font-semibold text-text">
              <Icon name="cadenas" width={18} height={18} />
              Sécurité
            </p>
            <p>Chaque QR code ne permet d&apos;entrer qu&apos;une fois, même si deux agents le scannent en même temps.</p>
            <p>Désactivez un lien à tout moment ; il expire de lui-même 12 h après la fin de l&apos;événement.</p>
            <p>La caméra du téléphone ne fonctionne qu&apos;avec une adresse en https (le cas en production).</p>
          </div>
        </aside>
      </div>
    </>
  );
}
