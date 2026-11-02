// Identifiants : UUID v4 en minuscules.
// crypto.randomUUID n'existe que dans un contexte sécurisé (https, localhost) : une page servie en http sur le réseau
// local n'y a pas accès. crypto.getRandomValues est disponible partout (navigateurs, Node ≥ 19, workers).
export type Id = string;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function createId(): Id {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variante RFC 9562
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isId(value: unknown): value is Id {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
