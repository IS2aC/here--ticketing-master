import Image from "next/image";
import Link from "next/link";

// Écrans d'accès : formulaire à gauche, promesse Here! sur fond noir à droite (masquée sur mobile).
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[1fr_minmax(0,560px)]">
      <main className="flex flex-col px-4 py-8 sm:px-10">
        <Link href="/" className="self-start rounded-sm focus-visible:outline-2 focus-visible:outline-primary">
          <Image src="/brand/logo-horizontal.svg" alt="Here! · Ticketing Master" width={140} height={47} priority />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[440px]">{children}</div>
        </div>
      </main>
      <aside className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <Image src="/brand/logo-negatif.svg" alt="" width={150} height={64} />
        <div className="flex flex-col gap-4">
          <p className="font-heading text-[44px] leading-[1.05] font-extrabold tracking-[-0.02em]">
            Vous invitez.
            <br />
            <span className="text-red-bright">On s&apos;occupe du reste.</span>
          </p>
          <p className="max-w-sm text-gray-500">
            Une carte personnalisée par invité, envoyée sur WhatsApp. Les relances et les appels, c&apos;est nous.
          </p>
        </div>
        <p className="text-[13px] text-gray-500">Mariages, dots, baptêmes, brunchs, séminaires, hommages…</p>
      </aside>
    </div>
  );
}
