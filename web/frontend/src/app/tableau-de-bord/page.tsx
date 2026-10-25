import type { Metadata } from "next";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Tableau de bord · Here!" };

export default function DashboardPage() {
  return (
    <>
      <header>
        <p className="text-[12px] text-text-muted">Tableau de bord</p>
        <Suspense fallback={<div className="mt-1 h-8 w-64 rounded-md bg-background" />}>
          <Greeting />
        </Suspense>
      </header>

      {/* État vide (DESIGN.md) : pastille, ce qui manque, quoi faire, une action. */}
      <section className="flex flex-col items-center gap-3 rounded-lg bg-background px-6 py-16 text-center shadow-sm">
        <div className="flex size-16 items-center justify-center rounded-full bg-surface text-text-muted">
          <Icon name="calendrier" width={28} height={28} />
        </div>
        <h2 className="font-heading text-[18px] font-semibold">Vous n&apos;avez pas encore d&apos;événement</h2>
        <p className="max-w-md text-[14px] text-text-muted">
          Créez votre premier événement : nous préparons les cartes, les envois WhatsApp et les relances.
        </p>
        <Button type="button" disabled className="mt-2 h-10 text-[14px]" title="Bientôt disponible">
          <Icon name="ajouter" width={18} height={18} />
          Créer un événement
        </Button>
      </section>
    </>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  return (
    <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Bonjour {user.first_name}</h1>
  );
}
