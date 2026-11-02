// Champs invité (éléments avec `slot`) : l'hôte les remplit pour chaque invité avec son propre rendu, et dit
// ce qu'il sait en dessiner. L'interface ne propose alors que cela pour ces champs.

export interface GuestSlotRules {
  /** Polices utilisables (familles) ; les autres ne seraient pas dessinées par l'hôte. */
  readonly fonts: readonly string[];
  /** Ombre, contour, dégradé : faux si l'hôte ne les dessine pas. */
  readonly effects: boolean;
}

let rules: GuestSlotRules | null = null;

/** Branché au démarrage par l'hôte ; null : aucune restriction. */
export function configureGuestSlots(next: GuestSlotRules | null): void {
  rules = next;
}

export function guestSlotRules(): GuestSlotRules | null {
  return rules;
}
