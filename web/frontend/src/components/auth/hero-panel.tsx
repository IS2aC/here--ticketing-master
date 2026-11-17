import { EventShowcase } from "./event-showcase";

// Panneau de droite des écrans d'accès (écrans larges) : fond noir carrelé de la charte Here! et vitrine des
// événements en paquet de cartes, qui déborde un peu sur le blanc du formulaire (panneau au-dessus, sans rognage ;
// seul le décor est rogné). La navigation reste dans le formulaire.

export function HeroPanel() {
  return (
    <aside
      aria-label="Here! en bref"
      className="here-fade sticky top-0 z-20 hidden h-dvh min-h-[640px] flex-col bg-ink text-white lg:flex"
    >
      {/* Décor : carrelage fin qui s'efface vers les bords, un carreau sur cinq plus marqué, halos rouges. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_55%_45%,black_30%,transparent_85%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,77,61,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,77,61,0.10)_1px,transparent_1px)] bg-[size:200px_200px] [mask-image:radial-gradient(ellipse_at_55%_45%,black_20%,transparent_75%)]" />
        <div className="here-glow absolute -top-56 -right-40 size-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(225,6,0,0.55),rgba(225,6,0,0.12)_55%,transparent)] blur-2xl" />
        <div className="here-glow absolute -bottom-40 -left-32 size-[460px] rounded-full bg-[radial-gradient(closest-side,rgba(225,6,0,0.22),transparent)] blur-2xl [animation-delay:-4s]" />
      </div>

      <div className="relative -ml-10 flex min-h-0 flex-1 flex-col py-12 pr-10 xl:-ml-14 xl:pr-14 [@media(max-height:820px)]:py-7">
        <EventShowcase />
      </div>
    </aside>
  );
}
