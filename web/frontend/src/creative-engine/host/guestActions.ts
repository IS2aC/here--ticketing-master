import { DEFAULT_QR_STYLE, QR_MIN_CONTRAST, type QrStyle } from "@/lib/card/qr";
import { addElement, removeElement } from "../domain/commands/elementCommands.ts";
import type { HexColor } from "../domain/elements/types.ts";
import { contrastRatio } from "../editor/colors.ts";
import { currentDocument, useDocumentStore, type DocumentCommand } from "../editor/documentStore.ts";
import { saveNow } from "../editor/persistence.ts";
import { exportDocument } from "../export/exportDocument.ts";
import type { AssetUrlResolver } from "../rendering/assetResolverContext.ts";
import {
  createGuestName,
  createGuestTable,
  slotOf,
  toCardLayout,
  withoutGuestFields,
  type GuestSample,
} from "./guestFields.ts";
import { sealIsScannable, sealUrl } from "./qrStyle.ts";

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

export type ValidationResult = { readonly ok: true; readonly created: number } | { readonly ok: false; readonly message: string };

/**
 * Valide la carte : enregistre le document, exporte le décor (sans les champs invité) et l'envoie à Here! avec
 * la mise en page des champs. Satori dessine ensuite la carte de chaque invité.
 */
export async function validateCard(
  baseUrl: string,
  resolveAssetUrl: AssetUrlResolver,
  qrStyle: QrStyle,
): Promise<ValidationResult> {
  const doc = currentDocument();
  const layout = toCardLayout(doc);
  if (!layout.ok) return layout;
  // Le QR code doit se scanner : contraste sur le blanc du sceau, puis relecture du sceau dessiné par Satori.
  const readable =
    contrastRatio(qrStyle.color as HexColor, "#FFFFFF") >= QR_MIN_CONTRAST && (await sealIsScannable(sealUrl(baseUrl, qrStyle)));
  if (!readable)
    return { ok: false, message: "Le QR code ne se relit pas avec ce style : choisissez une couleur plus foncée ou des points carrés." };
  const isDefault = qrStyle.dots === "carres" && qrStyle.corners === "carres" && qrStyle.color === DEFAULT_QR_STYLE.color;
  if (!(await saveNow())) return { ok: false, message: "La carte n'a pas pu être enregistrée. Réessayez dans un instant." };

  const decor = await exportDocument(withoutGuestFields(doc), { format: "png", scale: 1 }, { resolveAssetUrl });
  if (!decor.ok) return { ok: false, message: decor.error.message };

  const body = new FormData();
  body.append("decor", decor.value.blob, "decor.png");
  body.append("layout", JSON.stringify({ ...layout.layout, qr_style: isDefault ? null : qrStyle }));
  try {
    const response = await fetch(`${baseUrl}/valider`, { method: "POST", body });
    if (response.ok) {
      const { created } = (await response.json().catch(() => ({}))) as { created?: number };
      return { ok: true, created: created ?? 0 };
    }
    const { message } = (await response.json()) as { message?: string };
    return { ok: false, message: message ?? "Votre carte n'a pas été validée. Réessayez." };
  } catch {
    return { ok: false, message: "Le serveur Here! est injoignable. Votre carte n'a pas été validée." };
  }
}
