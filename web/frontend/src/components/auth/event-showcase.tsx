"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

// Vitrine des écrans d'accès : un paquet de cartes. Devant, une « page Here! » dans une fenêtre de navigateur
// (surtitre, grand titre, grande photo de l'événement), sa légende et ses points ; derrière, deux cartes qui
// changent d'inclinaison à chaque diapositive, comme un paquet qu'on bat, et s'envolent en éventail au survol.
// Aucun défilement automatique : le visiteur avance quand il veut, en glissant la carte vers la gauche ou la
// droite, avec les flèches (écran ou clavier) ou les points.

type Photo = { src: string; position?: string };
type Slide = {
  id: string;
  page: string; // barre d'adresse de la fenêtre
  kicker: string;
  title: string[]; // lignes du grand titre
  text: string;
  caption: { kicker: string; title: string };
  photo: Photo;
  alt: string;
};

const P = (name: string, position?: string): Photo => ({ src: `/images/vitrine/${name}.webp`, position });

const SLIDES: Slide[] = [
  {
    id: "here",
    page: "accueil",
    kicker: "Invitations · WhatsApp · Contrôle des entrées",
    title: ["Vous invitez.", "On s'occupe", "du reste."],
    text: "Cartes d'invitation, envoi sur WhatsApp, relances et contrôle des entrées.",
    caption: { kicker: "La plateforme", title: "Here!" },
    photo: P("dot", "55% center"),
    alt: "Cérémonie de dot : couple en tenue traditionnelle entouré des familles, organisée avec Here!",
  },
  {
    id: "mariage",
    page: "mariage",
    kicker: "Mariages et fiançailles",
    title: ["Une carte", "pour chaque", "invité."],
    text: "Une carte à votre image, envoyée à chaque invité sur WhatsApp avec son nom et son QR code.",
    caption: { kicker: "Cartes nominatives", title: "Mariage" },
    photo: P("mariage", "70% center"),
    alt: "Réception de mariage en plein air au crépuscule, guirlandes lumineuses et tables fleuries",
  },
  {
    id: "dot",
    page: "dot",
    kicker: "Coutumes et familles",
    title: ["Deux familles,", "une seule", "liste."],
    text: "Des cartes aux motifs wax ou kente, et les réponses des deux familles suivies en direct.",
    caption: { kicker: "Tradition", title: "Dot" },
    photo: P("dot", "50% center"),
    alt: "Cérémonie de dot : couple en tenue traditionnelle entouré des familles",
  },
  {
    id: "anniversaire",
    page: "anniversaire",
    kicker: "Soirées et anniversaires",
    title: ["Pas encore", "de réponse ?", "On relance."],
    text: "Here! relance sur WhatsApp les invités qui n'ont pas encore répondu, aux dates que vous choisissez.",
    caption: { kicker: "Soirées", title: "Anniversaire" },
    photo: P("anniversaire", "60% center"),
    alt: "Anniversaire chic sur un rooftop au crépuscule, coupes de champagne",
  },
  {
    id: "seminaire",
    page: "seminaire",
    kicker: "Masterclass et séminaires",
    title: ["De la liste", "Excel aux", "invitations."],
    text: "Importez votre fichier Excel : chaque participant reçoit une invitation nominative, scannée à l'entrée de la salle.",
    caption: { kicker: "Entreprises et formations", title: "Séminaire" },
    photo: P("seminaire", "50% center"),
    alt: "Séminaire dans un auditorium moderne, graphiques sur grand écran",
  },
  {
    id: "concert",
    page: "concert",
    kicker: "Scènes privées et concerts",
    title: ["Un QR code", "vérifié", "à l'entrée."],
    text: "Chaque invitation porte son propre QR code, vérifié par vos agents à l'entrée, même dans une grande salle.",
    caption: { kicker: "Scène", title: "Concert" },
    photo: P("concert", "55% center"),
    alt: "Concert dans une grande salle, faisceaux de lumière rouge et dorée",
  },
];

/** Inclinaison des deux cartes de derrière (milieu, fond) pour chaque diapositive. */
const DECK = [
  [0.8, -1.0],
  [-1.2, 1.1],
  [1.0, -0.9],
  [-0.9, 1.3],
  [1.2, -1.1],
  [-0.8, 0.9],
];

const SWIPE_PX = 60; // glissement qui fait changer de carte
const DRAG_START_PX = 6; // en deçà, c'est un clic
const NAV = ["Événements", "Invités", "Relances", "Accès"];

const pad = (n: number) => String(n).padStart(2, "0");
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ease = "ease-[cubic-bezier(0.16,1,0.3,1)]";

/** Photo de l'événement, grande, à droite de la page ; au survol du paquet elle grandit et pivote un peu. */
function EventPhoto({ slide, active }: { slide: Slide; active: boolean }) {
  return (
    <div
      className={`relative hidden h-full min-h-0 w-[50%] shrink-0 overflow-hidden rounded-2xl border border-red/45 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.85)] transition-[translate,scale,rotate] duration-700 ${ease} group-hover/deck:scale-[1.04] group-hover/deck:rotate-[1.5deg] motion-reduce:transition-none lg:block ${
        active ? "translate-y-0" : "translate-y-4"
      }`}
    >
      <Image
        src={slide.photo.src}
        alt={slide.alt}
        fill
        sizes="(min-width: 1024px) 30vw, 1px"
        draggable={false}
        className={`object-cover transition-transform duration-[1200ms] ${ease} group-hover/deck:scale-110 motion-reduce:transition-none`}
        style={{ objectPosition: slide.photo.position ?? "center" }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
    </div>
  );
}

export function EventShowcase() {
  const total = SLIDES.length;
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  // Glissement en cours : point de départ, et s'il a dépassé le seuil d'un clic.
  const drag = useRef<{ x: number; id: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const go = (next: number) => setIndex((next + total) % total);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") go(index + 1);
    else if (event.key === "ArrowLeft") go(index - 1);
    else return;
    event.preventDefault();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, id: event.pointerId, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    if (!d.moved && Math.abs(dx) < DRAG_START_PX) return;
    if (!d.moved) {
      d.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDragX(dx);
  };
  const endDrag = (event: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    const dx = event.clientX - d.x;
    suppressClick.current = true; // le clic qui suit un glissement ne suit pas le lien
    setDragX(0);
    if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? index + 1 : index - 1);
  };

  const slide = SLIDES[index];
  const [middle, backmost] = DECK[index % DECK.length];
  const dragging = dragX !== 0;

  return (
    <section aria-roledescription="carrousel" aria-label="Événements organisés avec Here!" onKeyDown={onKeyDown} className="flex min-h-0 flex-1 flex-col">
      {/* Paquet : au survol, les cartes de derrière s'écartent. On avance avec le glissement, les flèches ou les points. */}
      <div className="group/deck relative flex min-h-0 flex-1 items-end justify-center pt-4">
        <div
          aria-hidden="true"
          style={{ "--r": `${backmost}deg` } as React.CSSProperties}
          className={`absolute top-0 bottom-[10%] w-[86%] rotate-[var(--r)] rounded-[36px] border border-red/15 bg-[color-mix(in_srgb,var(--color-red)_8%,var(--color-ink))] opacity-60 shadow-2xl transition-[rotate,translate,opacity] duration-700 ${ease} group-hover/deck:-translate-x-6 group-hover/deck:-translate-y-8 group-hover/deck:rotate-[calc(var(--r)*5)] group-hover/deck:opacity-90 motion-reduce:transition-none`}
        />
        <div
          aria-hidden="true"
          style={{ "--r": `${middle}deg` } as React.CSSProperties}
          className={`absolute top-2 bottom-[6%] w-[93%] rotate-[var(--r)] rounded-[36px] border border-red/20 bg-[color-mix(in_srgb,var(--color-red)_12%,var(--color-ink))] opacity-85 shadow-2xl transition-[rotate,translate,opacity] duration-700 ${ease} group-hover/deck:translate-x-4 group-hover/deck:-translate-y-4 group-hover/deck:rotate-[calc(var(--r)*3.5)] group-hover/deck:opacity-100 motion-reduce:transition-none`}
        />

        {/* Carte de devant : se glisse à gauche ou à droite ; elle ne change pas de carte au clic. */}
        <div
          onClick={(event) => {
            event.stopPropagation();
            if (suppressClick.current) {
              suppressClick.current = false;
              event.preventDefault();
            }
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={dragging ? { translate: `${dragX}px 0`, rotate: `${dragX / 45}deg` } : undefined}
          className={`relative flex h-[calc(100%-24px)] w-full touch-pan-y flex-col rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_48%_38%,rgba(225,6,0,0.30),rgba(120,16,10,0.26)_48%,rgba(12,10,10,0.98)_80%)] p-3 shadow-[0_35px_80px_-15px_rgba(0,0,0,0.9)] select-none xl:p-4 ${
            dragging
              ? "cursor-grabbing"
              : `cursor-grab transition-[translate,rotate,box-shadow,scale] duration-500 ${ease} group-hover/deck:-translate-y-1 group-hover/deck:scale-[1.015] group-hover/deck:shadow-[0_50px_100px_-15px_rgba(225,6,0,0.45)] motion-reduce:transition-none`
          }`}
        >
          {/* Fenêtre de navigateur */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] border border-white/10 bg-ink">
            <div className="relative flex items-center justify-between border-b border-white/[0.07] bg-ink/85 px-5 py-3">
              <div aria-hidden="true" className="flex gap-2">
                <span className="size-3 rounded-full bg-red" />
                <span className="size-3 rounded-full bg-white/20" />
                <span className="size-3 rounded-full bg-white/20" />
              </div>
              <div className="flex min-w-[170px] items-center justify-center gap-1.5 rounded-full border border-white/10 bg-ink-800 px-4 py-1 font-mono text-[11px] tracking-wide text-white/50">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3" {...stroke}>
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <span key={slide.page} className="here-fade">
                  here!/{slide.page}
                </span>
              </div>
              <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/45">
                {pad(index + 1)} / {pad(total)}
              </span>
            </div>

            <div aria-hidden="true" className="relative flex items-center justify-between border-b border-white/[0.03] px-7 py-3 text-[11px] text-white/60">
              <Image src="/brand/logo-negatif.svg" alt="" width={72} height={31} draggable={false} className="h-auto w-[64px]" />
              <div className="hidden items-center gap-6 2xl:flex">
                {NAV.map((item, i) => (
                  <span key={item} className={`flex items-center gap-2 ${i === 0 ? "font-semibold text-white" : ""}`}>
                    {i === 0 && <span className="size-1.5 rounded-sm bg-red" />}
                    {item}
                  </span>
                ))}
              </div>
              <span className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                <svg viewBox="0 0 24 24" className="size-3.5" {...stroke}>
                  <circle cx="12" cy="8" r="4" />
                  <path d="M5 21a7 7 0 0 1 14 0" />
                </svg>
              </span>
            </div>

            {/* Diapositives superposées : la courante apparaît, les autres s'effacent du côté où elles sont parties. */}
            <div className="relative min-h-0 flex-1" aria-live="polite">
              {SLIDES.map((s, i) => {
                const active = i === index;
                const side = i < index ? "-translate-x-6" : "translate-x-6";
                return (
                  <div
                    key={s.id}
                    role="group"
                    aria-roledescription="diapositive"
                    aria-label={`${i + 1} sur ${total} : ${s.caption.title}`}
                    aria-hidden={!active}
                    inert={!active}
                    className={`absolute inset-0 flex flex-col px-7 pt-4 pb-6 transition-[opacity,translate,scale] duration-500 ${ease} motion-reduce:transition-none ${
                      active ? "opacity-100" : `pointer-events-none scale-[0.97] opacity-0 ${side}`
                    }`}
                  >
                    <span className="font-mono text-[10px] tracking-[0.24em] text-red-bright uppercase">{s.kicker}</span>
                    <div className="flex min-h-0 flex-1 items-stretch justify-between gap-6 pt-4">
                      <div className="flex max-w-[440px] flex-col justify-center">
                        <h3 className="font-heading text-[clamp(28px,min(3.1vw,5.2vh),54px)] leading-[0.95] font-black tracking-[-0.04em] text-white uppercase">
                          {s.title.map((line, n) => (
                            <span key={line} className={`block ${n === s.title.length - 1 ? "text-red" : ""}`}>
                              {line}
                            </span>
                          ))}
                        </h3>
                        <p className="mt-4 max-w-[360px] text-[13px] leading-[1.6] text-white/70">{s.text}</p>
                      </div>
                      <EventPhoto slide={s} active={active} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Légende de la carte, synchronisée avec la diapositive */}
          <div className="flex items-end justify-between px-4 pt-4 pb-1">
            <div key={slide.id} className="here-fade">
              <p className="font-mono text-[11px] font-semibold tracking-[0.25em] text-white/55 uppercase">{slide.caption.kicker}</p>
              <p className="font-heading text-[clamp(22px,2.2vw,30px)] font-extrabold tracking-tight text-white">{slide.caption.title}</p>
            </div>
            <div className="flex items-center gap-2 pb-2">
              {SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Afficher : ${s.caption.title}`}
                  aria-current={i === index}
                  onClick={() => go(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-bright ${
                    i === index ? "w-5 bg-red" : "w-1.5 bg-white/30 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Commandes sous le paquet */}
      <div className="mt-6 flex flex-col items-center gap-2 [@media(max-height:820px)]:mt-4">
        <div className="flex items-center gap-5">
          {[
            { label: "Diapositive précédente", step: -1, path: "M20 12H4M10 6l-6 6 6 6" },
            { label: "Diapositive suivante", step: 1, path: "M4 12h16M14 6l6 6-6 6" },
          ].map(({ label, step, path }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={() => go(index + step)}
              className={`flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/80 transition-all hover:border-red/60 hover:bg-red hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-bright ${
                step > 0 ? "order-3" : "order-1"
              }`}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" {...stroke}>
                <path d={path} />
              </svg>
            </button>
          ))}
          <p className="order-2 font-mono text-[12px] font-semibold tracking-wider text-white/45">
            <span className="text-white">{pad(index + 1)}</span> / {pad(total)}
          </p>
        </div>
        <p className="font-mono text-[11px] text-white/35 [@media(max-height:820px)]:hidden">Glissez la carte ou utilisez ← →</p>
      </div>
    </section>
  );
}
