import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin";
import { logout } from "../(auth)/actions";

// Portail admin (équipe Here!) : même structure que le tableau de bord organisateur.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-surface md:grid md:grid-cols-[248px_1fr]">
      <aside className="flex flex-col gap-6 border-b border-border bg-background px-4 py-5 md:border-r md:border-b-0 md:py-6">
        <Link href="/admin" className="mx-3 self-start">
          <Image src="/brand/logo-horizontal.svg" alt="Here! · Ticketing Master" width={110} height={37} priority />
        </Link>
        <nav className="grid gap-0.5" aria-label="Navigation du portail admin">
          <Link
            href="/admin"
            aria-current="page"
            className="flex h-10 items-center gap-3 rounded-md bg-surface px-3 text-[14px] font-semibold text-text shadow-[inset_3px_0_0_var(--color-primary)]"
          >
            <Icon name="statistiques" className="text-primary" />
            Tableau de bord
          </Link>
          <Link
            href="/tableau-de-bord"
            className="flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium text-text-muted hover:bg-surface hover:text-text"
          >
            <Icon name="calendrier" />
            Espace organisateur
          </Link>
        </nav>
        <Suspense fallback={<div className="mt-auto h-[52px] rounded-md bg-surface" />}>
          <Account />
        </Suspense>
      </aside>
      <main className="flex min-w-0 flex-col gap-6 px-4 py-6 sm:px-8">
        <Suspense fallback={<div className="h-[640px] rounded-lg bg-background" aria-busy="true" />}>
          <AdminOnly>{children}</AdminOnly>
        </Suspense>
      </main>
    </div>
  );
}

async function AdminOnly({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

async function Account() {
  const user = await requireAdmin();
  return (
    <div className="mt-auto flex items-center gap-3 px-1">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface font-heading text-[13px] font-semibold">
        {user.first_name.charAt(0)}
        {user.last_name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">
          {user.first_name} {user.last_name}
        </p>
        <div className="flex gap-3 text-[12px] whitespace-nowrap text-text-muted">
          <span>Administrateur</span>
          <form action={logout}>
            <button type="submit" className="hover:text-text hover:underline">
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
