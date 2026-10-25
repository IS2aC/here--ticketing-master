import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE as COOKIE_NAME } from "./session-cookie";

// Le jeton de l'API vit uniquement dans un cookie httpOnly : le navigateur ne le lit jamais.

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_NAME)?.value;
}

export async function setSessionToken(token: string, expiresAt: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // COOKIE_SECURE=false uniquement pour tester en HTTP sur une autre machine que localhost.
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionToken(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
