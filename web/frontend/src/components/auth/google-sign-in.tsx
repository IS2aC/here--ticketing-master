import { connection } from "next/server";
import { googleClientId } from "@/lib/google";
import { AuthAlert } from "./auth-field";

const MESSAGES: Record<string, string> = {
  annule: "Connexion avec Google annulée. Vous pouvez réessayer, ou utiliser votre téléphone ou votre e-mail.",
  erreur: "La connexion avec Google n'a pas abouti. Réessayez, ou utilisez votre téléphone ou votre e-mail.",
};

/** « Continuer avec Google », au-dessus du formulaire. Absent si GOOGLE_CLIENT_ID n'est pas configuré. */
export async function GoogleSignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection(); // variable d'environnement lue à l'exécution, pas figée au build
  if (!googleClientId()) return null;
  const { google } = await searchParams;
  const message = typeof google === "string" ? MESSAGES[google] : undefined;

  return (
    <div className="mb-6 grid gap-5">
      {message ? <AuthAlert>{message}</AuthAlert> : null}
      {/* Lien simple (pas de préchargement) : la route redirige vers Google. */}
      <a
        href="/api/auth/google"
        className="inline-flex h-[56px] w-full items-center justify-center gap-3 rounded-full bg-background px-6 font-heading text-[16px] font-semibold text-text shadow-[inset_0_0_0_1px_var(--color-border)] transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continuer avec Google
      </a>
      <p className="flex items-center gap-3 text-[13px] text-text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        ou
      </p>
    </div>
  );
}
