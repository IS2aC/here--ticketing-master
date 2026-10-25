import type { Metadata } from "next";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Se connecter · Here!" };

export default function LoginPage() {
  return (
    <>
      <h1 className="font-heading text-[32px] leading-[1.15] font-bold tracking-[-0.01em]">Bon retour</h1>
      <p className="mt-2 mb-8 text-text-muted">Retrouvez vos événements et vos invités.</p>
      <LoginForm />
    </>
  );
}
