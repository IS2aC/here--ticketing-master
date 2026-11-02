"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { parseQrStyle, type QrStyle } from "@/lib/card/qr";
import type { ImageAsset } from "../domain/document/types.ts";
import { useDocumentStore } from "../editor/documentStore.ts";
import { useEditorStore } from "../editor/editorStore.ts";
import { BUNDLED_ASSET_URLS } from "../library/bundled/ornaments.ts";
import { AssetResolverProvider } from "../rendering/assetResolver.tsx";
import { ExportDialog } from "../ui/Export/ExportDialog.tsx";
import { useEditorShortcuts } from "../ui/hooks/useEditorShortcuts.ts";
import { Icon } from "../ui/icons/Icon.tsx";
import { LibraryPanel } from "../ui/Library/LibraryPanel.tsx";
import { ActionButton } from "../ui/primitives/ActionButton.tsx";
import { MenuButton, type MenuItem } from "../ui/primitives/MenuButton.tsx";
import { PropertiesPanel } from "../ui/PropertiesPanel/PropertiesPanel.tsx";
import { ToolRail } from "../ui/ToolRail/ToolRail.tsx";
import { TopBar } from "../ui/TopBar/TopBar.tsx";
import { Workspace } from "../ui/Workspace/Workspace.tsx";
import { addGuestName, toggleGuestTable, validateCard } from "./guestActions.ts";
import { SEAL_ASSET_KEY, type GuestSample } from "./guestFields.ts";
import { QrPanel } from "./QrPanel.tsx";
import { sealUrl, useQrStyle } from "./qrStyle.ts";
import { startHereEditor } from "./setup.ts";
import { useLocalAssetUrls } from "./useLocalAssetUrls.ts";
import "../styles/fonts.css";
import "../styles/editor-tokens.css";
import "../styles/global.css";
import styles from "./HereCardEditor.module.css";

export interface HereCardEditorProps {
  readonly eventId: string;
  readonly eventTitle: string;
  readonly sample: GuestSample;
  /** Style du QR code enregistré avec la carte (mise en page), sinon le style classique. */
  readonly qrStyle: QrStyle | null;
}

const isServed = (key: string) => BUNDLED_ASSET_URLS.has(key) || key === SEAL_ASSET_KEY;

/** Champs invité : nom, table et catégorie (le QR code a son propre panneau). */
function GuestFieldsMenu({ sample }: { sample: GuestSample }) {
  const hasName = useDocumentStore((s) => s.history.present.elements.some((e) => e.slot === "guest-name"));
  const hasTable = useDocumentStore((s) => s.history.present.elements.some((e) => e.slot === "guest-table"));
  const items: MenuItem[] = [
    { label: "Ajouter le nom de l'invité", icon: "plus", disabled: hasName, onSelect: () => addGuestName(sample) },
    {
      label: hasTable ? "Retirer la table et la catégorie" : "Ajouter la table et la catégorie",
      icon: hasTable ? "trash" : "plus",
      onSelect: () => toggleGuestTable(sample),
    },
  ];
  return <MenuButton label="Champs invité" menuLabel="Champs invité" icon="guest" items={items} showLabel />;
}

/** Éditeur de la carte d'invitation d'un événement, en plein écran au-dessus du tableau de bord. */
export function HereCardEditor({ eventId, eventTitle, sample, qrStyle: savedQrStyle }: HereCardEditorProps) {
  const baseUrl = `/tableau-de-bord/evenements/${encodeURIComponent(eventId)}/carte/editeur`;
  const eventUrl = `/tableau-de-bord/evenements/${encodeURIComponent(eventId)}`;
  const isPanelOpen = useEditorStore((s) => s.isPropertiesPanelOpen);
  const closePanel = useEditorStore((s) => s.closePropertiesPanel);
  const [validating, setValidating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const qrStyle = useQrStyle((s) => s.style);
  const router = useRouter();

  useEffect(() => startHereEditor({ baseUrl, title: `Carte · ${eventTitle}`, sample }), [baseUrl, eventTitle, sample]);
  useEffect(() => {
    useQrStyle.setState({ style: parseQrStyle(savedQrStyle) });
  }, [savedQrStyle]);
  useEditorShortcuts();

  // Images : ornements du catalogue et sceau d'exemple (servis par Here!), sinon images de l'appareil ou du serveur.
  const localUrls = useLocalAssetUrls(isServed);
  const resolveAsset = useCallback(
    (_id: string, asset: ImageAsset) =>
      asset.source.key === SEAL_ASSET_KEY
        ? sealUrl(baseUrl, qrStyle)
        : (BUNDLED_ASSET_URLS.get(asset.source.key) ?? localUrls.get(asset.source.key) ?? null),
    [baseUrl, localUrls, qrStyle],
  );

  async function validate() {
    setValidating(true);
    setNotice(null);
    const result = await validateCard(baseUrl, resolveAsset, qrStyle);
    if (result.ok) {
      router.push(`${eventUrl}/carte?editeur=valide`);
      return;
    }
    setValidating(false);
    setNotice(result.message);
  }

  return (
    <AssetResolverProvider resolver={resolveAsset}>
      <div className={`ce-root ${styles.shell}`}>
        <div className={styles.top}>
          <TopBar
            showDocumentMenu={false}
            savedLabel="Enregistré"
            leading={
              <>
                <Link href={eventUrl} className={styles.back}>
                  <Icon name="arrowLeft" />
                  <span className={styles.backLabel}>Retour à l&apos;événement</span>
                </Link>
                <span className={styles.event} title={eventTitle}>
                  {eventTitle}
                </span>
              </>
            }
            trailing={
              <>
                <GuestFieldsMenu sample={sample} />
                <ActionButton
                  label="QR code"
                  icon="qr"
                  showLabel
                  variant="ghost"
                  aria-expanded={qrOpen}
                  aria-haspopup="dialog"
                  onClick={() => setQrOpen((open) => !open)}
                />
                <button type="button" className={styles.validate} disabled={validating} onClick={() => void validate()}>
                  <Icon name="check" />
                  {validating ? "Validation…" : "Valider la carte"}
                </button>
              </>
            }
          />
        </div>
        <div className={styles.tools}>
          <ToolRail />
        </div>
        <LibraryPanel />
        <div className={styles.workspace}>
          <Workspace />
        </div>
        <div className={styles.panel} data-open={isPanelOpen}>
          <PropertiesPanel />
        </div>
        {isPanelOpen && <div className={styles.scrim} aria-hidden="true" onClick={closePanel} />}
        <ExportDialog />
        {qrOpen && <QrPanel baseUrl={baseUrl} onClose={() => setQrOpen(false)} />}
        {notice && (
          <div role="alert" className={styles.notice}>
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </AssetResolverProvider>
  );
}
