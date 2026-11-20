import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { PhoneForm } from "./form";

export const metadata: Metadata = { title: "Bienvenue · Here!" };

// Après la première connexion avec Google : le numéro WhatsApp est proposé, jamais exigé.
export default function WelcomePage() {
  return (
    <Suspense fallback={<div className="h-[320px] max-w-xl rounded-lg bg-background" aria-busy="true" />}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const user = await getCurrentUser();
  return (
    <>
      <header>
        <h1 className="font-heading text-[26px] font-bold tracking-[-0.01em]">Bienvenue sur Here!, {user.first_name}</h1>
        <p className="mt-1 text-[14px] text-text-muted">Votre compte est créé avec Google. Une dernière information, si vous le souhaitez.</p>
      </header>
      <section className="max-w-xl rounded-lg bg-background p-5 shadow-sm sm:p-8">
        <PhoneForm />
      </section>
    </>
  );
}
