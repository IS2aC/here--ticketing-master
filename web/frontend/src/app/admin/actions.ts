"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getSettings, type PlatformValues } from "@/lib/admin";
import { apiFetch } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export type SettingsState = { message?: string };

const UNAVAILABLE = "Le service est momentanément indisponible. Rien n'a été modifié.";

async function patch(path: string, body: unknown): Promise<Response | null> {
  try {
    const response = await apiFetch(`/v1/admin${path}`, { method: "PATCH", body: JSON.stringify(body), token: await getSessionToken() });
    if (response.status === 401) redirect("/connexion");
    if (response.status === 403) notFound();
    return response;
  } catch (error) {
    if (error instanceof Error && "digest" in error) throw error; // redirect() / notFound()
    return null;
  }
}

export type AccountOption = "on_demand_reminders" | "day_before_reminders";

/** Active ou désactive une option payante d'un compte (relances à la demande, rappel la veille). */
export async function setOption(userId: string, option: AccountOption, enabled: boolean): Promise<void> {
  await patch(`/users/${encodeURIComponent(userId)}`, { [option]: enabled });
  revalidatePath(`/admin/utilisateurs/${userId}`);
  revalidatePath("/admin/utilisateurs");
}

const LABELS: Record<keyof PlatformValues, string> = {
  whatsapp_provider: "Prestataire d'envoi",
  whatsapp_reminder_days_before: "Calendrier des relances",
  whatsapp_min_delay_seconds: "Délai minimum",
  whatsapp_max_delay_seconds: "Délai maximum",
  whatsapp_batch_size: "Taille d'un lot",
  whatsapp_batch_pause_minutes: "Pause entre deux lots",
  whatsapp_send_start_hour: "Début des envois",
  whatsapp_send_end_hour: "Fin des envois",
  whatsapp_day_before_hour: "Heure du rappel la veille",
};

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Enregistre les réglages. Seuls les champs modifiés partent ; une valeur égale à celle de l'environnement
 * redevient « par défaut » (null). Bouton « reset:<clé> » : retour à la valeur par défaut d'un seul réglage.
 */
export async function saveSettings(_previous: SettingsState, formData: FormData): Promise<SettingsState> {
  const intent = String(formData.get("intent") ?? "save");
  let body: Partial<Record<keyof PlatformValues, unknown>>;

  if (intent.startsWith("reset:")) {
    body = { [intent.slice("reset:".length)]: null };
  } else {
    const days = String(formData.get("whatsapp_reminder_days_before") ?? "").trim();
    if (!/^(\d+\s*(,\s*\d+\s*)*)?$/.test(days)) {
      return { message: "Calendrier des relances : des nombres de jours séparés par des virgules, par exemple « 14, 7, 2 »." };
    }
    const wanted: PlatformValues = {
      whatsapp_provider: String(formData.get("whatsapp_provider")) as PlatformValues["whatsapp_provider"],
      whatsapp_reminder_days_before: [...new Set(days ? days.split(",").map((d) => Number(d.trim())) : [])].sort((a, b) => b - a),
      whatsapp_min_delay_seconds: Number(formData.get("whatsapp_min_delay_seconds")),
      whatsapp_max_delay_seconds: Number(formData.get("whatsapp_max_delay_seconds")),
      whatsapp_batch_size: Number(formData.get("whatsapp_batch_size")),
      whatsapp_batch_pause_minutes: Number(formData.get("whatsapp_batch_pause_minutes")),
      whatsapp_send_start_hour: Number(formData.get("whatsapp_send_start_hour")),
      whatsapp_send_end_hour: Number(formData.get("whatsapp_send_end_hour")),
      whatsapp_day_before_hour: Number(formData.get("whatsapp_day_before_hour")),
    };
    let current;
    try {
      current = await getSettings();
    } catch {
      return { message: UNAVAILABLE };
    }
    body = {};
    for (const key of Object.keys(wanted) as (keyof PlatformValues)[]) {
      if (same(wanted[key], current.values[key])) continue;
      body[key] = same(wanted[key], current.defaults[key]) ? null : wanted[key];
    }
    if (Object.keys(body).length === 0) return { message: "Aucun changement à enregistrer." };
  }

  const response = await patch("/settings", body);
  if (!response) return { message: UNAVAILABLE };
  if (response.status === 422) {
    const { detail } = (await response.json()) as { detail: { message?: string } | { loc: (string | number)[] }[] };
    if (!Array.isArray(detail)) return { message: detail.message ?? "Ces réglages ne sont pas valables." };
    const key = detail[0]?.loc.find((part): part is keyof PlatformValues => typeof part === "string" && part in LABELS);
    return { message: key ? `${LABELS[key]} : valeur hors des limites permises.` : "Ces réglages ne sont pas valables." };
  }
  if (!response.ok) return { message: UNAVAILABLE };
  revalidatePath("/admin", "layout");
  redirect(`/admin/reglages?${intent.startsWith("reset:") ? "retabli" : "enregistre"}=1`);
}

export type CallState = { message?: string };

/** Résultat d'un appel de la conseillère : la réponse de l'invité est mise à jour par l'API. */
export async function recordCall(callId: string, _: CallState, formData: FormData): Promise<CallState> {
  const outcome = String(formData.get("outcome") ?? "");
  if (!outcome) return { message: "Choisissez le résultat de l'appel." };
  const notes = String(formData.get("notes") ?? "").trim() || null;
  let response: Response;
  try {
    response = await apiFetch(`/v1/admin/calls/${encodeURIComponent(callId)}/result`, {
      method: "POST",
      token: await getSessionToken(),
      body: JSON.stringify({ outcome, notes }),
    });
  } catch {
    return { message: UNAVAILABLE };
  }
  if (response.status === 401) redirect("/connexion");
  if (response.status === 422) return { message: "La note est trop longue (500 caractères au plus)." };
  if (!response.ok) return { message: UNAVAILABLE };
  revalidatePath("/admin/messages");
  return {};
}

/** Message d'un invité traité (ou remis à traiter). */
export async function setHandled(messageId: string, handled: boolean): Promise<void> {
  try {
    const response = await apiFetch(`/v1/admin/inbound/${encodeURIComponent(messageId)}/handled`, {
      method: "POST",
      token: await getSessionToken(),
      body: JSON.stringify({ handled }),
    });
    if (response.status === 401) redirect("/connexion");
  } catch (error) {
    if (error instanceof Error && "digest" in error) throw error;
  }
  revalidatePath("/admin/messages");
}
