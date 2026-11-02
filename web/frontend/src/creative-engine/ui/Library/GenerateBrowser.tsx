import { useEffect, useId, useState } from "react";
import {
  buildCardPrompt,
  EVENT_TYPES,
  hasEventTexts,
  promptTexts,
  type EventType,
} from "../../editor/cardPrompt.ts";
import { useDocumentStore } from "../../editor/documentStore.ts";
import { useEditorStore } from "../../editor/editorStore.ts";
import {
  cancelGeneration,
  generateImages,
  insertSelectedResult,
  loadCapabilities,
  selectResult,
  updateEventInfo,
  useImageGenerationStore,
} from "../../editor/imageGeneration.ts";
import type { ImagePlacement } from "../../editor/actions.ts";
import { RETRYABLE_CODES } from "../../integrations/ai/contract.ts";
import { Segmented } from "../primitives/Segmented.tsx";
import styles from "./Library.module.css";

/** « 1024x1536 » (pixels) ou « 4:5 » (ratio, Gemini) → proportions. */
function proportions(size: string): { w: number; h: number; ratio: boolean } {
  const ratio = size.includes(":");
  const [w = 1, h = 1] = size.split(ratio ? ":" : "x").map(Number);
  return { w, h, ratio };
}

function shapeOf(size: string): string {
  const { w, h } = proportions(size);
  return w === h ? "Carré" : w < h ? "Portrait" : "Paysage";
}

/** Usage courant des ratios proposés, pour aider à choisir. */
const RATIO_USES: Readonly<Record<string, string>> = {
  "4:5": "publication WhatsApp ou Instagram",
  "1:1": "publication carrée",
  "9:16": "story",
  "3:4": "proche des formats A5 et A4 à imprimer",
  "2:3": "proche des formats A5 et A4 à imprimer",
  "3:2": "paysage",
  "16:9": "écran, bannière",
};

/** Libellés courts : le ratio tel quel ; en pixels, la forme (« Portrait ») ou les dimensions si ambiguë. */
function sizeLabels(sizes: readonly string[]): Record<string, string> {
  const shapes = sizes.map(shapeOf);
  const unique = new Set(shapes).size === shapes.length;
  return Object.fromEntries(
    sizes.map((s, i) => [s, proportions(s).ratio ? s : unique ? (shapes[i] ?? s) : s.replace("x", " × ")]),
  );
}

function sizeHint(size: string): string {
  if (!proportions(size).ratio) return `${size.replace("x", " × ")} px`;
  const use = RATIO_USES[size];
  return `${shapeOf(size)}${use ? ` · ${use}` : ""}`;
}

/** Format proposé par défaut : le plus proche des proportions de la page ouverte. */
function closestSize(sizes: readonly string[], page: { width: number; height: number }): string {
  const target = Math.log(page.width / page.height);
  let best = sizes[0] ?? "";
  for (const size of sizes) {
    const { w, h } = proportions(size);
    const { w: bw, h: bh } = proportions(best);
    if (Math.abs(Math.log(w / h) - target) < Math.abs(Math.log(bw / bh) - target)) best = size;
  }
  return best;
}

/** Génération d'images : description, réglages réellement proposés par le serveur, résultats, insertion. */
export function GenerateBrowser() {
  const capabilities = useImageGenerationStore((s) => s.capabilities);
  const capabilitiesError = useImageGenerationStore((s) => s.capabilitiesError);
  const status = useImageGenerationStore((s) => s.status);
  const error = useImageGenerationStore((s) => s.error);
  const results = useImageGenerationStore((s) => s.results);
  const selectedId = useImageGenerationStore((s) => s.selectedId);
  const inserting = useImageGenerationStore((s) => s.inserting);
  const eventInfo = useImageGenerationStore((s) => s.eventInfo);
  const setNotice = useEditorStore((s) => s.setNotice);
  const promptId = useId();
  // La description est gardée tant que le panneau reste ouvert, même après une génération.
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  // Par défaut, une image sans texte : les informations de l'événement restent des textes modifiables.
  const [noText, setNoText] = useState(true);
  const document = useDocumentStore((s) => s.history.present);
  const pageWidth = document.page.width;
  const pageHeight = document.page.height;
  // « card » : l'IA dessine la carte entière à partir de son contenu (décision de l'utilisateur) ;
  // « image » : un fond ou une illustration, décrits librement.
  const [mode, setMode] = useState<"card" | "image">("card");
  const [style, setStyle] = useState("");
  const [reserveGuestZone, setReserveGuestZone] = useState(true);
  const [insertError, setInsertError] = useState<string | null>(null);

  useEffect(() => {
    if (!useImageGenerationStore.getState().capabilities) void loadCapabilities();
  }, []);

  if (capabilitiesError) {
    return (
      <div className={styles.browser}>
        <div className={styles.state} role="alert">
          <p>{capabilitiesError.message}</p>
          <button type="button" className={styles.textButton} onClick={() => void loadCapabilities()}>
            Réessayer
          </button>
        </div>
      </div>
    );
  }
  if (!capabilities) {
    return (
      <div className={styles.browser}>
        <p className={styles.state} aria-live="polite">
          Vérification du service de génération…
        </p>
      </div>
    );
  }
  if (!capabilities.enabled) {
    return (
      <div className={styles.browser}>
        <div className={styles.notConfigured}>
          <p>
            <strong>La génération d'images n'est pas disponible sur ce serveur.</strong>
          </p>
          <p>
            Elle s'active côté serveur, avec un fournisseur d'images et sa clé, sans que la clé ne soit jamais
            envoyée au navigateur. Vous pouvez en attendant importer vos images ou utiliser les ornements.
          </p>
        </div>
      </div>
    );
  }

  const generating = status === "generating";
  const chosenSize =
    size && capabilities.sizes.includes(size)
      ? size
      : closestSize(capabilities.sizes, { width: pageWidth, height: pageHeight });
  const isCard = mode === "card";
  const fromEvent = hasEventTexts(eventInfo);
  const texts = promptTexts(document, eventInfo);
  const cardPrompt = buildCardPrompt(document, { style, reserveGuestZone, event: eventInfo });
  const hostsLabel =
    eventInfo.type === "seminaire" || eventInfo.type === "reunion"
      ? "Titre de l'événement"
      : eventInfo.type === "bapteme"
        ? "Prénom de l'enfant"
        : eventInfo.type === "anniversaire"
          ? "Prénom et âge"
          : "Prénoms des mariés ou des hôtes";
  const run = () => {
    setInsertError(null);
    void generateImages(
      isCard
        ? { prompt: cardPrompt, size: chosenSize, count, noText: false }
        : { prompt, size: chosenSize, count, noText },
    );
  };
  const insert = async (placement: ImagePlacement) => {
    setInsertError(null);
    const failure = await insertSelectedResult(placement);
    if (failure) setInsertError(failure.message);
    else
      setNotice({
        tone: "info",
        message: {
          card: "La carte générée remplace la composition : les éléments d'origine sont masqués (Ctrl + Z pour revenir).",
          background: "Image placée en fond de la carte, sous les textes. Elle reste dans vos images.",
          centered: "Image ajoutée au document et à vos images.",
        }[placement],
      });
  };

  return (
    <div className={styles.browser}>
      <Segmented
        label="Que générer ?"
        value={mode}
        options={[
          { value: "card", label: "Carte complète" },
          { value: "image", label: "Fond ou illustration" },
        ]}
        disabled={generating}
        onChange={setMode}
      />

      {isCard ? (
        <>
          <p className={styles.intro}>
            L'IA crée la carte entière à partir de son contenu : textes, polices, couleurs et format. Rien ne
            change sur la carte sans votre choix.
          </p>
          <fieldset className={styles.eventForm} disabled={generating}>
            <legend>Informations de l'événement</legend>
            <label className={styles.eventField}>
              <span>Type d'événement</span>
              <select
                value={eventInfo.type ?? ""}
                onChange={(event) => {
                  updateEventInfo({
                    type: event.target.value === "" ? null : (event.target.value as EventType),
                  });
                }}
              >
                <option value="">Non précisé</option>
                {(Object.keys(EVENT_TYPES) as EventType[]).map((type) => (
                  <option key={type} value={type}>
                    {EVENT_TYPES[type]}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["hosts", hostsLabel, "Aïcha & Koffi"],
                ["invitation", "Formule d'invitation", "vous invitent à célébrer leur union"],
                ["date", "Date", "Samedi 12 décembre 2026"],
                ["time", "Heure", "15 h"],
                ["place", "Lieu", "Église Saint-Paul du Plateau, Abidjan"],
                ["note", "Mention (réponse, tenue…)", "Merci de confirmer avant le 1er décembre"],
              ] as const
            ).map(([field, label, placeholder]) => (
              <label key={field} className={styles.eventField}>
                <span>{label}</span>
                <input
                  type="text"
                  maxLength={200}
                  placeholder={placeholder}
                  value={eventInfo[field]}
                  onChange={(event) => {
                    updateEventInfo({ [field]: event.target.value });
                  }}
                />
              </label>
            ))}
            <p className={styles.checkHint}>
              {fromEvent
                ? "L'IA écrira ces informations, avec les polices choisies sur la carte."
                : "Laissés vides, ce sont les textes déjà posés sur la carte que l'IA reprend."}
            </p>
          </fieldset>

          {texts.length > 0 ? (
            <div className={styles.cardContent}>
              <p className={styles.cardContentTitle}>
                {fromEvent ? "Textes que l'IA écrira" : "Textes repris de la carte"}
              </p>
              <ul>
                {texts.map((text, index) => (
                  <li key={`${index}-${text.content}`}>
                    <span className={styles.cardText}>{text.content}</span>
                    <span className={styles.checkHint}>
                      {text.role ? `${text.role} · ` : ""}
                      {text.font}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className={styles.notConfigured}>
              Aucun texte : renseignez les informations de l'événement, partez d'un modèle ou ajoutez vos
              textes sur la carte.
            </p>
          )}
          <label className={styles.promptField} htmlFor={promptId}>
            <span>Ambiance et style (facultatif)</span>
            <textarea
              id={promptId}
              className={styles.prompt}
              rows={3}
              maxLength={600}
              placeholder="Élégant et lumineux, aquarelle de fleurs blanches et feuillage doré"
              value={style}
              onChange={(event) => {
                setStyle(event.target.value);
              }}
            />
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={reserveGuestZone}
              disabled={generating}
              onChange={(event) => {
                setReserveGuestZone(event.target.checked);
              }}
            />
            <span>
              Réserver une zone pour le QR code et le nom de l'invité
              <span className={styles.checkHint}>
                Une bande libre en bas de la carte, remplie ensuite par Here!.
              </span>
            </span>
          </label>
          <p className={styles.hint}>
            L'IA dessine les textes : vérifiez l'orthographe sur l'aperçu avant de valider. Pour corriger,
            modifiez le texte sur la carte puis générez à nouveau. Modèle « {capabilities.model} ».
          </p>
          <details className={styles.promptPreview}>
            <summary>Voir la consigne envoyée à l'IA</summary>
            <pre>{cardPrompt}</pre>
          </details>
        </>
      ) : (
        <>
          <p className={styles.intro}>
            Décrivez l'image souhaitée : sujet, style, couleurs. Rien n'est ajouté au document sans votre
            choix.
          </p>
          <label className={styles.promptField} htmlFor={promptId}>
            <span>Description</span>
            <textarea
              id={promptId}
              className={styles.prompt}
              rows={4}
              maxLength={capabilities.maxPromptLength}
              placeholder="Couronne de fleurs blanches et feuillage doré, aquarelle, fond crème"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !generating) run();
              }}
            />
            <span className={styles.counter}>
              {prompt.length} / {capabilities.maxPromptLength}
            </span>
          </label>
          <p className={styles.hint}>
            Modèle « {capabilities.model} ». Selon le modèle, une description en anglais peut donner de
            meilleurs résultats.
          </p>
        </>
      )}

      {capabilities.sizes.length > 1 && (
        <>
          <Segmented
            label="Format"
            value={chosenSize}
            options={capabilities.sizes.map((s) => ({
              value: s,
              label: sizeLabels(capabilities.sizes)[s] ?? s,
            }))}
            disabled={generating}
            onChange={setSize}
          />
          <p className={styles.hint}>{sizeHint(chosenSize)}</p>
        </>
      )}
      {capabilities.maxImages > 1 && (
        <Segmented
          label="Nombre d'images"
          value={String(count)}
          options={Array.from({ length: capabilities.maxImages }, (_, i) => ({
            value: String(i + 1),
            label: String(i + 1),
          }))}
          disabled={generating}
          onChange={(value) => {
            setCount(Number(value));
          }}
        />
      )}

      {!isCard && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={noText}
            disabled={generating}
            onChange={(event) => {
              setNoText(event.target.checked);
            }}
          />
          <span>
            Sans texte dans l'image (recommandé)
            <span className={styles.checkHint}>
              Les noms, dates et lieux restent des textes modifiables de la carte.
            </span>
          </span>
        </label>
      )}

      <div className={styles.generateActions}>
        <button type="button" className={styles.importButton} disabled={generating} onClick={run}>
          {generating ? "Génération en cours…" : results.length > 0 ? "Générer à nouveau" : "Générer"}
        </button>
        {generating && (
          <button type="button" className={styles.secondary} onClick={cancelGeneration}>
            Annuler
          </button>
        )}
      </div>

      <div className={styles.results} aria-live="polite" aria-busy={generating}>
        {generating && (
          <p className={styles.state}>
            <span className={styles.spinner} aria-hidden="true" /> Génération en cours. Cela peut prendre
            jusqu'à quelques minutes.
          </p>
        )}
        {status === "cancelled" && <p className={styles.count}>Génération annulée.</p>}
        {error && (
          <div className={styles.inlineError} role="alert">
            <p>
              {error.message}
              {error.retryAfterSeconds ? ` (environ ${error.retryAfterSeconds} s)` : ""}
            </p>
            {RETRYABLE_CODES.has(error.code) && !generating && (
              <button type="button" className={styles.textButton} onClick={run}>
                Réessayer
              </button>
            )}
          </div>
        )}

        {results.length > 0 && (
          <>
            <p className={styles.count}>
              {results.length === 1 ? "1 image générée" : `${results.length} images générées`} — choisissez
              celle à ajouter.
            </p>
            <ul className={styles.resultGrid}>
              {results.map((result, index) => (
                <li key={result.id}>
                  <button
                    type="button"
                    className={styles.resultTile}
                    aria-pressed={selectedId === result.id}
                    aria-label={`Image ${index + 1} sur ${results.length}`}
                    onClick={() => {
                      selectResult(selectedId === result.id ? null : result.id);
                    }}
                  >
                    <img src={result.previewUrl} alt="" />
                  </button>
                </li>
              ))}
            </ul>
            {insertError && (
              <p className={styles.inlineError} role="alert">
                {insertError}
              </p>
            )}
            <div className={styles.insertActions}>
              <button
                type="button"
                className={styles.primary}
                disabled={!selectedId || inserting}
                onClick={() => void insert(isCard ? "card" : "background")}
              >
                {inserting ? "Ajout…" : isCard ? "Utiliser cette carte" : "Utiliser comme fond de la carte"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={!selectedId || inserting}
                onClick={() => void insert("centered")}
              >
                Ajouter comme image
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
