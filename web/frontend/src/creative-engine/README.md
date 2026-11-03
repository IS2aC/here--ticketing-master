# Éditeur de cartes (Creative Engine)

Éditeur graphique des cartes d'invitation (Konva, Zustand, Zod). Il vient du dépôt `here--creative-engine`, phases 0 à 8, copié le 02/11/2026 au commit `d3ab1e8`. Ce dossier est désormais la source : le dépôt d'origine ne sert plus que de référence, avec ses tests navigateur, ses ADR et le générateur du catalogue.

Route : `/tableau-de-bord/evenements/[id]/carte`, en plein écran, uniquement dans le navigateur (`next/dynamic`, `ssr: false`).

## Moteur + Satori

L'éditeur dessine le **décor**. La carte de chaque invité est toujours dessinée par Satori (`lib/card/render.tsx`, à partir du décor validé et de la mise en page des champs invité) :

1. Le document contient trois **champs invité** (`slot` sur un élément) :
   - `guest-name` : le nom de l'invité ;
   - `guest-table` : sa table et sa catégorie ;
   - `guest-qr` : le sceau Here! et le QR code.

   L'éditeur les montre avec un invité d'exemple. Le sceau est dessiné par Satori lui-même (route `sceau.png`).
2. **Valider la carte** (`host/guestActions.ts`) :
   - exporte le décor **sans** ces champs, en PNG 1080 × 1350 ;
   - l'envoie comme fond (`PUT /v1/events/{id}/card/background`) ;
   - convertit les champs en `CardLayout` (`PATCH /v1/events/{id}/card`) ;
   - prépare les cartes des invités (`POST /v1/events/{id}/invitations`), puis revient à la page de l'événement.
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
- **SVG** :
  - les ornements sont dans `public/creative-engine/ornaments/*.svg` (clés `.svg`), et les `.webp` restent servis pour les anciens documents ;
  - un SVG importé est nettoyé (`persistence/svgFiles.ts`, DOMPurify) ;
  - la teinte (`ImageElement.tint`) est appliquée par `rendering/svgRecolor.ts`, en gardant le modelé, puis servie par `rendering/svgImages.ts` à l'écran et à l'export.
- **Photo** :
  - `ImageElement.mask` (médaillon et fondu) et `ImageElement.adjustments` (réglages) sont facultatifs ;
  - `rendering/photo.ts` produit la photo retouchée (filtres Konva, puis masque) pour l'écran et pour l'export ;
  - le cadrage (`editor/photoCrop.ts`) écrit `crop` aux proportions du cadre, et « Cadrer sur le sujet » passe par smartcrop.js ;
  - `editor/colors.ts` (`dominantColors`) et `rendering/photoPalette.ts` tirent la palette des photos.
- **Modèles** : tous au format de la carte (1080 × 1350). Chacun contient les champs invité (`slot`) et le sceau, déjà à leur place ; `host/templates.test.ts` vérifie les zones de Satori et qu'aucun texte ne les recouvre. À l'ouverture, `ensureGuestFields` y met le nom et la table de l'invité d'exemple de l'événement.
- **Cartes proposées (étape C1)** : `host/proposals/`. La route `…/carte/propositions` (`lib/card/proposals.ts`) demande 3 chartes au fournisseur (`CARD_AI_*`) ou les prend dans `fallback.ts` ; `charter.ts` valide la charte et refuse les textes qui inventent un nom ou un nombre ; `compose.ts` habille un modèle selon la charte, avec les faits de l'événement.
- **Aide à la mise en page (étape C3)** : calculs purs dans `editor/layoutAids.ts` (boîtes englobantes, repères, accroche, alignement, répartition) ; le magnétisme des gestes est dans `rendering/konva/snapping.ts` (repères pris au début du geste, guides dans un store d'interface), les guides dans `SnapGuides.tsx`, les boutons dans `ui/PropertiesPanel/LayoutSection.tsx`.
- **Accueil de la carte (lot D2)** : `host/proposals/CardStartPanel.tsx`, ouvert d'emblée sur une carte vide et par « Nouvelle carte ». « Créer avec l'IA » : la route `…/carte/generer` génère une illustration sans texte à partir du pré-prompt du type d'événement (`lib/card/imagePrompt.ts`), de la demande, des données de l'événement et de 0 à 4 photos de référence (lot D3) ; `aiCard.ts` compose la carte autour (voile au centre, ou en bas avec des photos). « Modèles Here! » : `charterOf` garde le style du modèle, `composeCard` le remplit avec l'événement. Le bouton « Modèles » de la barre d'outils ouvre ce même panneau.
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
