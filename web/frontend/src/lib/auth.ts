import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { apiFetch, type User } from "./api";
import { getSessionToken } from "./session";

// Utilisateur connecté, vérifié auprès de l'API (une fois par requête). Sinon : retour à la connexion.
export const getCurrentUser = cache(async (): Promise<User> => {
  const token = await getSessionToken();
  if (!token) redirect("/connexion");

  const response = await apiFetch("/v1/me", { token });
  if (response.status === 401) redirect("/connexion");
  if (!response.ok) throw new Error(`API /v1/me : ${response.status}`);
  return response.json();
});
