import type { Metadata } from "next";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { apiFetch } from "@/lib/api";
import type { ScanEvent } from "@/lib/scan";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Scan à l'entrée · Here!", robots: { index: false } };

// Écran des agents d'accueil, ouvert depuis le lien de scan partagé par l'organisateur.
export default function ScanPage({ params }: PageProps<"/scan/[token]">) {
  return (
    <main data-theme="dark" className="flex min-h-screen flex-1 flex-col bg-ink text-white">
      <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
        <Scan params={params} />
      </Suspense>
    </main>
  );
}

async function Scan({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = await apiFetch(`/v1/scan/${encodeURIComponent(token)}`);
  if (response.status === 410) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Icon name="decline" width={56} height={56} className="text-red-bright" />
        <h1 className="font-heading text-[24px] font-bold">Événement annulé</h1>
        <p className="text-[17px] text-gray-500">Le scan est fermé : aucune entrée n&apos;est enregistrée. En cas de doute, appelez l&apos;organisateur.</p>
      </div>
    );
  }
  if (!response.ok) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Icon name="decline" width={56} height={56} className="text-red-bright" />
        <h1 className="font-heading text-[24px] font-bold">Ce lien de scan n&apos;est plus valide</h1>
        <p className="text-[17px] text-gray-500">Il a été désactivé ou l&apos;événement est terminé. Demandez un nouveau lien à l&apos;organisateur.</p>
      </div>
    );
  }
  return <Scanner token={token} initial={(await response.json()) as ScanEvent} />;
}
