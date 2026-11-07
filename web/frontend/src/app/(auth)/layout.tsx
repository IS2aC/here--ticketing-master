import Image from "next/image";
import Link from "next/link";
import { HeroPanel } from "@/components/auth/hero-panel";

// Écrans d'accès (connexion, inscription, mot de passe oublié) : formulaire à gauche (42 %),
// univers Here! sur fond noir à droite (58 %, écrans larges seulement).
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-1 lg:grid lg:grid-cols-[42%_58%] lg:bg-ink">
      <main className="relative z-10 flex min-h-dvh w-full flex-col overflow-hidden bg-background px-5 py-7 sm:px-10 lg:rounded-r-[32px] lg:px-12 xl:px-16">
        {/* Voiles rosés du fond, comme la maquette. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -left-40 size-[420px] rounded-full bg-[radial-gradient(closest-side,rgba(225,6,0,0.07),transparent)]" />
          <div className="absolute -bottom-48 -left-32 h-[340px] w-[560px] rotate-[-12deg] rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,77,61,0.16),transparent)]" />
        </div>

        <div className="here-rise relative mx-auto flex w-full max-w-[440px] flex-1 flex-col">
          <Link href="/connexion" className="self-start rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            <Image src="/brand/logo-principal.svg" alt="Here! · Ticketing Master" width={150} height={64} preload className="h-auto w-[128px] sm:w-[150px]" />
          </Link>
          <div className="flex flex-1 flex-col justify-center py-10 sm:py-12">{children}</div>
        </div>
      </main>
      <HeroPanel />
    </div>
  );
}
