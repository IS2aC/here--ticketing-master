import type { Metadata } from "next";
import { AuthHeading } from "@/components/auth/auth-heading";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Se connecter · Here!" };

export default function LoginPage() {
  return (
    <>
      <AuthHeading badge="Bienvenue sur Here!" title="Connectez-vous" accent="à votre espace">
        Gérez vos événements, créez vos cartes d&apos;invitation et suivez les réponses de vos invités.
      </AuthHeading>
      <LoginForm />
    </>
  );
}
