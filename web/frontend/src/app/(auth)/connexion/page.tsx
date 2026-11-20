import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Se connecter · Here!" };

export default function LoginPage({ searchParams }: PageProps<"/connexion">) {
  return (
    <>
      <AuthHeading badge="Bienvenue sur Here!" title="Connectez-vous" accent="à votre espace">
        Gérez vos événements, créez vos cartes d&apos;invitation et suivez les réponses de vos invités.
      </AuthHeading>
      <Suspense fallback={null}>
        <GoogleSignIn searchParams={searchParams} />
      </Suspense>
      <LoginForm />
    </>
  );
}
