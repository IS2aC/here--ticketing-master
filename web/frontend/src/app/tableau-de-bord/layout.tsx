import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "../(auth)/actions";
import { Nav, NavLinks } from "./nav";
import { SupportChat } from "./support-chat";

export default function DashboardLayout({ children }: LayoutProps<"/tableau-de-bord">) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-surface md:grid md:grid-cols-[248px_1fr]">
      <aside className="flex flex-col gap-6 border-b border-border bg-background px-4 py-5 md:border-r md:border-b-0 md:py-6">
        <Link href="/tableau-de-bord" className="mx-3 self-start">
          <Image src="/brand/logo-horizontal.svg" alt="Here! · Ticketing Master" width={110} height={37} priority />
        </Link>
        <Suspense fallback={<NavLinks />}>
          <Nav />
        </Suspense>
        <Suspense fallback={null}>
          <AdminLink />
        </Suspense>
        <div className="mt-auto">
          <Suspense fallback={<div className="h-[104px] rounded-2xl bg-ink" />}>
            <Support />
          </Suspense>
        </div>
        <Suspense fallback={<div className="h-[52px] rounded-md bg-surface" />}>
          <Account />
        </Suspense>
      </aside>
      <main className="flex min-w-0 flex-col gap-6 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}

// Équipe Here! : accès au portail admin.
async function AdminLink() {
  const user = await getCurrentUser();
  if (user.role !== "admin") return null;
  return (
    <Link
      href="/admin"
      className="-mt-5 flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium text-text-muted hover:bg-surface hover:text-text"
    >
      <Icon name="cadenas" />
      Portail admin
    </Link>
  );
}

// « Une question ? » : discussion avec l'assistant et l'équipe Here!.
async function Support() {
  const user = await getCurrentUser();
  return <SupportChat firstName={user.first_name} />;
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
        <Link href="/tableau-de-bord/profil" className="block truncate text-[13px] font-semibold hover:underline">
          {user.first_name} {user.last_name}
        </Link>
        <div className="flex gap-3 text-[12px] whitespace-nowrap text-text-muted">
          <Link href="/tableau-de-bord/profil" className="hover:text-text hover:underline">
            Mon profil
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
