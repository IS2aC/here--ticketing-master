import type { Metadata } from "next";
import { RegisterForm } from "./form";

export const metadata: Metadata = { title: "Créer un compte · Here!" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="font-heading text-[32px] leading-[1.15] font-bold tracking-[-0.01em]">Créer votre compte</h1>
      <p className="mt-2 mb-8 text-text-muted">Organisez votre premier événement en quelques minutes.</p>
      <RegisterForm />
    </>
  );
}
