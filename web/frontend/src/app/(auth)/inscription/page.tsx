import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { RegisterForm } from "./form";

export const metadata: Metadata = { title: "Créer un compte · Here!" };

export default function RegisterPage() {
  return (
    <>
      <AuthHeading badge="Nouveau sur Here!" title="Créez" accent="votre compte">
        Organisez votre premier événement en quelques minutes.
      </AuthHeading>
      <RegisterForm />
    </>
  );
}
