import type { Metadata } from "next";
import { BackToDashboard } from "@/components/back-link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Toast } from "@/components/toast";
import { getCurrentUser } from "@/lib/auth";
import { changePassword, updateProfile } from "./actions";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Mon profil · Here!" };

export default function ProfilePage({ searchParams }: PageProps<"/tableau-de-bord/profil">) {
  return (
    <>
      <header>
        <BackToDashboard />
        <h1 className="font-heading text-[26px] font-bold tracking-[-0.01em]">Mon profil</h1>
        <p className="mt-1 text-[14px] text-text-muted">Vos informations aident l&apos;équipe Here! à vous accompagner et à établir vos factures.</p>
      </header>
      <Suspense fallback={<div className="h-[640px] rounded-lg bg-background" aria-busy="true" />}>
        <Profile searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Profile({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, query] = await Promise.all([getCurrentUser(), searchParams]);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg bg-background p-5 shadow-sm sm:p-6">
        <ProfileForm user={user} action={updateProfile} />
      </section>
      <aside className="grid content-start gap-4">
        <section className="grid gap-4 rounded-lg bg-background p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-heading text-[16px] font-semibold">
            <Icon name="cadenas" width={18} height={18} />
            Mot de passe
          </h2>
          <PasswordForm action={changePassword} />
        </section>
        <p className="flex items-start gap-2 rounded-lg bg-background p-4 text-[13px] text-text-muted shadow-sm">
          <Icon name="cadenas" width={16} height={16} className="mt-0.5 shrink-0" />
          Vos informations ne sont visibles que par vous et l&apos;équipe Here!.
        </p>
      </aside>
      {query.enregistre === "profil" ? <Toast title="Profil enregistré" detail="Vos informations sont à jour." /> : null}
      {query.enregistre === "mot-de-passe" ? (
        <Toast title="Mot de passe modifié" detail="Vos autres appareils ont été déconnectés." />
      ) : null}
    </div>
  );
}
