import { connection } from "next/server";
import { apiUrl } from "@/lib/api";

// Vérifie à chaque requête que le frontend joint l'API, et l'API la base.
export async function ApiStatus() {
  await connection();
  let ok = false;
  try {
    const response = await fetch(apiUrl("/health"), { signal: AbortSignal.timeout(3000) });
    ok = response.ok;
  } catch {
    ok = false;
  }
  return (
    <p className={`text-sm ${ok ? "text-success" : "text-error"}`}>
      {ok ? "API et base de données connectées" : "API injoignable"}
    </p>
  );
}
