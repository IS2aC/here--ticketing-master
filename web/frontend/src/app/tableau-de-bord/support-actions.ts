"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import type { SupportConversation } from "@/lib/support";

export type SupportResult = { conversation: SupportConversation | null; message?: string };

const UNAVAILABLE = "Le service est momentanément indisponible. Réessayez dans un instant.";

async function call(path: string, method: "GET" | "POST", body?: unknown): Promise<Response | null> {
  try {
    const response = await apiFetch(path, { method, token: await getSessionToken(), body: body ? JSON.stringify(body) : undefined });
    if (response.status === 401) redirect("/connexion");
    return response;
  } catch (error) {
    if (error instanceof Error && "digest" in error) throw error; // redirect()
    return null;
  }
}

async function result(response: Response | null, fallback: SupportConversation | null = null): Promise<SupportResult> {
  if (!response) return { conversation: fallback, message: UNAVAILABLE };
  if (response.status === 429 || response.status === 409) {
    const { detail } = (await response.json()) as { detail: { message: string } };
    return { conversation: fallback, message: detail.message };
  }
  if (!response.ok) return { conversation: fallback, message: UNAVAILABLE };
  return { conversation: (await response.json()) as SupportConversation | null };
}

/** La discussion en cours, ou rien. */
export async function loadConversation(): Promise<SupportResult> {
  return result(await call("/v1/support", "GET"));
}

/** Pose une question : l'assistant répond, ou la transmet à l'équipe Here!. */
export async function sendQuestion(body: string, current: SupportConversation | null): Promise<SupportResult> {
  const text = body.trim();
  if (!text) return { conversation: current };
  if (text.length > 2000) return { conversation: current, message: "Votre message est trop long (2 000 caractères au plus)." };
  return result(await call("/v1/support/messages", "POST", { body: text }), current);
}

/** « Parler à l'équipe Here! ». */
export async function escalate(current: SupportConversation | null): Promise<SupportResult> {
  return result(await call("/v1/support/escalate", "POST"), current);
}

/** « Nouvelle question » : la discussion en cours est terminée. */
export async function closeConversation(): Promise<SupportResult> {
  const response = await call("/v1/support/close", "POST");
  return response?.ok ? { conversation: null } : { conversation: null, message: UNAVAILABLE };
}
