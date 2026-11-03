import { QR_SPOT, qrPosition } from "@/lib/card/layout";
import { addAsset } from "../domain/commands/documentCommands.ts";
import { addElement, moveElement, updateElement } from "../domain/commands/elementCommands.ts";
import { createDocument as createBlankDocument } from "../domain/document/factories.ts";
import type { CreativeDocument } from "../domain/document/types.ts";
import { createId } from "../domain/ids.ts";
import { configureImageGeneration } from "../editor/imageGeneration.ts";
import { configureGuestSlots } from "../editor/guestSlots.ts";
import { configureLibrary } from "../editor/library.ts";
import { currentDocument, useDocumentStore, type DocumentCommand } from "../editor/documentStore.ts";
import {
  configurePersistence,
  createDocument,
  hasPendingChanges,
  listDocuments,
  openDocument,
  saveNow,
} from "../editor/persistence.ts";
import { registerTextMeasurer } from "../editor/textMeasure.ts";
import { createHttpImageGenerator } from "../integrations/ai/httpImageGenerator.ts";
import { createBundledTemplateCatalog } from "../library/bundled/catalog.ts";
import { BUNDLED_ASSET_URLS, createBundledAssetLibrary } from "../library/bundled/ornaments.ts";
import { ok, type TemplateCatalog } from "../library/contracts.ts";
import { createDeviceImageLibrary } from "../library/deviceImages.ts";
import { createIndexedDbRepository } from "../persistence/indexedDbRepository.ts";
import { konvaTextMeasurer } from "../rendering/konva/measureText.ts";
import {
  createGuestName,
  createGuestQr,
  createGuestTable,
  GUEST_FONTS,
  hasGuestFields,
  SEAL_ASSET,
  SEAL_ASSET_KEY,
  sealInPlace,
  slotOf,
  type GuestSample,
} from "./guestFields.ts";
import { createHereRepository } from "./hereRepository.ts";

// Démarrage de l'éditeur dans Here! : stockage de la carte de l'événement (serveur + appareil), modèles au
// format de la carte, génération d'images par les routes de Here!, champs invité ajoutés à chaque carte.

/** Seuls les modèles au format de la carte WhatsApp (4:5) : tous les modèles intégrés, pas forcément ceux d'un autre catalogue. */
function cardTemplates(catalog: TemplateCatalog): TemplateCatalog {
  const PRESET = "social-4-5" as const;
  return {
    async facets() {
      const all = await catalog.list({ preset: PRESET, limit: 100 });
      if (!all.ok) return all;
      const categories = new Set(all.value.items.flatMap((t) => t.categories));
      const facets = await catalog.facets();
      if (!facets.ok) return facets;
      return ok({ categories: facets.value.categories.filter((c) => categories.has(c)), presets: [PRESET] });
    },
    list: (query) => catalog.list({ ...query, preset: PRESET }),
    load: (id) => catalog.load(id),
  };
}

/**
 * Ajoute à la carte les champs invité qui lui manquent (nouvelle carte, carte issue d'un modèle) ; ceux que
 * prévoit un modèle prennent le nom et la table de l'invité d'exemple de l'événement.
 */
export function ensureGuestFields(sample: GuestSample): void {
  const doc = currentDocument();
  const commands: DocumentCommand[] = [];
  for (const [slot, content] of [
    ["guest-name", sample.name],
    ["guest-table", sample.table],
  ] as const) {
    const field = slotOf(doc, slot);
    if (field?.type === "text" && field.content !== content)
      commands.push((d) => updateElement(d, { id: field.id, patch: { content } }));
  }
  // Le sceau est toujours en bas à droite : une ancienne carte qui le plaçait ailleurs y est ramenée.
  const seal = slotOf(doc, "guest-qr");
  if (seal && !sealInPlace(seal)) {
    const { left, top } = qrPosition(QR_SPOT);
    commands.push(
      (d) => updateElement(d, { id: seal.id, patch: { locked: false } }),
      (d) => moveElement(d, { id: seal.id, x: left, y: top }),
      (d) => updateElement(d, { id: seal.id, patch: { locked: true } }),
    );
  }
  if (!hasGuestFields(doc)) {
    let sealId = Object.entries(doc.assets).find(([, a]) => a.source.key === SEAL_ASSET_KEY)?.[0];
    if (!sealId) {
      const id = createId();
      sealId = id;
      commands.push((d) => addAsset(d, { id, asset: SEAL_ASSET }));
    }
    if (!slotOf(doc, "guest-name")) commands.push((d) => addElement(d, { element: createGuestName(sample) }));
    if (!slotOf(doc, "guest-table")) commands.push((d) => addElement(d, { element: createGuestTable(sample) }));
    const assetId = sealId;
    commands.push((d) => addElement(d, { element: createGuestQr(assetId) }));
  }
  if (commands.length > 0) useDocumentStore.getState().executeAll("Ajouter les champs invité", commands);
}

function starterDocument(title: string): CreativeDocument {
  const doc = createBlankDocument({ preset: "social-4-5" });
  return { ...doc, meta: { ...doc.meta, title } };
}

export interface HereEditorOptions {
  /** Routes de l'éditeur de l'événement (…/carte). */
  readonly baseUrl: string;
  readonly title: string;
  readonly sample: GuestSample;
}

/** Branche l'éditeur sur Here! et ouvre la carte de l'événement. Renvoie de quoi tout débrancher. */
export function startHereEditor(options: HereEditorOptions): () => void {
  registerTextMeasurer(konvaTextMeasurer);
  const local = createIndexedDbRepository();
  const { repository, assets } = createHereRepository({ baseUrl: options.baseUrl, local });
  configurePersistence(repository, { assets });
  const deviceImages = createDeviceImageLibrary(assets);
  configureLibrary({
    templates: cardTemplates(createBundledTemplateCatalog()),
    assets: [createBundledAssetLibrary(), deviceImages],
    device: deviceImages,
    isAssetAvailable: (asset) =>
      asset.source.type === "local" || BUNDLED_ASSET_URLS.has(asset.source.key) || asset.source.key === SEAL_ASSET_KEY,
  });
  configureImageGeneration(createHttpImageGenerator({ baseUrl: "/api/image-generation" }));
  // Satori dessine les champs invité : ses polices, sans effets.
  configureGuestSlots({ fonts: Object.keys(GUEST_FONTS), effects: false });

  // Chaque nouvelle carte (vierge, modèle) reçoit les champs invité.
  let lastId: string | null = null;
  const unsubscribe = useDocumentStore.subscribe((state) => {
    const id = state.history.present.id;
    if (id === lastId) return;
    lastId = id;
    queueMicrotask(() => {
      ensureGuestFields(options.sample);
    });
  });

  // Débranché avant la fin (page quittée, double montage de React en développement) : on s'arrête là.
  let disposed = false;
  void (async () => {
    const list = await listDocuments();
    if (disposed) return;
    const saved = list.ok ? list.value[0] : undefined;
    if (saved && (await openDocument(saved.id, { discardChanges: true }))) return;
    if (list.ok && !disposed) await createDocument(starterDocument(options.title), { discardChanges: true });
  })();

  // Enregistrement immédiat quand la page passe en arrière-plan ; avertissement avant de la quitter.
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") void saveNow();
  };
  const onBeforeUnload = (event: BeforeUnloadEvent) => {
    if (hasPendingChanges()) event.preventDefault();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("beforeunload", onBeforeUnload);

  return () => {
    disposed = true;
    unsubscribe();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("beforeunload", onBeforeUnload);
    configurePersistence(null);
    configureLibrary(null);
    configureImageGeneration(null);
    configureGuestSlots(null);
    local.close();
  };
}
