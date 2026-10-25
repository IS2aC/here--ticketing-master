import Image from "next/image";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Image src="/brand/logo-horizontal.svg" alt="Here! · Ticketing Master" width={140} height={47} />
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="font-heading text-[26px] font-bold">Cette page n&apos;existe pas</h1>
        <p className="text-text-muted">Le lien est peut-être incomplet. Revenez à l&apos;accueil pour continuer.</p>
      </div>
      <ButtonLink href="/">Revenir à l&apos;accueil</ButtonLink>
    </main>
  );
}
