"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export type GuestFormState = { message?: string; errors?: Partial<Record<string, string>>; values?: Record<string, string> };

const UNAVAILABLE = "Le service est momentanément indisponible. L'invité n'a pas été enregistré.";

const FIELD_MESSAGES: Record<string, string> = {
  last_name: "100 caractères au plus.",
  first_names: "100 caractères au plus.",
  phone: "Ce numéro n'est pas valide. Exemple : 07 07 12 34 56.",
  seat: "60 caractères au plus.",
};

async function call(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<Response | null> {
  try {
    const response = await apiFetch(path, { method, token: await getSessionToken(), body: body ? JSON.stringify(body) : undefined });
    if (response.status === 401) redirect("/connexion");
    return response;
  } catch (error) {
    if (error instanceof Error && "digest" in error) throw error; // redirect()
    return null;
  }
}

/** Ajoute (guestId null) ou modifie un invité, puis revient à l'événement. */
export async function saveGuest(eventId: string, guestId: string | null, _: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const values = Object.fromEntries(
    ["last_name", "first_names", "phone", "category_id", "seat"].map((k) => [k, String(formData.get(k) ?? "").trim()]),
  );
  const body = { ...values, phone: values.phone || null, seat: values.seat || null };
  const response = await call(guestId ? `/v1/guests/${encodeURIComponent(guestId)}` : `/v1/events/${encodeURIComponent(eventId)}/guests`, guestId ? "PATCH" : "POST", body);
  if (!response) return { message: UNAVAILABLE, values };
  if (response.status === 400 || response.status === 409) {
    const { detail } = (await response.json()) as { detail: { field: string; message: string } };
    return { errors: { [detail.field]: detail.message }, values };
  }
  if (response.status === 422) {
    const { detail } = (await response.json()) as { detail: { loc: (string | number)[] }[] };
    const errors: GuestFormState["errors"] = {};
    for (const { loc } of detail) {
      const field = String(loc.at(-1));
      errors[field] = FIELD_MESSAGES[field] ?? "Valeur non valable.";
    }
    return { errors, values };
  }
  if (!response.ok) return { message: UNAVAILABLE, values };
  revalidatePath(`/tableau-de-bord/evenements/${eventId}`);
  const { display_name } = (await response.json()) as { display_name: string };
  redirect(`/tableau-de-bord/evenements/${eventId}?${guestId ? "modifie" : "ajoute"}=${encodeURIComponent(display_name)}`);
}

/** Retire un invité (carte, envois et entrée compris), puis revient à l'événement. */
export async function removeGuest(eventId: string, guestId: string, name: string): Promise<GuestFormState> {
  const response = await call(`/v1/guests/${encodeURIComponent(guestId)}`, "DELETE");
  if (!response || (!response.ok && response.status !== 404)) return { message: "Le service est momentanément indisponible. L'invité n'a pas été retiré." };
  revalidatePath(`/tableau-de-bord/evenements/${eventId}`);
  redirect(`/tableau-de-bord/evenements/${eventId}?retire=${encodeURIComponent(name)}`);
}
