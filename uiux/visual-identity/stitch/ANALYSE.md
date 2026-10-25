# Test en contexte avec Stitch — 24/10/2026

Projet Stitch : « Here! Ticketing Master — test identité » (id 5884227136125355736).
Objectif : vérifier qu'un outil tiers, guidé seulement par les règles écrites (couleurs HEX, polices, personnalité, règles de DESIGN.md), produit des écrans conformes à l'identité.

## Écrans obtenus

| Fichier | Écran | Système de design |
|---|---|---|
| `stitch-paiement-v1.png` | Paiement | Généré automatiquement par Stitch |
| `stitch-paiement-v2.png` | Paiement | Corrigé avec nos règles (polices, couleurs, DESIGN.md condensé) |
| `stitch-paiement.jpg` | Photo de concert générée pour la vignette | — |

L'écran sombre « Explorer » n'a pas été livré (génération restée sans résultat au bout de 12 minutes).

## Ce qui tient

- **Couleurs** : Rouge Here pour un seul bouton par écran, noir graphite, gris clair `#F4F4F4`, bordures `#E2E2E2`, vert pour la sécurité. Aucune couleur de marque inventée.
- **Formes** : boutons en pilule de 52 px, cartes arrondies, sélection en contour rouge de 2 px, comme dans nos mockups.
- **Ton** : vouvoiement, FCFA avec espaces des milliers, verbe d'action sur le bouton (« Payer 30 600 FCFA »).
- **Mobile money** : les cinq moyens de paiement sont présents, Orange Money en premier, avec le champ du numéro au format ivoirien (+225).
- **Photo** : artiste africain, lumière rouge et fumée, conforme à `imagery/BRIEFS.md`.

## Ce qui dérive

| Écart | Gravité | Correction |
|---|---|---|
| Poppins et DM Mono absents de la liste de polices de Stitch : remplacés d'office par Epilogue, Work Sans et Space Mono (v1). | Moyenne | v2 : Poppins et DM Mono chargés quand on les impose dans le système de design. Les titres restent en Epilogue. Polices de repli ajoutées à DESIGN.md (Montserrat, JetBrains Mono). |
| Prix en monospace (v1). | Moyenne | Règle explicite ajoutée : « les prix ne sont jamais en monospace ». Corrigé en v2. |
| Jargon : « Un prompt de validation vous sera envoyé », « Réf transaction », « pass numérique », « RÉSEAU 1 ». | Moyenne | Mots ajoutés à la liste « on ne dit pas » de DESIGN.md, avec la formulation attendue. |
| Couleurs des opérateurs (orange, bleu, jaune, cyan) dans les pastilles. | Faible | Légitime pour des logos tiers. Règle ajoutée : couleurs officielles uniquement dans une pastille de 40 px maximum. |
| Étiquette inventée « HERE! VIP PASS ». | Faible | À remplacer par le badge de catégorie standard (« VIP »). |
| Aucun signe propre à la marque (logo, slash, astérisque) sur l'écran de paiement. | Faible | Conforme à nos règles pour un écran d'achat ; montre que la marque doit vivre dans les écrans sombres et la photo. |

## Conclusion

L'identité se transmet bien par les couleurs, les formes et le ton. Les deux points faibles sont la **typographie**, qui dépend des polices disponibles dans l'outil, et le **vocabulaire**, où l'outil réintroduit du jargon de paiement. Les deux sont maintenant couverts par des règles explicites dans `DESIGN.md`. Pour tout outil tiers, il faut fournir le système de design avant la première génération, sinon l'outil invente le sien.
