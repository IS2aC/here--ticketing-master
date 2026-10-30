import type { Metadata } from "next";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { getUsers, PAGE_SIZE } from "@/lib/admin";
import { formatShortDate } from "@/lib/events";
import { maskPhone } from "@/lib/phone";
import { AVATARS, CARD, Pager, SeeButton } from "../ui";

export const metadata: Metadata = { title: "Utilisateurs · Portail admin · Here!" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function read(searchParams: Record<string, string | string[] | undefined>) {
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  return { q, page };
}

export default function UsersPage({ searchParams }: PageProps<"/admin/utilisateurs">) {
  return (
    <>
      <header>
        <p className="text-[12px] font-medium tracking-[0.02em] text-text-muted">Admin · Utilisateurs</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Utilisateurs</h1>
        <p className="mt-0.5 text-[13px] text-text-muted">Les comptes inscrits sur Here!, du plus récent au plus ancien.</p>
      </header>
      <Suspense fallback={<div className={`h-[640px] ${CARD}`} aria-busy="true" />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Users({ searchParams }: { searchParams: SearchParams }) {
  const { q, page } = read(await searchParams);
  const { total, items } = await getUsers({ q, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const href = (p: number) => `/admin/utilisateurs?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <section className={`${CARD} p-6`} aria-label="Liste des utilisateurs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-text-muted">
          <span className="font-data font-semibold text-text tabular-nums">{total.toLocaleString("fr-FR")}</span> compte{total > 1 ? "s" : ""}
          {q ? ` pour « ${q} »` : ""}
        </p>
        <form role="search" className="relative sm:w-80">
          <label htmlFor="admin-users-q" className="sr-only">
            Rechercher un compte
          </label>
          <Icon name="recherche" width={18} height={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted" />
          <input
            id="admin-users-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Nom, téléphone, e-mail, structure…"
            className="h-10 w-full rounded-xl bg-background pr-4 pl-10 text-[13px] shadow-[inset_0_0_0_1px_var(--color-border)] outline-none placeholder:text-text-muted focus:shadow-[inset_0_0_0_2px_var(--color-primary)]"
          />
        </form>
      </div>

      {items.length ? (
        <div className="relative mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] tracking-[0.06em] text-text-muted uppercase">
                {["Nom", "Téléphone", "E-mail", "Structure", "Ville", "Inscription", "Dernière connexion"].map((h) => (
                  <th key={h} scope="col" className="pr-4 pb-3 font-medium">
                    {h}
                  </th>
                ))}
                <th scope="col" className="pb-3 text-center font-medium">
                  Événements
                </th>
                <th scope="col" className="pb-3 text-right font-medium">
                  <span className="sr-only">Fiche</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {items.map((u, i) => (
                <tr key={u.id} className="hover:bg-surface/60">
                  <td className="py-3.5 pr-4">
                    <span className="flex items-center gap-3 font-semibold">
                      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full font-heading text-[11px] font-bold ${AVATARS[i % AVATARS.length]}`}>
                        {u.first_name.charAt(0)}
                        {u.last_name.charAt(0)}
                      </span>
                      <span>
                        {u.first_name} {u.last_name}
                        {u.role !== "organizer" ? (
                          <span className="ml-2 rounded-sm bg-ink px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] text-white uppercase">
                            {u.role === "admin" ? "Admin" : "Support"}
                          </span>
                        ) : null}
                        {u.on_demand_reminders ? (
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-status-confirmed">
                            <Icon name="relance" width={12} height={12} />
                            Relances à la demande
                          </span>
                        ) : null}
                        {u.day_before_reminders ? (
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-status-confirmed">
                            <Icon name="qr-code" width={12} height={12} />
                            Rappel la veille
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 font-data whitespace-nowrap text-text-muted tabular-nums">{maskPhone(u.phone)}</td>
                  <td className="py-3.5 pr-4 text-text-muted">{u.email ?? "—"}</td>
                  <td className="py-3.5 pr-4 text-text-muted">{u.organization ?? "—"}</td>
                  <td className="py-3.5 pr-4 text-text-muted">{u.city ?? "—"}</td>
                  <td className="py-3.5 pr-4 text-[12px] whitespace-nowrap text-text-muted">{formatShortDate(u.created_at)}</td>
                  <td className="py-3.5 pr-4 text-[12px] whitespace-nowrap text-text-muted">{u.last_login_at ? formatShortDate(u.last_login_at) : "—"}</td>
                  <td className="py-3.5 text-center font-data font-semibold tabular-nums">{u.events.toLocaleString("fr-FR")}</td>
                  <td className="py-3.5 text-right">
                    <SeeButton href={`/admin/utilisateurs/${u.id}`} name={`${u.first_name} ${u.last_name}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-text-muted">
            <Icon name="cadenas" width={14} height={14} />
            Liste privée : numéros masqués.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-surface text-text-muted">
            <Icon name="profil" width={28} height={28} />
          </span>
          <p className="font-heading text-[18px] font-semibold">{q ? "Aucun compte ne correspond" : "Aucun compte pour l'instant"}</p>
          <p className="text-[14px] text-text-muted">{q ? "Vérifiez l'orthographe, ou cherchez par numéro de téléphone." : "Les inscriptions apparaîtront ici."}</p>
        </div>
      )}
      <Pager total={total} page={page} size={PAGE_SIZE} href={href} />
    </section>
  );
}
