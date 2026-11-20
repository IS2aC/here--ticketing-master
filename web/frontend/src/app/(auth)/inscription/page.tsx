import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { RegisterForm } from "./form";

export const metadata: Metadata = { title: "Créer un compte · Here!" };

export default function RegisterPage({ searchParams }: PageProps<"/inscription">) {
  return (
    <>
      <AuthHeading badge="Nouveau sur Here!" title="Créez" accent="votre compte">
        Ensuite, créez votre premier événement et importez votre liste d&apos;invités.
      </AuthHeading>
      <Suspense fallback={null}>
        <GoogleSignIn searchParams={searchParams} />
      </Suspense>
      <RegisterForm />
    </>
  );
}
