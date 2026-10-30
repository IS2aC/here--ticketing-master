"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/icons";
import { EVENT_TIME_ZONE } from "@/lib/event-types";
import type { ScanEvent, ScanGuest, ScanResult } from "@/lib/scan";
import { checkIn, searchGuests } from "./actions";

const hour = new Intl.DateTimeFormat("fr-FR", { timeZone: EVENT_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const at = (iso: string | null) => (iso ? hour.format(new Date(iso)) : "");

// Couleur du cadre et du résultat (DESIGN.md, « Scan à l'entrée »).
const STATES: Record<ScanResult["result"], { color: string; border: string; icon: IconName; title: (r: ScanResult) => string }> = {
  admitted: { color: "text-green-light", border: "border-green-light", icon: "valide", title: () => "Invité attendu" },
  already: { color: "text-amber-light", border: "border-amber-light", icon: "horloge", title: (r) => `Déjà entré à ${at(r.entered_at)}` },
  unknown: { color: "text-red-bright", border: "border-red-bright", icon: "decline", title: () => "Invitation non reconnue" },
  // Règle d'entrée : seuls les invités qui ont confirmé entrent.
  refused: { color: "text-red-bright", border: "border-red-bright", icon: "decline", title: () => "Entrée refusée" },
};

const big = "flex h-14 w-full items-center justify-center gap-2 rounded-full px-6 font-heading text-[17px] font-semibold disabled:opacity-60";

export function Scanner({ token, initial }: { token: string; initial: ScanEvent }) {
  const [event, setEvent] = useState(initial);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off">("starting");
  const [panel, setPanel] = useState<"none" | "code" | "search">("none");
  const [pending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);

  const verify = useCallback(
    (input: { value?: string; guestId?: string }) => {
      busy.current = true;
      startTransition(async () => {
        const outcome = await checkIn(token, input);
        if (outcome.ok) {
          setResult(outcome.data);
          setEvent(outcome.data.event);
          setError(null);
          setPanel("none");
          navigator.vibrate?.(outcome.data.result === "admitted" ? 80 : [60, 60, 60]);
        } else {
          setError(outcome.message);
          busy.current = false;
        }
      });
    },
    [token],
  );

  // Caméra arrière + lecture du QR code (jsQR) tant qu'aucun résultat n'est affiché.
  useEffect(() => {
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setCamera("on");
        timer = setInterval(() => {
          if (busy.current || !context || video.readyState < 2) return;
          const width = 480;
          const height = Math.round((video.videoHeight / video.videoWidth) * width) || 480;
          canvas.width = width;
          canvas.height = height;
          context.drawImage(video, 0, 0, width, height);
          const code = jsQR(context.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: "dontInvert" });
          if (code?.data) verify({ value: code.data });
        }, 250);
      } catch {
        setCamera("off");
      }
    })();
    return () => {
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [verify]);

  function next() {
    setResult(null);
    setError(null);
    busy.current = false;
  }

  const state = result ? STATES[result.result] : null;

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-4 px-5 py-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-[19px] font-semibold">{event.title}</h1>
          <p className="text-[15px] text-gray-500">{event.label}</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block font-data text-[26px] leading-none font-semibold tabular-nums">{event.arrived}</span>
          <span className="text-[13px] text-gray-500">arrivés / {event.expected} attendus</span>
        </p>
      </header>

      <div className="relative aspect-square overflow-hidden rounded-xl bg-[radial-gradient(circle_at_70%_25%,color-mix(in_srgb,var(--color-red)_45%,transparent),transparent_60%)]">
        <video ref={videoRef} muted playsInline className={`absolute inset-0 size-full object-cover ${camera === "on" ? "" : "hidden"}`} />
        {/* Cadre de visée : coins à la couleur du résultat */}
        <div className="pointer-events-none absolute inset-[18%]">
          {["top-0 left-0 border-t-4 border-l-4 rounded-tl-xl", "top-0 right-0 border-t-4 border-r-4 rounded-tr-xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl", "bottom-0 right-0 border-r-4 border-b-4 rounded-br-xl"].map((corner) => (
            <span key={corner} className={`absolute size-12 ${corner} ${state?.border ?? "border-white"}`} />
          ))}
        </div>
        {camera !== "on" ? (
          <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-[17px] text-gray-300">
            {camera === "starting" ? "Ouverture de la caméra…" : "Caméra indisponible : saisissez le code de la carte ou cherchez par nom."}
          </p>
        ) : null}
      </div>

      {result && state ? (
        <section aria-live="assertive" className={`grid gap-3 rounded-xl border-2 bg-ink-800 p-5 ${state.border}`}>
          <p className={`flex items-center gap-3 font-heading text-[22px] leading-tight font-extrabold uppercase ${state.color}`}>
            <Icon name={state.icon} width={32} height={32} className="shrink-0" />
            {state.title(result)}
          </p>
          {result.guest ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="text-[12px] tracking-[0.1em] text-gray-500 uppercase">Invité</p>
                <p className="text-[17px] font-semibold break-words">{result.guest.name}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[12px] tracking-[0.1em] text-gray-500 uppercase">{result.result === "already" ? "Places" : "Placement"}</p>
                <p className="text-[17px] font-semibold">
                  {result.result === "already"
                    ? `${result.guest.seats} personne${result.guest.seats > 1 ? "s" : ""}`
                    : [result.guest.category, result.guest.seat].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[17px]">
              <span className="block text-[12px] tracking-[0.1em] text-gray-500 uppercase">Ce QR code</span>
              n&apos;appartient pas à {event.title}.
            </p>
          )}
          {result.result === "admitted" && result.guest && result.guest.seats > 1 ? (
            // Entrée de toutes les personnes confirmées en une fois (décision du 29/10).
            <p className="font-heading text-[21px] font-extrabold text-green-light uppercase">{result.guest.seats} personnes entrent</p>
          ) : null}
                    {result.result === "refused" ? (
            <p className="text-[17px] text-red-bright">
              {result.guest?.rsvp_status === "declined"
                ? "A répondu qu'il ne viendrait pas."
                : "N'a pas confirmé sa présence : il n'est pas sur la liste des attendus."}
              <span className="mt-1 block text-[15px] text-gray-300">En cas de doute, appelez l&apos;organisateur.</span>
            </p>
          ) : null}
          <p className="font-mono text-[14px] text-gray-500">
            {result.code ? `${result.result === "unknown" ? "Code lu : " : ""}${result.code}` : "Code illisible"}
            {result.result === "admitted" ? ` · ${at(result.entered_at)}` : null}
            {result.result === "already" && result.entered_by ? ` · scanné à « ${result.entered_by} »` : null}
          </p>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-ink-800 px-4 py-3 text-[17px] text-red-bright">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3">
        {result?.result === "unknown" ? (
          <button type="button" onClick={() => setPanel("search")} className={`${big} bg-white text-ink`}>
            <Icon name="recherche" width={20} height={20} />
            Chercher par nom
          </button>
        ) : null}
        {result ? (
          <button type="button" onClick={next} className={`${big} ${result.result === "admitted" ? "bg-primary text-white" : "text-white shadow-[inset_0_0_0_1.5px_var(--color-ink-700)]"}`}>
            Accueillir le suivant
          </button>
        ) : (
          <div className="flex justify-center gap-6 text-[17px] font-semibold">
            <button type="button" onClick={() => setPanel(panel === "code" ? "none" : "code")} className="text-white hover:underline">
              Saisir un code
            </button>
            <button type="button" onClick={() => setPanel(panel === "search" ? "none" : "search")} className="text-white hover:underline">
              Chercher par nom
            </button>
          </div>
        )}
      </div>

      {panel === "code" ? <CodeEntry pending={pending} onSubmit={(value) => verify({ value })} /> : null}
      {panel === "search" ? <Search token={token} pending={pending} onPick={(guestId) => verify({ guestId })} /> : null}
    </div>
  );
}

function CodeEntry({ pending, onSubmit }: { pending: boolean; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="grid gap-3 rounded-xl bg-ink-800 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
    >
      <label className="grid gap-2 text-[15px] text-gray-500">
        Code imprimé sous le QR code
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="INV-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          className="h-14 rounded-md bg-ink px-4 font-mono text-[18px] tracking-[0.06em] text-white shadow-[inset_0_0_0_1px_var(--color-ink-700)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-red-bright)]"
        />
      </label>
      <button type="submit" disabled={pending} className={`${big} bg-white text-ink`}>
        Vérifier
      </button>
    </form>
  );
}

function Search({ token, pending, onPick }: { token: string; pending: boolean; onPick: (guestId: string) => void }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; guests: ScanGuest[] }>({ query: "", guests: [] });
  const searchable = query.trim().length >= 2;
  // Résultats affichés seulement s'ils correspondent à la saisie actuelle.
  const guests = searchable && found.query === query ? found.guests : [];
  useEffect(() => {
    if (!searchable) return;
    const timer = setTimeout(async () => setFound({ query, guests: await searchGuests(token, query) }), 250);
    return () => clearTimeout(timer);
  }, [query, searchable, token]);
  return (
    <div className="grid gap-3 rounded-xl bg-ink-800 p-4">
      <label className="grid gap-2 text-[15px] text-gray-500">
        Nom de l&apos;invité
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Konan, Fatou…"
          autoComplete="off"
          className="h-14 rounded-md bg-ink px-4 text-[18px] text-white shadow-[inset_0_0_0_1px_var(--color-ink-700)] outline-none focus:shadow-[inset_0_0_0_2px_var(--color-red-bright)]"
        />
      </label>
      {searchable && found.query === query && guests.length === 0 ? <p className="text-[15px] text-gray-500">Aucun invité trouvé.</p> : null}
      <ul className="grid gap-2">
        {guests.map((g) => (
          <li key={g.guest_id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => onPick(g.guest_id)}
              className="flex w-full items-center justify-between gap-3 rounded-md bg-ink px-4 py-3 text-left shadow-[inset_0_0_0_1px_var(--color-ink-700)] hover:shadow-[inset_0_0_0_1.5px_var(--color-white)]"
            >
              <span className="min-w-0">
                <span className="block text-[17px] font-semibold break-words">{g.name}</span>
                <span className="text-[14px] text-gray-500">{[g.category, g.seat].filter(Boolean).join(" · ")}</span>
              </span>
              <span className={`shrink-0 text-[14px] font-semibold ${g.entered_at ? "text-amber-light" : "text-white"}`}>
                {g.entered_at ? `Entré à ${at(g.entered_at)}` : "Faire entrer"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
