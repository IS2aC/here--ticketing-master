import type { Metadata } from "next";
import { Suspense } from "react";
import { Toast } from "@/components/toast";
import { getSettings } from "@/lib/admin";
import { formatShortDate, formatTime } from "@/lib/events";
import { saveSettings } from "../actions";
import { CARD } from "../ui";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Réglages · Portail admin · Here!" };

export default function SettingsPage({ searchParams }: PageProps<"/admin/reglages">) {
  return (
    <>
      <header>
        <p className="text-[12px] font-medium tracking-[0.02em] text-text-muted">Admin · Réglages</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold tracking-[-0.01em]">Réglages de la plateforme</h1>
        <p className="mt-0.5 text-[13px] text-text-muted">
          Ils remplacent les variables d&apos;environnement du même nom, sans redéployer. Un réglage non modifié garde sa valeur par défaut.
        </p>
      </header>
      <Suspense fallback={null}>
        <Saved searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<div className={`h-[640px] ${CARD}`} aria-busy="true" />}>
        <Settings />
      </Suspense>
    </>
  );
}

// Notification après un enregistrement (?enregistre=1) ou un retour à la valeur par défaut (?retabli=1).
async function Saved({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  if (query.enregistre) return <Toast title="Réglages enregistrés" detail="Le worker les applique à son prochain tour." />;
  if (query.retabli) return <Toast title="Valeur par défaut rétablie" detail="Le worker l'applique à son prochain tour." />;
  return null;
}

async function Settings() {
  const settings = await getSettings();
  return (
    <>
      {settings.updated_at ? (
        <p className="-mt-3 text-[12px] text-text-muted">
          Dernière modification : {formatShortDate(settings.updated_at)} · {formatTime(settings.updated_at)}
        </p>
      ) : null}
      {/* key : après un enregistrement, le formulaire repart des valeurs en vigueur. */}
      <SettingsForm key={settings.updated_at ?? "defaut"} settings={settings} action={saveSettings} />
    </>
  );
}
