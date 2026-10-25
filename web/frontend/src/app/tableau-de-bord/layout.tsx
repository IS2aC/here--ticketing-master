import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "../(auth)/actions";

export default function DashboardLayout({ children }: LayoutProps<"/tableau-de-bord">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-surface md:grid md:grid-cols-[248px_1fr]">
      <aside className="flex flex-col gap-6 border-b border-border bg-background px-4 py-5 md:border-r md:border-b-0 md:py-6">
        <Link href="/tableau-de-bord" className="mx-3 self-start">
          <Image src="/brand/logo-horizontal.svg" alt="Here! · Ticketing Master" width={110} height={37} priority />
        </Link>
        <nav className="grid gap-0.5" aria-label="Navigation principale">
          <Link
            href="/tableau-de-bord"
            aria-current="page"
            className="flex h-10 items-center gap-3 rounded-md bg-surface px-3 text-[14px] font-semibold text-text shadow-[inset_3px_0_0_var(--color-primary)]"
          >
            <Icon name="statistiques" className="text-primary" />
            Tableau de bord
          </Link>
        </nav>
        <div className="mt-auto hidden rounded-md bg-ink p-4 text-white md:block">
          <Icon name="support" className="text-red-bright" />
          <p className="mt-2 font-heading text-[14px] font-semibold">Une question ?</p>
          <p className="mt-0.5 text-[12px] leading-snug text-gray-500">
            L&apos;équipe Here! vous accompagne pour vos invitations et vos relances.
          </p>
        </div>
        <Suspense fallback={<div className="h-[52px] rounded-md bg-surface" />}>
          <Account />
        </Suspense>
      </aside>
      <main className="flex min-w-0 flex-col gap-6 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}

async function Account() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface font-heading text-[13px] font-semibold">
        {user.first_name.charAt(0)}
        {user.last_name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">
          {user.first_name} {user.last_name}
        </p>
        <form action={logout}>
          <button type="submit" className="text-[12px] text-text-muted hover:text-text hover:underline">
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
