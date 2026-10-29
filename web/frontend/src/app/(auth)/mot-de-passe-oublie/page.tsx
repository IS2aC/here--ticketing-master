import type { Metadata } from "next";
import { ResetForm } from "./form";

export const metadata: Metadata = { title: "Mot de passe oublié · Here!" };

export default function ForgotPasswordPage() {
  return <ResetForm />;
}
