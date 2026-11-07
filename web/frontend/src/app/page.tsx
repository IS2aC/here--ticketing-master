import { redirect } from "next/navigation";

// La page de garde est l'écran de connexion (la redirection se fait d'abord dans src/proxy.ts).
export default function Home() {
  redirect("/connexion");
}
