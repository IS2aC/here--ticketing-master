import Image from "next/image";
import { Suspense } from "react";
import { ApiStatus } from "./api-status";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <Image src="/brand/logo-principal.svg" alt="Here! · Ticketing Master" width={280} height={120} priority />
      <div className="flex max-w-xl flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight">Vous invitez. On s&apos;occupe du reste.</h1>
        <p className="text-text-muted">
          Organisez votre cérémonie. Les relances, on s&apos;en charge.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-text-muted">Vérification de l&apos;API…</p>}>
        <ApiStatus />
      </Suspense>
    </main>
  );
}
