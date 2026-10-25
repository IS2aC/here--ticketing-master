# Here! · Ticketing Master — Identité visuelle

*Vos événements méritent plus qu'un simple billet.*

v2 (25/10/2026) : invitations personnalisées sur WhatsApp, relances et appels, accueil au QR code. La billetterie viendra plus tard.

Vue d'ensemble : **`brand-board.png`** · Règles pour les agents et développeurs : **`DESIGN.md`**

## Intégration

```html
<link rel="stylesheet" href="visual-identity/typography/fonts.css">
<link rel="stylesheet" href="visual-identity/tokens/tokens.css">
```

```js
// tailwind.config.js
module.exports = { presets: [require('./visual-identity/tokens/tailwind.preset.js')] };
```

## Contenu

| Chemin | Contenu |
|---|---|
| `brand.json` | Source unique de vérité : couleurs (dont statuts de confirmation et couleurs de modèles de cartes), rôles sémantiques, mode sombre, contrastes, typographie, espacements, rayons, ombres. Modifier ici puis relancer les scripts. |
| `DESIGN.md` | Direction artistique applicable : système à deux étages (hôte / Here!), sceau, modèles de cartes, statuts, composants, logo, images, mouvement, trois voix. |
| `brand-board.html` / `.png` | Planche de marque (1600 px, export ×2). |
| `strategy/brief.md` | Plateforme de marque v2 validée (invitations). La v1 billetterie est dans `brief-v1-billetterie.md`. |
| `strategy/directions.md` | Les trois pistes d'affinage et la combinaison retenue (v1). |
| `strategy/ajustements.md` | Ajustements de l'identité pour les invitations (v2). |
| `logo/svg/` | `logo-principal`, `logo-horizontal`, `logo-negatif`, `logo-negatif-horizontal`, `logo-mono-noir`, `logo-blanc`, `symbole` (512×512), `favicon`. 100 % vectoriels. |
| `logo/png/` | Chaque logo en 512, 1024 et 2048 px de large, fond transparent. |
| `logo/favicon/` | `favicon.ico`, PNG 16 à 512, `apple-touch-icon.png`, `site.webmanifest`. |
| `colors/palette.json` / `.png` | Palette (HEX, RVB, TSL, CMJN) et contrôles de contraste WCAG. |
| `typography/fonts/` | Poppins, Inter, DM Mono, Playfair Display en TTF (licence OFL). |
| `typography/fonts.css` | `@font-face` locaux (généré). |
| `typography/fonts-italic.css` | Poppins ExtraBold Italic (campagnes) et Playfair Display Italic (cartes), maintenu à la main. |
| `typography/specimen.png` | Spécimen et échelle typographique. |
| `tokens/tokens.css` | Variables CSS, mode sombre (`data-theme`), classes `.text-*`. |
| `tokens/tokens.json` | Tokens au format W3C DTCG. |
| `tokens/tailwind.preset.js` | Preset Tailwind. |
| `elements/icons/` | 52 pictogrammes au trait (`currentColor`), dont les types d'événements et les statuts. |
| `elements/` | `slash-fin`, `slash-epais`, `motif-slash`, `asterisque`. |
| `imagery/BRIEFS.md` | Briefs photo v2 (registres jour et nuit) et prompts, avec les noms de fichiers attendus. `BRIEFS-billetterie.md` : briefs v1. |
| `stitch/` | Test en contexte avec Stitch : captures et analyse (`ANALYSE.md`). |
| `mockups/` | Écrans HTML + PNG. Tableau de bord : `backoffice-tableau-de-bord`, `-creation`, `-import`, `-carte`, `-relances`. Mobile : `mobile-message`, `mobile-invite`, `mobile-invite-qr`, `mobile-tableau-de-bord`, `mobile-scan`. États : `backoffice-etats`, `mobile-scan-deja-entre`, `mobile-scan-inconnu`, `mobile-scan-hors-connexion`, `mobile-invite-reponse-non`. Responsive : `backoffice-tablette` (834 px). Cartes : `carte-ceremonie`, `-rendez-vous`, `-officiel`, `-hommage`, `-soiree`. Partagés : `_backoffice.css/.js`, `_mobile.css`, `_carte.css`, `_icons.js`. |
| `mockups/archive-billetterie/` | Écrans et planche v1 (billetterie), à reprendre plus tard. |

## Régénérer

Les scripts sont dans le skill `visual-identity` (`scripts/`). Depuis la racine du projet :

```bash
python3 <skill>/scripts/build_tokens.py visual-identity     # après une modification de brand.json
python3 <skill>/scripts/export_assets.py visual-identity    # PNG, favicons, planche, mockups (lancer deux fois si les mockups ont changé : la planche les réutilise)
python3 <skill>/scripts/check_deliverables.py visual-identity
```

## Photos

Déposez les images dans `imagery/` sous les noms de `imagery/BRIEFS.md`, puis relancez `export_assets.py` deux fois : la planche et les mockups remplacent automatiquement les emplacements provisoires.
