"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui";
import { Icon } from "@/components/icons";

// État d'erreur (DESIGN.md › États des écrans) : ce qui s'est passé, ce qui n'est pas perdu, la solution en bouton principal.
export function ErrorState({ error, retry, home }: { error: unknown; retry: () => void; home: { href: string; label: string } }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-5 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-error/10 text-error">
        <Icon name="alerte" width={28} height={28} aria-hidden="true" />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="font-heading text-[22px] font-bold">Cette page n&apos;a pas pu s&apos;afficher</h1>
        <p className="text-text-muted">
          Le serveur Here! n&apos;a pas répondu. Vos événements, vos invités et leurs réponses sont conservés. Réessayez dans un instant.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={() => retry()}>
          Réessayer
        </Button>
        <ButtonLink href={home.href} variant="ghost">
          {home.label}
        </ButtonLink>
      </div>
    </main>
  );
}
