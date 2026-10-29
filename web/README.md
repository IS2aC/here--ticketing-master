# Here! · MVP web

Trois services distincts, orchestrés par [docker-compose.yml](docker-compose.yml) :

| Service | Dossier | Rôle | Port interne |
|---|---|---|---|
| `here-db` | — | PostgreSQL 16 (volume `db-data`) | 5432 |
| `here-migrate` | [db/](db/) | Migrations SQL ([dbmate](https://github.com/amacneil/dbmate)), lancées à chaque démarrage puis arrêtées | — |
| `here-api` | [api/](api/) | FastAPI. Seul service qui accède à la base. Routes métier sous `/v1`, appelées par le frontend et la future app mobile | 8000 |
| `here-frontend` | [frontend/](frontend/) | Next.js. Interface web ; appelle l'API par le réseau interne (`http://here-api:8000`) | 3000 |
| `here-worker` | [api/](api/) | Envoi WhatsApp des invitations et relances (même image que l'API, `python -m app.worker`). Un seul par numéro WhatsApp | — |

Ordre de démarrage : `here-db` (sain) → `here-migrate` (terminé) → `here-api` (saine) et `here-worker` → `here-frontend`.

Les services sont préfixés `here-` : sur Dokploy, tous les projets partagent le réseau `dokploy-network`, et un service nommé `api` ou `db` y entrerait en collision avec celui d'un autre projet.

Par défaut, `WHATSAPP_PROVIDER=console` : **aucun message WhatsApp ne part**, ils sont écrits dans les journaux du worker (`docker compose logs -f worker`). Pour envoyer pour de vrai, voir « Envoi WhatsApp » dans [docs/SPECIFICATIONS.md](../docs/SPECIFICATIONS.md).

## Lancer en local

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

- Frontend : http://localhost:3000
- API : http://localhost:8000/v1 · documentation : http://localhost:8000/docs · santé : http://localhost:8000/health
- Base : `localhost:5433` (utilisateur et mot de passe de `.env`)

`docker-compose.local.yml` ne fait qu'ouvrir les ports sur la machine ; il ne sert pas sur Dokploy.

## Développer sans Docker

Base seule : `docker compose -f docker-compose.yml -f docker-compose.local.yml up here-db here-migrate`, puis :

```bash
cd api && uv sync && DATABASE_URL=postgres://here:changez-moi@localhost:5433/here uv run uvicorn app.main:app --reload
```

```bash
cd frontend && npm install && API_URL=http://localhost:8000 npm run dev
```

## Déployer sur Dokploy

1. Créer une application **Docker Compose** sur ce dépôt, chemin du fichier : `web/docker-compose.yml`.
2. Onglet **Environment** : reprendre `.env.example` (au minimum `POSTGRES_PASSWORD`, `CORS_ORIGINS` et `PUBLIC_APP_URL` avec le domaine du frontend ; pour WhatsApp : `WHATSAPP_PROVIDER=wasender`, `WASENDER_API_KEY`, `WASENDER_WEBHOOK_SECRET`).
3. Onglet **Domains** : `here-frontend` sur le port 3000, `here-api` sur le port 8000 (domaine distinct, utilisé aussi par l'app mobile).
4. Déployer. Les migrations s'appliquent automatiquement avant le démarrage de l'API.

## Sécurité de la connexion

- **Tentatives limitées** : 5 échecs sur un même compte, ou 20 depuis une même adresse IP, en 15 minutes : suspension de 15 minutes (« Trop de tentatives. Réessayez dans … minutes. »). Pour lever une suspension à la main (base de données) : `DELETE FROM login_attempts WHERE identifier = '+2250700000000';`.
- **Mot de passe oublié** (`/mot-de-passe-oublie`) : un code à 6 chiffres est envoyé par WhatsApp au numéro du compte. En mode test (`WHATSAPP_PROVIDER=console`), rien ne part : le code apparaît dans les journaux de `here-api` (« WhatsApp (console, non envoyé) »).
- Le frontend transmet à l'API l'adresse IP et le navigateur du visiteur (en-têtes `X-Forwarded-For` et `User-Agent`). L'API étant aussi joignable sur son propre domaine, cet en-tête peut y être falsifié : la limite par compte, elle, ne dépend pas de l'adresse.

## Portail admin (équipe Here!)

Un compte devient admin par une commande, depuis le terminal du conteneur `here-api` (sur Dokploy : onglet du service, « Terminal ») ; le compte doit déjà exister :

```bash
python -m app.admin 07 07 12 34 56            # donne le rôle admin
python -m app.admin 07 07 12 34 56 --retirer  # le retire
```

Les réglages modifiés depuis le portail (prestataire WhatsApp, calendrier proposé des relances, cadence d'envoi) sont gardés en base (`platform_settings`) et remplacent les variables d'environnement du même nom, sans redéployer : l'API les applique tout de suite, le worker à son tour de boucle suivant. Sans réglage en base, la variable d'environnement s'applique.

## Ajouter une migration

Créer `db/migrations/AAAAMMJJHHMMSS_description.sql` avec deux sections `-- migrate:up` et `-- migrate:down`. Ne jamais modifier une migration déjà déployée : en ajouter une nouvelle.
