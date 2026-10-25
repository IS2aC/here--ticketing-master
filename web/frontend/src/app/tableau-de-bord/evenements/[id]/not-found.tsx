import { Icon } from "@/components/icons";
import { ButtonLink } from "@/components/ui";

export default function EventNotFound() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-lg bg-background px-6 py-16 text-center shadow-sm">
      <div className="flex size-16 items-center justify-center rounded-full bg-surface text-text-muted">
        <Icon name="calendrier" width={28} height={28} />
      </div>
      <h1 className="font-heading text-[18px] font-semibold">Cet événement est introuvable</h1>
      <p className="max-w-md text-[14px] text-text-muted">
        Le lien est peut-être incomplet, ou l&apos;événement appartient à un autre compte.
      </p>
      <ButtonLink href="/tableau-de-bord" className="mt-2 h-10 text-[14px]">
        Voir mes événements
      </ButtonLink>
    </section>
  );
}
