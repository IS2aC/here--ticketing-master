"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CreativeDocument } from "../../domain/document/types.ts";
import {
  createDocument,
  usePersistenceStore,
} from "../../editor/persistence.ts";
import {
  prepareFonts,
  prepareImages,
  type AssetUrlResolver,
} from "../../export/resources.ts";
import { renderDocumentToCanvas } from "../../rendering/konva/sceneBuilder.ts";
import { usePhotoPalette } from "../../ui/PropertiesPanel/usePhotoPalette.ts";
import type { GuestSample } from "../guestFields.ts";
import type { CardFacts, Charter } from "./charter.ts";
import {
  composeCard,
  loadComposition,
  prepareCharterFonts,
} from "./compose.ts";
import styles from "../HereCardEditor.module.css";

// Cartes proposées (étape C1) : trois chartes demandées à Here! (IA ou règles), composées et montrées ici ;
// celle qu'on choisit devient la carte de l'événement, entièrement modifiable.

interface Proposal {
  readonly charter: Charter;
  readonly document: CreativeDocument;
  readonly preview: string | null;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      source: "ia" | "regles";
      proposals: readonly Proposal[];
    };

const DIRECTION_LABELS: Record<Charter["direction"], string> = {
  classique: "Classique",
  moderne: "Moderne",
  audacieuse: "Audacieuse",
};

async function compose(
  charter: Charter,
  facts: CardFacts,
  sample: GuestSample,
  resolve: AssetUrlResolver,
): Promise<Proposal> {
  await prepareCharterFonts(charter);
  const document = composeCard(
    await loadComposition(charter.composition),
    charter,
    facts,
    sample,
  );
  // Aperçu : la scène d'export, en petit. Une image manquante n'empêche pas de proposer la carte.
  const [fonts, images] = await Promise.all([
    prepareFonts(document),
    prepareImages(document, resolve),
  ]);
  let preview: string | null = null;
  if (fonts.ok && images.ok) {
    const canvas = renderDocumentToCanvas(document, images.value, {
      pixelRatio: 0.4,
      bleedPx: 0,
      background: "page",
    });
    preview = canvas.toDataURL("image/jpeg", 0.85);
  }
  return { charter, document, preview };
}

export function ProposalsPanel({
  baseUrl,
  sample,
  resolveAsset,
  onClose,
}: {
  baseUrl: string;
  sample: GuestSample;
  resolveAsset: AssetUrlResolver;
  onClose: () => void;
}) {
  const photoColors = usePhotoPalette(6);
  // Couleurs des photos au moment de la demande : elles ne relancent pas la demande quand elles arrivent.
  const colors = useRef(photoColors);
  useEffect(() => {
    colors.current = photoColors;
  }, [photoColors]);
  const [state, setState] = useState<State>({ status: "loading" });
  const [round, setRound] = useState(0);
  const [using, setUsing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (isActive: () => boolean) => {
      try {
        const response = await fetch(`${baseUrl}/propositions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoColors: colors.current }),
        });
        if (!response.ok) throw new Error(String(response.status));
        const result = (await response.json()) as {
          source: "ia" | "regles";
          facts: CardFacts;
          proposals: Charter[];
        };
        const proposals = await Promise.all(
          result.proposals.map((c) =>
            compose(c, result.facts, sample, resolveAsset),
          ),
        );
        if (isActive())
          setState({ status: "ready", source: result.source, proposals });
      } catch {
        if (isActive())
          setState({
            status: "error",
            message:
              "Les propositions n'ont pas pu être préparées. Réessayez dans un instant.",
          });
      }
    },
    [baseUrl, sample, resolveAsset],
  );

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => {
      active = false;
    };
  }, [load, round]);

  async function use(proposal: Proposal) {
    setUsing(proposal.document.id);
    setNotice(null);
    await createDocument(proposal.document);
    if (usePersistenceStore.getState().documentId === proposal.document.id) {
      onClose();
      return;
    }
    setUsing(null);
    setNotice(
      usePersistenceStore.getState().openError?.message ??
        "La carte n'a pas pu être ouverte. Réessayez.",
    );
  }

  return (
    <div
      className={styles.proposalsBackdrop}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={styles.proposals}
        role="dialog"
        aria-modal="true"
        aria-labelledby="proposals-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.qrHeader}>
          <div>
            <h2 id="proposals-title" className={styles.proposalsTitle}>
              Cartes proposées pour votre événement
            </h2>
            <p className={styles.proposalsLead}>
              {state.status === "ready" && state.source === "ia"
                ? "Composées par l'IA à partir de votre événement. La date, le lieu et le nom de chaque invité viennent de Here!."
                : "Trois directions pour votre carte. La date, le lieu et le nom de chaque invité viennent de Here!."}
            </p>
          </div>
          <button type="button" className={styles.qrClose} onClick={onClose}>
            Fermer
          </button>
        </div>

        {state.status === "loading" && (
          <p className={styles.proposalsStatus} role="status">
            Composition des cartes…
          </p>
        )}
        {state.status === "error" && (
          <p className={styles.proposalsStatus} role="alert">
            {state.message}
          </p>
        )}
        {state.status === "ready" && (
          <ul className={styles.proposalsGrid}>
            {state.proposals.map((proposal) => (
              <li key={proposal.document.id} className={styles.proposal}>
                {proposal.preview ? (
                  <img
                    src={proposal.preview}
                    alt={`Aperçu de la carte « ${proposal.charter.name} »`}
                    className={styles.proposalImage}
                  />
                ) : (
                  <div className={styles.proposalImage} aria-hidden="true" />
                )}
                <div className={styles.proposalMeta}>
                  <span className={styles.proposalName}>
                    {proposal.charter.name}
                  </span>
                  <span className={styles.proposalDirection}>
                    {DIRECTION_LABELS[proposal.charter.direction]}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.proposalUse}
                  disabled={using !== null}
                  onClick={() => void use(proposal)}
                >
                  {using === proposal.document.id
                    ? "Ouverture…"
                    : "Utiliser cette carte"}
                </button>
              </li>
            ))}
          </ul>
        )}

        {notice && (
          <p className={styles.proposalsStatus} role="alert">
            {notice}
          </p>
        )}
        <div className={styles.proposalsFooter}>
          <p className={styles.qrNote}>
            Utiliser une carte remplace la carte en cours. Tout reste modifiable
            ensuite.
          </p>
          {state.status === "ready" && state.source === "ia" && (
            <button
              type="button"
              className={styles.proposalsAgain}
              disabled={using !== null}
              onClick={() => {
                setState({ status: "loading" });
                setRound((r) => r + 1);
              }}
            >
              Proposer d'autres cartes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
