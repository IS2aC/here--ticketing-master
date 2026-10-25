"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

// Notification de résultat (DESIGN.md) : noire, en bas à droite, disparaît après 6 s quand c'est un succès.
export function Toast({ title, detail }: { title: string; detail?: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    // Le résultat vient de l'adresse (?importes=…) : on la nettoie pour ne pas le réafficher au rechargement.
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
    const timer = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 left-4 z-50 flex items-start gap-3 rounded-md bg-ink p-4 text-white shadow-lg sm:left-auto sm:w-[360px]"
    >
      <Icon name="valide" width={20} height={20} className="mt-0.5 shrink-0 text-green-light" />
      <div className="min-w-0 flex-1">
        <p className="font-heading text-[14px] font-semibold">{title}</p>
        {detail ? <p className="text-[13px] text-gray-500">{detail}</p> : null}
      </div>
      <button type="button" onClick={() => setVisible(false)} aria-label="Fermer" className="text-gray-500 hover:text-white">
        <Icon name="decline" width={18} height={18} />
      </button>
    </div>
  );
}
