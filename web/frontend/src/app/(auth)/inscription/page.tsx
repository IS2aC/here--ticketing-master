import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { RegisterForm } from "./form";

export const metadata: Metadata = { title: "Créer un compte · Here!" };

export default function RegisterPage() {
  return (
    <>
      <AuthHeading badge="Nouveau sur Here!" title="Créez" accent="votre compte">
        Ensuite, créez votre premier événement et importez votre liste d&apos;invités.
      </AuthHeading>
      <RegisterForm />
    </>
  );
}
