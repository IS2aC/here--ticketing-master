"use client";

import { useEffect, useRef, useState } from "react";
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

/** Photo réduite avant l'envoi (1536 px au plus, JPEG) : rapide à envoyer, assez nette pour le modèle d'image. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1536 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Cette photo n'a pas pu être lue."))), "image/jpeg", 0.85),
  );
}

interface Photo {
  readonly blob: Blob;
  readonly url: string;
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
  const [maxPhotos, setMaxPhotos] = useState(0);
  const [photos, setPhotos] = useState<readonly Photo[]>([]);
  const photoInput = useRef<HTMLInputElement>(null);
  const ideas = IDEAS[facts.type] ?? IDEAS.mariage ?? [];

  useEffect(() => {
    let active = true;
    void fetch("/api/image-generation/capabilities")
      .then((r) => (r.ok ? (r.json() as Promise<{ enabled: boolean; maxReferences?: number }>) : { enabled: false }))
      .catch(() => ({ enabled: false, maxReferences: 0 }))
      .then((c) => {
        if (!active) return;
        setAiEnabled(c.enabled);
        setMaxPhotos(Math.min(4, ("maxReferences" in c ? c.maxReferences : 0) ?? 0));
      });
    return () => {
      active = false;
    };
  }, []);

  // Aperçus des photos : libérés quand elles sont retirées ou le panneau fermé.
  const urls = useRef<string[]>([]);
  useEffect(() => {
    urls.current = photos.map((p) => p.url);
  }, [photos]);
  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function addPhotos(files: FileList | null) {
    const chosen = [...(files ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, maxPhotos - photos.length);
    try {
      const added = await Promise.all(chosen.map(async (file) => {
        const blob = await shrink(file);
        return { blob, url: URL.createObjectURL(blob) };
      }));
      setPhotos((current) => [...current, ...added].slice(0, maxPhotos));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Cette photo n'a pas pu être lue.");
    }
  }

  function removePhoto(photo: Photo) {
    URL.revokeObjectURL(photo.url);
    setPhotos((current) => current.filter((p) => p !== photo));
  }

  async function generate() {
    setBusy("ia");
    setNotice(null);
    try {
      const form = new FormData();
      form.append("prompt", prompt);
      photos.forEach((photo, index) => form.append("photos", photo.blob, `photo-${index + 1}.jpg`));
      const response = await fetch(`${baseUrl}/generer`, { method: "POST", body: form });
      const body = (await response.json()) as {
        images?: { mimeType: string; data: string }[];
        error?: { message?: string };
      };
      const image = body.images?.[0];
      if (!response.ok || !image) throw new Error(body.error?.message ?? "La génération a échoué. Réessayez.");
      const imported = await importAsDocumentAsset(fromBase64(image.data, image.mimeType), "ai");
      if (!imported.ok) throw new Error(imported.error.message);
      const error = await open(composeOnImage(imported.asset, facts, sample, photos.length > 0 ? "photos" : "centre"));
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
            {maxPhotos > 0 ? (
              <div className={styles.startPhotos}>
                {photos.map((photo, index) => (
                  <span key={photo.url} className={styles.startPhoto}>
                    <img src={photo.url} alt={`Photo ${index + 1}`} />
                    <button type="button" aria-label={`Retirer la photo ${index + 1}`} onClick={() => removePhoto(photo)} disabled={busy !== null}>
                      <Icon name="close" size={16} />
                    </button>
                  </span>
                ))}
                {photos.length < maxPhotos ? (
                  <button type="button" className={styles.startAddPhoto} onClick={() => photoInput.current?.click()} disabled={busy !== null}>
                    <Icon name="image" />
                    {photos.length === 0 ? "Ajouter des photos (facultatif)" : "Ajouter"}
                  </button>
                ) : null}
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  onChange={(event) => {
                    void addPhotos(event.target.files);
                    event.target.value = "";
                  }}
                />
                <p className={styles.qrNote}>
                  Les mariés, la famille, l&apos;enfant… : l&apos;IA les représente sur la carte ({maxPhotos} photos au plus).
                </p>
              </div>
            ) : null}
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
