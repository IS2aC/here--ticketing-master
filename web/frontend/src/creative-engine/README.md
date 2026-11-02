# Éditeur de cartes (Creative Engine)

Éditeur graphique des cartes d'invitation (Konva, Zustand, Zod). Il vient du dépôt `here--creative-engine`, phases 0 à 8, copié le 02/11/2026 au commit `d3ab1e8`. Ce dossier est désormais la source : le dépôt d'origine ne sert plus que de référence, avec ses tests navigateur, ses ADR et le générateur du catalogue.

Route : `/tableau-de-bord/evenements/[id]/carte/editeur`, en plein écran, uniquement dans le navigateur (`next/dynamic`, `ssr: false`).

## Moteur + Satori

L'éditeur dessine le **décor**. La carte de chaque invité est toujours dessinée par Satori (`lib/card/render.tsx`, « Mon propre modèle ») :

1. Le document contient trois **champs invité** (`slot` sur un élément) :
   - `guest-name` : le nom de l'invité ;
   - `guest-table` : sa table et sa catégorie ;
   - `guest-qr` : le sceau Here! et le QR code.

   L'éditeur les montre avec un invité d'exemple. Le sceau est dessiné par Satori lui-même (route `sceau.png`).
2. **Valider la carte** (`host/guestActions.ts`) :
   - exporte le décor **sans** ces champs, en PNG 1080 × 1350 ;
   - l'envoie comme fond (`PUT /v1/events/{id}/card/background`) ;
   - convertit les champs en `CardLayout` (`PATCH /v1/events/{id}/card`).
3. Ce que `CardLayout` ne sait pas décrire est ramené à ce que Satori sait dessiner (`host/guestFields.ts`) :
   - 3 polices (Playfair Display, Poppins, Great Vibes) ;
   - taille de 18 à 160 ;
   - 5 emplacements pour le QR code.

## Rendu graphique (étape B)

- **Effets.** Les textes, formes et images acceptent des effets facultatifs : `shadow`, `outline` (textes) et `gradient` (textes, rectangles, ellipses). Un document sans effet reste un document v1 valide. L'affichage et l'export passent par les mêmes correspondances (`rendering/konva/mappers.ts`).
- **Couleurs** (`editor/colors.ts`, culori) : contraste WCAG, correction en OKLCH, palette du document, harmonies.
- **Polices** : déclarées dans `styles/fonts.css`, avec leurs fichiers et leurs licences dans `public/creative-engine/fonts`.
- **QR code stylisé** (`lib/card/qr.ts`) :
  - le SVG est dessiné à partir de la matrice de `qrcode`, avec les repères des coins toujours pleins ;
  - le style (`CardLayout.qr_style`) est un réglage de Here!, pas du document de l'éditeur (`host/qrStyle.ts`) ;
  - avant la validation, l'éditeur relit avec jsQR le sceau dessiné par Satori.
- **Champs invité** : ils n'acceptent que les polices et les effets que Satori sait dessiner (`editor/guestSlots.ts`, configuré par `host/setup.ts`). Le nom peut être en Playfair Display, Poppins ou Great Vibes.

## Couches

Les frontières de l'ADR-005 sont imposées par `eslint.config.mjs`.

| Dossier | Rôle |
| --- | --- |
| `domain/` | Modèle de document, schéma, commandes, historique. TypeScript pur, testé sous Node |
| `editor/` | Stores et actions, sans interface ni Konva |
| `rendering/` | Seul endroit où Konva est importé |
| `export/`, `persistence/`, `library/`, `integrations/` | Export, stockage, catalogues, génération d'images (client HTTP) |
| `ui/` | Interface de l'éditeur. La barre du haut accepte les éléments de l'hôte |
| `host/` | **Ce que Here! branche** : stockage serveur, champs invité, validation, démarrage |
| `server/` | Génération d'images côté serveur. Les routes sont dans `app/api/image-generation` (variables `IMAGE_*`) |

## Stockage

`host/hereRepository.ts` gère deux choses :

- **Le document.** Une carte par événement, enregistrée sur le serveur (`card_designs`, concurrence optimiste).
- **Les images.** Elles restent sur l'appareil (IndexedDB) et sont aussi copiées sur le serveur (`card_design_assets`), sous leur empreinte SHA-256. Un autre appareil les télécharge à l'ouverture.

## Fichiers servis par Next

`public/creative-engine/` contient :

- les ornements ;
- les vignettes des modèles ;
- le symbole Here!.

Les documents des modèles se trouvent dans `library/bundled/templates/`. Leur index est `templateDocuments.ts`, à compléter à chaque ajout de modèle, car Turbopack ne connaît pas `import.meta.glob`.

## Tests

- Les tests du domaine et de `host/guestFields.ts` passent avec `npm test`, sous Node.
- Les tests d'interface (jsdom) et ceux du canevas (Chromium) sont restés dans le dépôt d'origine.
