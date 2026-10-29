# Here! · frontend (Next.js)

Interface web de Here!. Ne parle jamais directement à la base : toutes les données passent par l'API (`API_URL`, `http://here-api:8000` dans Docker).

- Identité visuelle : copie de `uiux/visual-identity` dans `src/styles/brand/` (tokens, polices, preset Tailwind) et `public/brand/` (logos). Règles : `uiux/visual-identity/DESIGN.md`.
- Pages : `/` (accueil), `/inscription`, `/connexion`, `/tableau-de-bord` (liste des événements), `/tableau-de-bord/evenements/nouveau`, `/tableau-de-bord/evenements/[id]` (vue de l'événement et liste des invités), `/[id]/modifier`, `/[id]/invites/importer` puis `/[id]/invites/importer/[importId]` (aperçu avant import), `/modele-invites.xlsx` (modèle Excel), `/[id]/carte` (étape 3 : la carte), `/tableau-de-bord/cartes` (bibliothèque), `/i/[jeton]` (page invité : répondre, QR code d'entrée, `/i/[jeton]/agenda.ics`), `/[id]/acces` (liens de scan), `/scan/[jeton]` (écran des agents d'accueil : caméra + jsQR, code saisi, recherche par nom ; la caméra exige https, sauf sur localhost).
- Cartes d'invitation : une par type d'événement (`src/lib/card/library.ts`), dessinées en PNG 1080 × 1350 par `src/lib/card/render.tsx` (`next/og`) : même rendu pour l'aperçu et pour l'image envoyée à l'invité (`/i/[jeton]/carte.png`). `PUBLIC_APP_URL` fixe le lien porté par le QR code.
- Session : le jeton de l'API est gardé dans un cookie httpOnly `here_session` (Server Actions dans `src/app/(auth)/actions.ts`) ; le navigateur n'appelle jamais l'API directement. `COOKIE_SECURE=false` seulement pour tester en HTTP ailleurs que sur localhost.
- Santé : `GET /api/health`.

```bash
npm install
API_URL=http://localhost:8000 npm run dev
npm run lint
npm run build
```

Déploiement et infrastructure : voir [../README.md](../README.md).
