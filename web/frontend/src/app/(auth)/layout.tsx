import Image from "next/image";
import Link from "next/link";
import { HeroPanel } from "@/components/auth/hero-panel";

// Écrans d'accès (connexion, inscription, mot de passe oublié) : formulaire à gauche (42 %),
// univers Here! sur fond noir à droite (58 %, écrans larges seulement).
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-1 lg:grid lg:grid-cols-[42%_58%] lg:bg-ink">
      <main className="relative z-10 flex min-h-dvh w-full flex-col overflow-hidden bg-background px-5 py-7 sm:px-10 lg:rounded-r-[32px] lg:px-12 xl:px-16">
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
