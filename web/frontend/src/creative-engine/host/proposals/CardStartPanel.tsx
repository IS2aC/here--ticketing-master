"use client";

import { useEffect, useState } from "react";
import type { CreativeDocument } from "../../domain/document/types.ts";
import { importAsDocumentAsset } from "../../editor/library.ts";
import { createDocument, usePersistenceStore } from "../../editor/persistence.ts";
import catalog from "../../library/bundled/catalog.json";
import { Icon } from "../../ui/icons/Icon.tsx";
import type { GuestSample } from "../guestFields.ts";
import { composeOnImage } from "./aiCard.ts";
import { COMPOSITIONS, type CardFacts, type Composition } from "./charter.ts";
import { charterOf, composeCard, loadComposition, prepareCharterFonts } from "./compose.ts";
import styles from "../HereCardEditor.module.css";

// Ouverture de la carte (lot D2) : deux choix. « Créer avec l'IA » d'abord (l'IA fait gagner du temps) :
// la demande de l'organisateur, enrichie des données de l'événement, devient une illustration sur laquelle le
// moteur pose les textes exacts. Sinon, « Modèles Here! » (gratuits), remplis avec les données de l'événement.

export type StartTab = "ia" | "modeles";

/** Exemples de demandes, selon le type d'événement. */
const IDEAS: Record<string, readonly string[]> = {
  mariage: ["Fleurs blanches et feuillage doré, très élégant", "Pagne kente et or, chic et africain", "Aquarelle de roses poudrées"],
  dot: ["Motifs wax colorés et calebasses dorées", "Tissu kita, ambiance royale", "Bogolan et bronze, sobre"],
  bapteme: ["Nuages pastel et petites étoiles", "Couronne de fleurs tendres", "Colombe et rameaux d'olivier"],
  funerailles: ["Lys blancs, ambiance sereine et sobre", "Ciel au lever du jour, paisible", "Bougies et feuillage, tons doux"],
  anniversaire: ["Ballons dorés et confettis", "Soirée tropicale, feuilles de palmier", "Néons colorés, ambiance club"],
  seminaire: ["Lignes abstraites bleu nuit, moderne", "Skyline d'Abidjan, épuré", "Formes géométriques, professionnel"],
  festival: ["Scène sous les projecteurs, couleurs vives", "Affiche rétro des années 70", "Graffiti urbain d'Abidjan"],
};

const TEMPLATES = COMPOSITIONS.map((id) => {
  const entry = catalog.find((c) => c.id === id);
  return { id, name: entry?.name ?? id, description: entry?.description ?? "" };
});

/** Le document choisi devient la carte de l'événement. Renvoie un message d'erreur, ou null. */
async function open(document: CreativeDocument): Promise<string | null> {
  await createDocument(document);
  if (usePersistenceStore.getState().documentId === document.id) return null;
  return usePersistenceStore.getState().openError?.message ?? "La carte n'a pas pu être ouverte. Réessayez.";
}

function fromBase64(data: string, type: string): File {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new File([bytes], `Carte IA.${type.split("/")[1] ?? "png"}`, { type });
}

export function CardStartPanel({
  baseUrl,
  facts,
  sample,
  initialTab,
  onClose,
  onProposals,
}: {
  baseUrl: string;
  facts: CardFacts;
  sample: GuestSample;
  initialTab: StartTab;
  onClose: () => void;
  onProposals: () => void;
}) {
  const [tab, setTab] = useState<StartTab>(initialTab);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const ideas = IDEAS[facts.type] ?? IDEAS.mariage ?? [];

  useEffect(() => {
    let active = true;
    void fetch("/api/image-generation/capabilities")
      .then((r) => (r.ok ? (r.json() as Promise<{ enabled: boolean }>) : { enabled: false }))
      .catch(() => ({ enabled: false }))
      .then((c) => {
        if (active) setAiEnabled(c.enabled);
      });
    return () => {
      active = false;
    };
  }, []);

  async function generate() {
    setBusy("ia");
    setNotice(null);
    try {
      const response = await fetch(`${baseUrl}/generer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const body = (await response.json()) as {
        images?: { mimeType: string; data: string }[];
        error?: { message?: string };
      };
      const image = body.images?.[0];
      if (!response.ok || !image) throw new Error(body.error?.message ?? "La génération a échoué. Réessayez.");
      const imported = await importAsDocumentAsset(fromBase64(image.data, image.mimeType), "ai");
      if (!imported.ok) throw new Error(imported.error.message);
      const error = await open(composeOnImage(imported.asset, facts, sample));
      if (error) throw new Error(error);
      onClose();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "La génération a échoué. Réessayez.");
      setBusy(null);
    }
  }

  async function applyTemplate(id: Composition) {
    setBusy(id);
    setNotice(null);
    try {
      const template = await loadComposition(id);
      const charter = charterOf(template, id, facts);
      await prepareCharterFonts(charter);
      const error = await open(composeCard(template, charter, facts, sample));
      if (error) throw new Error(error);
      onClose();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Ce modèle n'a pas pu être ouvert. Réessayez.");
      setBusy(null);
    }
  }

  return (
    <div className={styles.proposalsBackdrop} role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className={styles.proposals}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.qrHeader}>
          <div>
            <h2 id="start-title" className={styles.proposalsTitle}>
              Votre carte d&apos;invitation
            </h2>
            <p className={styles.proposalsLead}>
              Le nom de chaque invité, sa table et son QR code sont ajoutés par Here! : vous n&apos;avez rien à placer.
            </p>
          </div>
          <button type="button" className={styles.qrClose} onClick={onClose} disabled={busy !== null}>
            Fermer
          </button>
        </div>

        <div className={styles.startTabs} role="tablist" aria-label="Façon de créer la carte">
          <button type="button" role="tab" aria-selected={tab === "ia"} className={styles.startTab} onClick={() => setTab("ia")}>
            <Icon name="sparkles" />
            Créer avec l&apos;IA
          </button>
          <button type="button" role="tab" aria-selected={tab === "modeles"} className={styles.startTab} onClick={() => setTab("modeles")}>
            <Icon name="template" />
            Modèles Here! <span className={styles.startFree}>gratuit</span>
          </button>
        </div>

        {tab === "ia" ? (
          <div className={styles.startBody} role="tabpanel" aria-label="Créer avec l'IA">
            <label htmlFor="start-prompt" className={styles.startLabel}>
              Décrivez la carte que vous imaginez
            </label>
            <textarea
              id="start-prompt"
              className={styles.startPrompt}
              rows={3}
              maxLength={600}
              value={prompt}
              placeholder={ideas[0] ? `Par exemple : ${ideas[0].toLowerCase()}` : "Ambiance, couleurs, motifs…"}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={busy !== null}
            />
            <div className={styles.startIdeas} aria-label="Idées">
              {ideas.map((idea) => (
                <button key={idea} type="button" className={styles.startIdea} onClick={() => setPrompt(idea)} disabled={busy !== null}>
                  {idea}
                </button>
              ))}
            </div>
            <p className={styles.qrNote}>
              Nous y ajoutons votre événement : {[facts.title, facts.dateLine, facts.theme, facts.colors.join(" ")].filter(Boolean).join(" · ")}.
            </p>
            {aiEnabled === false ? (
              <p className={styles.proposalsStatus} role="status">
                La génération par IA n&apos;est pas encore activée sur Here!. Choisissez un modèle, ou laissez Here! en proposer trois.
              </p>
            ) : null}
            <div className={styles.proposalsFooter}>
              <button type="button" className={styles.startLink} onClick={onProposals} disabled={busy !== null}>
                Pas d&apos;idée ? Trois cartes proposées pour votre événement
              </button>
              <button
                type="button"
                className={styles.proposalUse}
                disabled={busy !== null || aiEnabled === false || !prompt.trim()}
                onClick={() => void generate()}
              >
                {busy === "ia" ? "Génération de votre carte…" : "Générer ma carte"}
              </button>
            </div>
          </div>
        ) : (
          <ul className={styles.proposalsGrid} role="tabpanel" aria-label="Modèles Here!">
            {TEMPLATES.map((template) => (
              <li key={template.id} className={styles.proposal}>
                <img src={`/creative-engine/thumbnails/${template.id}.webp`} alt="" className={styles.proposalImage} />
                <div className={styles.proposalMeta}>
                  <span className={styles.proposalName}>{template.name}</span>
                </div>
                <button
                  type="button"
                  className={styles.proposalUse}
                  disabled={busy !== null}
                  onClick={() => void applyTemplate(template.id)}
                >
                  {busy === template.id ? "Préparation…" : "Utiliser ce modèle"}
                </button>
              </li>
            ))}
          </ul>
        )}

        {notice ? (
          <p className={styles.proposalsStatus} role="alert">
            {notice}
          </p>
        ) : null}
        {tab === "modeles" ? (
          <p className={styles.qrNote}>Le modèle est rempli avec les informations de votre événement. Tout reste modifiable.</p>
        ) : null}
      </div>
    </div>
  );
}
