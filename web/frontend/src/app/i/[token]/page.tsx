import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { apiFetch } from "@/lib/api";
import type { PublicCard } from "@/lib/card/data";

export const metadata: Metadata = { title: "Votre invitation · Here!", robots: { index: false } };

// Page invité (lien du QR code). Pour l'instant : la carte. La confirmation de présence viendra ensuite.
export default function InvitationPage({ params }: PageProps<"/i/[token]">) {
  return (
    <main className="flex flex-1 flex-col items-center gap-6 bg-surface px-4 py-8">
      <Image src="/brand/logo-horizontal.svg" alt="Here!" width={110} height={37} />
      <Suspense fallback={<div className="aspect-[4/5] w-full max-w-[480px] rounded-md bg-background" aria-busy="true" />}>
        <Invitation params={params} />
      </Suspense>
    </main>
  );
}

async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = await apiFetch(`/v1/invitations/${encodeURIComponent(token)}`);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error(`API /v1/invitations : ${response.status}`);
  const card = (await response.json()) as PublicCard;
  return (
    <div className="grid w-full max-w-[480px] gap-5 text-center">
      <h1 className="font-heading text-[24px] font-bold">Bonjour {card.guest_name}</h1>
      {/* eslint-disable-next-line @next/next/no-img-element -- carte générée à la demande */}
      <img src={`/i/${encodeURIComponent(token)}/carte.png`} alt={`Votre invitation : ${card.title}`} width={1080} height={1350} className="h-auto w-full rounded-md shadow-lg" />
      <p className="text-[17px] text-text-muted">Gardez cette carte : son QR code sera scanné à l&apos;entrée.</p>
    </div>
  );
}
