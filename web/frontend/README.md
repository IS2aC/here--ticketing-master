# Here! · frontend (Next.js)

Interface web de Here!. Ne parle jamais directement à la base : toutes les données passent par l'API (`API_URL`, `http://api:8000` dans Docker).

- Identité visuelle : copie de `uiux/visual-identity` dans `src/styles/brand/` (tokens, polices, preset Tailwind) et `public/brand/` (logos). Règles : `uiux/visual-identity/DESIGN.md`.
- Santé : `GET /api/health`.

```bash
npm install
API_URL=http://localhost:8000 npm run dev
npm run lint
npm run build
```

Déploiement et infrastructure : voir [../README.md](../README.md).
