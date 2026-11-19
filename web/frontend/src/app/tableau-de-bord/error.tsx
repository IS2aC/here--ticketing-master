"use client";

import { ErrorState } from "@/components/error-state";

// Garde la barre latérale du tableau de bord autour de l'erreur.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} home={{ href: "/tableau-de-bord", label: "Retour au tableau de bord" }} />;
}
