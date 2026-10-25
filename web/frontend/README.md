# Here! · frontend (Next.js)

Interface web de Here!. Ne parle jamais directement à la base : toutes les données passent par l'API (`API_URL`, `http://api:8000` dans Docker).

- Identité visuelle : copie de `uiux/visual-identity` dans `src/styles/brand/` (tokens, polices, preset Tailwind) et `public/brand/` (logos). Règles : `uiux/visual-identity/DESIGN.md`.
- Pages : `/` (accueil), `/inscription`, `/connexion`, `/tableau-de-bord` (liste des événements), `/tableau-de-bord/evenements/nouveau`, `/tableau-de-bord/evenements/[id]` (vue de l'événement) et `/[id]/modifier`.
- Session : le jeton de l'API est gardé dans un cookie httpOnly `here_session` (Server Actions dans `src/app/(auth)/actions.ts`) ; le navigateur n'appelle jamais l'API directement. `COOKIE_SECURE=false` seulement pour tester en HTTP ailleurs que sur localhost.
- Santé : `GET /api/health`.

```bash
npm install
API_URL=http://localhost:8000 npm run dev
npm run lint
npm run build
```

Déploiement et infrastructure : voir [../README.md](../README.md).
