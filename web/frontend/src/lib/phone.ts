// Affichage des numéros (format E.164 stocké par l'API : +2250707123456).

const groups = (digits: string) => digits.match(/.{1,2}/g)?.join(" ") ?? digits;

/** « +225 07 07 12 34 56 » : numéro complet, pour vérifier un import. */
export function formatPhone(phone: string): string {
  if (/^\+225\d{10}$/.test(phone)) return `+225 ${groups(phone.slice(4))}`;
  return phone;
}

/** « 07 •• •• 34 56 » : numéro masqué dans les listes (DESIGN.md, règle 5). */
export function maskPhone(phone: string): string {
  if (/^\+225\d{10}$/.test(phone)) {
    const local = phone.slice(4);
    return `${local.slice(0, 2)} •• •• ${local.slice(6, 8)} ${local.slice(8)}`;
  }
  const digits = phone.replace(/\D/g, "");
  return digits.length > 4 ? `•• •• ${groups(digits.slice(-4))}` : "•• ••";
}

/** « 07 00 00 00 09 » : numéro ivoirien tel qu'on le saisit (formulaires) ; les autres restent en +indicatif. */
export function localPhone(phone: string): string {
  if (/^\+225\d{10}$/.test(phone)) return groups(phone.slice(4));
  return phone;
}
