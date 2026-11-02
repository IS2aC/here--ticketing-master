"use client";

import dynamic from "next/dynamic";
import type { HereCardEditorProps } from "@/creative-engine/host/HereCardEditor";

// L'éditeur (Konva, IndexedDB) ne vit que dans le navigateur : pas de rendu serveur, et son code n'est
// téléchargé que sur cette page.
const HereCardEditor = dynamic(() => import("@/creative-engine/host/HereCardEditor").then((m) => m.HereCardEditor), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-[14px] text-text-muted" aria-busy="true">
      Ouverture de l&apos;éditeur…
    </div>
  ),
});

export function EditorLoader(props: HereCardEditorProps) {
  return <HereCardEditor {...props} />;
}
