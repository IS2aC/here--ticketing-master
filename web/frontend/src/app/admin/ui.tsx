import Link from "next/link";
import { Icon } from "@/components/icons";
import type { AdminEvent } from "@/lib/admin";
import { eventType } from "@/lib/event-types";
import { formatShortDate, formatTime } from "@/lib/events";

export { AVATARS, CARD, EVENT_STATUS, TONES, type Tone } from "./styles";
import { EVENT_STATUS, TONES } from "./styles";

export function SeeAll({ href, label = "Voir tout" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="text-[13px] font-semibold text-accent-text hover:underline">
      {label}
    </Link>
  );
}

// Bouton « Voir » des tableaux (fiche d'un compte).
export function SeeButton({ href, name }: { href: string; name: string }) {
  return (
    <Link href={href} aria-label={`Voir la fiche de ${name}`} className="rounded-lg bg-surface px-3.5 py-1.5 text-[12px] font-semibold hover:bg-border/60">
      Voir
    </Link>
  );
}

/** Pagination par liens (?page=) : rien si une seule page. */
export function Pager({ total, page, size, href }: { total: number; page: number; size: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages === 1) return null;
  const link = "flex h-9 items-center rounded-xl px-3 text-[13px] font-semibold shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface";
  return (
    <nav className="flex items-center justify-between gap-3 pt-4 text-[13px] text-text-muted" aria-label="Pages">
      <span>
        Page {page} sur {pages}
      </span>
      <span className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={link}>
            Précédente
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className={link}>
            Suivante
          </Link>
        ) : null}
      </span>
    </nav>
  );
}

/** Tableau des événements (écran Événements, fiche d'un compte). */
export function EventsTable({ events, showOrganizer = true }: { events: AdminEvent[]; showOrganizer?: boolean }) {
  const num = "py-3.5 pr-4 text-right font-data tabular-nums";
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] tracking-[0.06em] text-text-muted uppercase">
            <th scope="col" className="pr-4 pb-3 font-medium">Événement</th>
            <th scope="col" className="pr-4 pb-3 font-medium">Date</th>
            {showOrganizer ? <th scope="col" className="pr-4 pb-3 font-medium">Organisateur</th> : null}
            <th scope="col" className="pr-4 pb-3 font-medium">Statut</th>
            <th scope="col" className="pr-4 pb-3 text-right font-medium">Invités</th>
            <th scope="col" className="pr-4 pb-3 text-right font-medium">Cartes</th>
            <th scope="col" className="pr-4 pb-3 text-right font-medium">Envoyées</th>
            <th scope="col" className="pr-4 pb-3 font-medium">Réponses</th>
            <th scope="col" className="pr-4 pb-3 text-right font-medium">Entrées</th>
            <th scope="col" className="pb-3 text-right font-medium">Échecs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {events.map((e) => {
            const type = eventType(e.type);
            return (
              <tr key={e.id} className="hover:bg-surface/60">
                <td className="py-3.5 pr-4">
                  <span className="flex items-center gap-3">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONES.red}`}>
                      <Icon name={type.icon} width={16} height={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block max-w-[240px] truncate font-semibold" title={e.title}>
                        {e.title}
                      </span>
                      <span className="block text-[11px] text-text-muted">{type.label}</span>
                    </span>
                  </span>
                </td>
                <td className="py-3.5 pr-4 text-[12px] whitespace-nowrap text-text-muted">
                  {formatShortDate(e.starts_at)} · {formatTime(e.starts_at)}
                </td>
                {showOrganizer ? (
                  <td className="py-3.5 pr-4">
                    <Link href={`/admin/utilisateurs/${e.organizer_id}`} className="font-medium hover:underline">
                      {e.organizer_name}
                    </Link>
                  </td>
                ) : null}
                <td className="py-3.5 pr-4">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${EVENT_STATUS[e.status].className}`}>
                    {EVENT_STATUS[e.status].label}
                  </span>
                </td>
                <td className={`${num} font-semibold`}>{e.guests.toLocaleString("fr-FR")}</td>
                <td className={num}>{e.cards.toLocaleString("fr-FR")}</td>
                <td className={num}>{e.invitations_sent.toLocaleString("fr-FR")}</td>
                <td className="py-3.5 pr-4 font-data whitespace-nowrap tabular-nums">
                  <span className="inline-flex items-center gap-2.5 text-[12px]">
                    <span className="inline-flex items-center gap-0.5 text-status-confirmed" title="Confirmés">
                      <Icon name="valide" width={13} height={13} />
                      {e.confirmed}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-status-declined" title="Déclinés">
                      <Icon name="decline" width={13} height={13} />
                      {e.declined}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-status-pending" title="En attente">
                      <Icon name="horloge" width={13} height={13} />
                      {e.pending}
                    </span>
                  </span>
                </td>
                <td className={num}>{e.checkins.toLocaleString("fr-FR")}</td>
                <td className={`py-3.5 text-right font-data tabular-nums ${e.messages_failed ? "font-semibold text-status-unreachable" : ""}`}>
                  {e.messages_failed.toLocaleString("fr-FR")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
