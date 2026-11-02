import type { QrSpot } from "@/lib/card/layout";
import { qrPosition } from "@/lib/card/layout";
import { addAsset } from "../domain/commands/documentCommands.ts";
import { addElement, moveElement, removeElement, updateElement } from "../domain/commands/elementCommands.ts";
import { createId } from "../domain/ids.ts";
import { currentDocument, useDocumentStore, type DocumentCommand } from "../editor/documentStore.ts";
import { saveNow } from "../editor/persistence.ts";
import { exportDocument } from "../export/exportDocument.ts";
import type { AssetUrlResolver } from "../rendering/assetResolverContext.ts";
import {
  createGuestName,
  createGuestQr,
  createGuestTable,
  SEAL_ASSET,
  SEAL_ASSET_KEY,
  slotOf,
  toCardLayout,
  withoutGuestFields,
  type GuestSample,
} from "./guestFields.ts";

// Actions de l'hôte sur les champs invité, et validation de la carte (décor + mise en page vers Satori).

const run = (label: string, commands: readonly DocumentCommand[]) => useDocumentStore.getState().executeAll(label, commands);

export function addGuestName(sample: GuestSample): void {
  if (slotOf(currentDocument(), "guest-name")) return;
  run("Ajouter le nom de l'invité", [(d) => addElement(d, { element: createGuestName(sample) })]);
}

export function toggleGuestTable(sample: GuestSample): void {
  const table = slotOf(currentDocument(), "guest-table");
  if (table) run("Retirer la table", [(d) => removeElement(d, { id: table.id })]);
  else run("Ajouter la table", [(d) => addElement(d, { element: createGuestTable(sample) })]);
}

/** Le QR code est verrouillé (il ne se dépose pas n'importe où) : déverrouillé, placé et reverrouillé en une étape. */
export function moveSealTo(spot: QrSpot): void {
  const doc = currentDocument();
  const qr = slotOf(doc, "guest-qr");
  const { left, top } = qrPosition(spot);
  if (qr) {
    run("Placer le QR code", [
      (d) => updateElement(d, { id: qr.id, patch: { locked: false } }),
      (d) => moveElement(d, { id: qr.id, x: left, y: top }),
      (d) => updateElement(d, { id: qr.id, patch: { locked: true } }),
    ]);
    return;
  }
  const existing = Object.entries(doc.assets).find(([, a]) => a.source.key === SEAL_ASSET_KEY)?.[0];
  const assetId = existing ?? createId();
  run("Ajouter le QR code", [
    ...(existing ? [] : [(d: Parameters<DocumentCommand>[0]) => addAsset(d, { id: assetId, asset: SEAL_ASSET })]),
    (d) => addElement(d, { element: createGuestQr(assetId, spot) }),
  ]);
}

export type ValidationResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Valide la carte : enregistre le document, exporte le décor (sans les champs invité) et l'envoie à Here! avec
 * la mise en page des champs. Satori dessine ensuite la carte de chaque invité.
 */
export async function validateCard(baseUrl: string, resolveAssetUrl: AssetUrlResolver): Promise<ValidationResult> {
  const doc = currentDocument();
  const layout = toCardLayout(doc);
  if (!layout.ok) return layout;
  if (!(await saveNow())) return { ok: false, message: "La carte n'a pas pu être enregistrée. Réessayez dans un instant." };

  const decor = await exportDocument(withoutGuestFields(doc), { format: "png", scale: 1 }, { resolveAssetUrl });
  if (!decor.ok) return { ok: false, message: decor.error.message };

  const body = new FormData();
  body.append("decor", decor.value.blob, "decor.png");
  body.append("layout", JSON.stringify(layout.layout));
  try {
    const response = await fetch(`${baseUrl}/valider`, { method: "POST", body });
    if (response.ok) return { ok: true };
    const { message } = (await response.json()) as { message?: string };
    return { ok: false, message: message ?? "Votre carte n'a pas été validée. Réessayez." };
  } catch {
    return { ok: false, message: "Le serveur Here! est injoignable. Votre carte n'a pas été validée." };
  }
}
