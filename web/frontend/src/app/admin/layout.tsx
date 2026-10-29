import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin";
import { logout } from "../(auth)/actions";
import { AdminNav, AdminNavLinks } from "./nav";

// Portail admin (équipe Here!) : maquette Stitch, charte Here!.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-surface md:grid md:grid-cols-[256px_1fr]">
      <aside className="flex min-w-0 flex-col gap-6 border-b border-border bg-background px-4 py-6 md:sticky md:top-0 md:h-screen md:border-r md:border-b-0">
        <Link href="/admin" className="mx-3 self-start">
          <Image src="/brand/logo-horizontal.svg" alt="Here! · Ticketing Master" width={110} height={37} priority />
        </Link>
        <Suspense fallback={<AdminNavLinks />}>
          <AdminNav />
        </Suspense>
        <div className="mt-auto grid min-w-0 gap-4">
          <div className="hidden rounded-2xl bg-ink p-4 text-white md:block">
            <Icon name="support" className="text-red-bright" />
            <p className="mt-3 font-heading text-[14px] font-semibold">Une question ?</p>
            <p className="mt-0.5 text-[12px] leading-snug text-gray-500">L&apos;équipe Here! vous accompagne pour la gestion de la plateforme.</p>
          </div>
          <Suspense fallback={<div className="h-[52px] rounded-md bg-surface" />}>
            <Account />
          </Suspense>
        </div>
      </aside>
      <main className="flex min-w-0 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <Suspense fallback={<div className="h-[640px] rounded-2xl bg-background" aria-busy="true" />}>
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
    <div className="flex items-center gap-3 px-2">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface font-heading text-[12px] font-bold">
        {user.first_name.charAt(0)}
        {user.last_name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1 text-[12px]">
        <p className="truncate font-semibold">
          {user.first_name} {user.last_name}
        </p>
        <p className="text-text-muted">Administrateur</p>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-text-muted">
          <Link href="/tableau-de-bord" className="hover:text-text hover:underline">
            Espace organisateur
          </Link>
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
