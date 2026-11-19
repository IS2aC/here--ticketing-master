import { EventShowcase } from "./event-showcase";

// Panneau de droite des écrans d'accès (écrans larges) : fond noir Here! et vitrine des
// événements en paquet de cartes, qui déborde un peu sur le blanc du formulaire (panneau au-dessus, sans rognage ;
// seul le décor est rogné). La navigation reste dans le formulaire.

export function HeroPanel() {
  return (
    <aside
      aria-label="Here! en bref"
      className="here-fade sticky top-0 z-20 hidden h-dvh min-h-[640px] flex-col bg-ink text-white lg:flex"
    >
      {/* Décor : un seul halo rouge fixe derrière la vitrine, qui la détache du noir. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-[55%] size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-red)_28%,transparent),transparent)]" />
      </div>

      <div className="relative -ml-10 flex min-h-0 flex-1 flex-col py-12 pr-10 xl:-ml-14 xl:pr-14 [@media(max-height:820px)]:py-7">
        <EventShowcase />
      </div>
    </aside>
  );
}
