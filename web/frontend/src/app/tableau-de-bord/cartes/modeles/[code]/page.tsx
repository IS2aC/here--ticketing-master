import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BackLink } from "@/components/back-link";
import { Icon } from "@/components/icons";
import { STYLE_LABELS, getCardTemplate } from "@/lib/card/templates/catalog";
import { FORMATS, type CardFormat } from "@/lib/card/templates/definition";
import { eventType } from "@/lib/event-types";
import { Swatch } from "../../swatches";

export const metadata: Metadata = { title: "Modèle de carte · Here!" };

// Fiche d'un modèle du catalogue : aperçu dans chaque format, palette et polices au choix (liens, sans JavaScript).
export default function TemplatePage({ params, searchParams }: PageProps<"/tableau-de-bord/cartes/modeles/[code]">) {
  return (
    <>
      <BackLink href="/tableau-de-bord/cartes" label="Retour à la bibliothèque" />
      <Suspense fallback={<div className="h-[640px] rounded-lg bg-background" aria-busy="true" />}>
        <TemplateView params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const SOURCES: Record<string, string> = {
  title: "le nom de l'événement",
  date: "la date",
  time: "l'heure",
  location_name: "le lieu",
  location_address: "l'adresse",
  dress_code: "la tenue",
  description: "la description",
  rsvp_deadline: "la date limite de réponse",
};

const FORMAT_HINTS: Record<CardFormat, string> = {
  whatsapp_4_5: "La carte envoyée à chaque invité sur WhatsApp, avec son nom et son QR code.",
  story_9_16: "Pour les statuts WhatsApp et les stories.",
  square_1_1: "Pour les publications carrées.",
  print_a5: "Version à imprimer (A5, 300 dpi, fond perdu de 3 mm) : sans nom d'invité ni QR code.",
};

async function TemplateView({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const template = await getCardTemplate(code);
  const { definition } = template;
  const one = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : undefined);
  const format = definition.formats.find((f) => f === one("format")) ?? "whatsapp_4_5";
  const palette = definition.theme.palettes.find((p) => p.id === one("palette")) ?? definition.theme.palettes[0];
  const fonts = definition.theme.fonts.find((f) => f.id === one("polices")) ?? definition.theme.fonts[0];
  const choice = { format, palette: palette.id, polices: fonts.id };
  const href = (change: Partial<typeof choice>) =>
    `/tableau-de-bord/cartes/modeles/${template.code}?${new URLSearchParams({ ...choice, ...change })}`;
  const image = `/tableau-de-bord/cartes/modeles/${template.code}/apercu.png?${new URLSearchParams(choice)}`;
  const mapped = Object.entries(definition.field_mapping ?? {}).map(([, source]) => SOURCES[source as string]).filter(Boolean);
  const size = FORMATS[format];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="grid gap-3">
        <header>
          <h1 className="font-heading text-[26px] font-bold tracking-[-0.01em]">{template.name}</h1>
          <p className="mt-1 text-[14px] text-text-muted">
            {[template.style ? STYLE_LABELS[template.style] : null, ...template.event_types.map((t) => eventType(t).label)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </header>
        <div className="flex justify-center rounded-lg bg-background p-4 shadow-sm sm:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- image générée par la route du modèle */}
          <img
            key={image}
            src={image}
            alt={`Exemple de carte « ${template.name} », format ${size.label}, palette ${palette.label}`}
            width={size.width + 2 * size.bleed}
            height={size.height + 2 * size.bleed}
            className="h-auto max-h-[78vh] w-auto max-w-full rounded-md shadow-md"
          />
        </div>
      </div>

      <aside className="grid gap-4">
        <Panel title="Format">
          <div className="grid grid-cols-2 gap-2">
            {definition.formats.map((f) => (
              <Choice key={f} href={href({ format: f })} current={f === format}>
                {FORMATS[f].label}
              </Choice>
            ))}
          </div>
          <p className="text-[13px] text-text-muted">{FORMAT_HINTS[format]}</p>
        </Panel>

        <Panel title="Couleurs">
          <div className="grid gap-2">
            {definition.theme.palettes.map((p) => (
              <Choice key={p.id} href={href({ palette: p.id })} current={p.id === palette.id}>
                <Swatch palette={p} size={22} />
                {p.label}
              </Choice>
            ))}
          </div>
        </Panel>

        <Panel title="Polices">
          <div className="grid grid-cols-2 gap-2">
            {definition.theme.fonts.map((f) => (
              <Choice key={f.id} href={href({ polices: f.id })} current={f.id === fonts.id}>
                <span style={f.heading === "Playfair Display" ? { fontFamily: "'Playfair Display', serif" } : undefined}>{f.label}</span>
              </Choice>
            ))}
          </div>
        </Panel>

        <Panel title="Ce que vous personnalisez">
          <ul className="grid gap-1.5 text-[14px]">
            <li className="flex items-center gap-2">
              <Icon name="ajouter" width={16} height={16} className="text-text-muted" />
              Votre photo
            </li>
            {definition.fields.map((f) => (
              <li key={f.key} className="flex items-center gap-2">
                <Icon name="ajouter" width={16} height={16} className="text-text-muted" />
                {f.label}
              </li>
            ))}
          </ul>
          {mapped.length ? (
            <p className="text-[13px] text-text-muted">Repris automatiquement de votre événement : {mapped.join(", ")}.</p>
          ) : null}
        </Panel>

        <p className="rounded-lg bg-background p-4 text-[13px] text-text-muted shadow-sm">
          Ceci est un exemple : la photo, les noms et le lieu sont fictifs. Très bientôt, vous pourrez choisir ce modèle pour
          votre événement, y mettre votre photo et l&apos;envoyer à vos invités.
        </p>
      </aside>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-lg bg-background p-5 shadow-sm">
      <h2 className="font-heading text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Choice({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={current ? "true" : undefined}
      className={`flex min-h-11 items-center gap-2 rounded-md px-3 text-[14px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        current ? "bg-ink text-white" : "shadow-[inset_0_0_0_1px_var(--color-border)] hover:bg-surface"
      }`}
    >
      {children}
    </Link>
  );
}
