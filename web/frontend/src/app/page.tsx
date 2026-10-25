import Image from "next/image";
import { ButtonLink } from "@/components/ui";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <Image src="/brand/logo-principal.svg" alt="Here! · Ticketing Master" width={280} height={120} priority />
      <div className="flex max-w-xl flex-col gap-3">
        <h1 className="font-heading text-[40px] leading-[1.05] font-extrabold tracking-[-0.02em] sm:text-[44px]">
          Vous invitez. On s&apos;occupe du reste.
        </h1>
        <p className="text-text-muted">Organisez votre cérémonie. Les relances, on s&apos;en charge.</p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <ButtonLink href="/inscription">Créer un compte</ButtonLink>
        <ButtonLink href="/connexion" variant="ghost">
          Se connecter
        </ButtonLink>
      </div>
    </main>
  );
}
