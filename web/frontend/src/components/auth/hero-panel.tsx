import Image from "next/image";
import { Icon, type IconName } from "@/components/icons";

// Panneau de droite des écrans d'accès (écrans larges) : promesse Here!, quatre étapes, visuel de l'invitation
// et types d'événements. Purement décoratif pour la navigation : aucun lien, aucun état.

const STEPS: { icon: IconName; verb: string; object: string }[] = [
  { icon: "calendrier", verb: "Créez", object: "vos événements" },
  { icon: "participants", verb: "Invitez", object: "vos participants" },
  { icon: "qr-code", verb: "Gérez", object: "vos accès" },
  { icon: "statistiques", verb: "Suivez", object: "vos résultats" },
];

const EVENT_KINDS: { icon: IconName; label: string }[] = [
  { icon: "mariage", label: "Mariage" },
  { icon: "cadeau", label: "Dot" },
  { icon: "anniversaire", label: "Anniversaire" },
  { icon: "conference", label: "Séminaire" },
  { icon: "concert", label: "Concert" },
];

export function HeroPanel() {
  return (
    <aside
      aria-label="Here! en bref"
      className="here-fade sticky top-0 hidden h-dvh min-h-[600px] flex-col overflow-hidden bg-ink text-white lg:flex"
    >
      {/* Décor : voile rouge en haut à droite, halo doré derrière l'invitation. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-56 -right-40 size-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(225,6,0,0.75),rgba(225,6,0,0.18)_55%,transparent)] blur-2xl" />
        <div className="absolute -top-24 right-[-12%] h-[260px] w-[620px] rotate-[24deg] rounded-[50%] border-t-[28px] border-red/40 blur-md" />
        <div className="absolute bottom-[8%] left-1/2 h-[46%] w-[80%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(168,130,60,0.32),transparent)] blur-2xl" />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-12 pt-11 pb-9 xl:px-16 [@media(max-height:820px)]:pt-7 [@media(max-height:820px)]:pb-6">
        <Image src="/brand/logo-negatif.svg" alt="" width={150} height={64} className="h-auto w-[132px] xl:w-[150px] [@media(max-height:820px)]:w-[112px]" />

        <h2 className="mt-7 font-heading text-[clamp(36px,min(4.2vw,6.4vh),64px)] [@media(max-height:820px)]:mt-4 leading-[1.02] font-extrabold tracking-[-0.035em]">
          Donnez vie à
          <br />
          <span className="text-red">vos événements.</span>
        </h2>
        <p className="mt-5 max-w-[540px] text-[17px] [@media(max-height:820px)]:mt-3 [@media(max-height:820px)]:text-[15px] leading-[1.5] text-white/85">
          Cartes d&apos;invitation, envoi sur WhatsApp, relances et contrôle des entrées, le tout dans une seule plateforme.
        </p>

        <ul className="mt-9 grid max-w-[720px] grid-cols-4 [@media(max-height:820px)]:mt-5 divide-x divide-white/10">
          {STEPS.map((step) => (
            <li key={step.verb} className="flex flex-col items-center gap-3 px-2 text-center">
              <span className="flex size-[60px] [@media(max-height:820px)]:size-12 items-center justify-center rounded-[18px] border border-red/45 bg-white/[0.03] text-red-bright shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <Icon name={step.icon} width={26} height={26} />
              </span>
              <span className="text-[14px] leading-[1.3] font-semibold xl:text-[15px]">
                {step.verb}
                <br />
                {step.object}
              </span>
            </li>
          ))}
        </ul>

        <div className="relative my-4 min-h-[140px] flex-1">
          <Image
            src="/images/here-invitation-hero.png"
            alt="Carte d'invitation ivoire scellée du sceau Here!, enveloppe rouge, bougie, coupes de champagne et fleurs blanches"
            fill
            preload
            sizes="(min-width: 1024px) 55vw, 1px"
            className="here-float-in object-contain object-center drop-shadow-[0_30px_40px_rgba(0,0,0,0.55)]"
          />
        </div>

        <ul className="grid grid-cols-6 gap-3" aria-label="Types d'événements">
          {EVENT_KINDS.map((kind, index) => (
            <li
              key={kind.label}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-[16px] border px-1 py-3 [@media(max-height:820px)]:py-2 text-center text-[12px] font-medium xl:text-[13px] ${
                index === 0
                  ? "border-red/70 bg-red/25 shadow-[0_10px_30px_-8px_rgba(225,6,0,0.55)]"
                  : "border-white/10 bg-white/[0.04] text-white/85"
              }`}
            >
              <Icon name={kind.icon} width={24} height={24} />
              {kind.label}
            </li>
          ))}
          <li className="flex flex-col items-center justify-center gap-1.5 rounded-[16px] border border-white/10 bg-white/[0.04] px-1 py-3 [@media(max-height:820px)]:py-2 text-center text-[12px] font-medium text-white/85 xl:text-[13px]">
            <span aria-hidden="true" className="text-[18px] leading-6 tracking-[0.1em]">
              •••
            </span>
            Et plus
          </li>
        </ul>
      </div>
    </aside>
  );
}
