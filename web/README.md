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

## « Une question ? » (assistant et équipe Here!)

Dans l'espace organisateur, la carte « Une question ? » ouvre une discussion. Un assistant répond ; s'il ne sait pas (ou sur demande : « Parler à l'équipe Here! »), la question passe à l'équipe, qui répond depuis le portail admin (Messages › Questions ?). L'organisateur voit la réponse dans la même fenêtre.

L'assistant se branche par variables d'environnement, sans toucher au code (détails dans `api/app/assistant`) :

| `ASSISTANT_PROVIDER` | Usage |
|---|---|
| `none` (défaut) | Pas d'assistant : chaque question va à l'équipe. |
| `openai` | API compatible OpenAI : `ASSISTANT_BASE_URL` (…/v1), `ASSISTANT_API_KEY`, `ASSISTANT_MODEL` (par exemple un agent hébergé qui sert Nemotron). L'agent transmet à l'équipe en commençant sa réponse par `[EQUIPE]`. |
| `webhook` | `POST ASSISTANT_BASE_URL` avec `{"conversation_id", "organizer", "messages": [{"role", "content"}]}` ; réponse `{"reply": "…", "escalate": false}`. |

Les messages des organisateurs sont envoyés à l'agent configuré : choisissez un hébergement de confiance. 30 messages par heure et par organisateur au plus.

### Agent hébergé dans Hermes (choix du 07/11)

L'assistant est le profil Hermes Agent `here-support` (Nemotron via OpenRouter), dans le conteneur Hermes déployé par Dokploy sur le même VPS. Chaque profil y fait tourner **sa propre passerelle sur son propre port** : `here-support` écoute sur **8652** (8643 à 8651 sont pris par les autres profils ; vérifier avec la boucle `curl …/health` ci-dessous avant d'en changer). Here! l'appelle en `openai`.

Dans le shell du conteneur Hermes :

```bash
hermes profile create here-support
hermes -p here-support setup                                   # Full setup : OpenRouter + modèle, aucun outil, aucune messagerie
echo "API_SERVER_KEY=$(openssl rand -hex 32)" >> /opt/data/profiles/here-support/.env
printf 'API_SERVER_ENABLED=true\nAPI_SERVER_HOST=0.0.0.0\nAPI_SERVER_PORT=8652\n' >> /opt/data/profiles/here-support/.env
hermes -p here-support config set memory.memory_enabled false  # tous les organisateurs parlent au même profil
hermes -p here-support config set memory.user_profile_enabled false
hermes -p here-support gateway restart
for p in $(seq 8642 8660); do echo "$p $(curl -s -m 2 http://localhost:$p/health)"; done   # ports occupés
```

- **Outils coupés** : `platform_toolsets` vide pour `cli` et `api_server`, et `agent.disabled_toolsets: [terminal, file, code_execution, browser]` dans `/opt/data/profiles/here-support/config.yaml`. À vérifier avec `GET /v1/toolsets` (reste à confirmer au 07/11).
- **Port jamais publié** : ni port public ni domaine. Depuis la VM, `localhost:8652` et l'IP publique ne répondent pas, c'est voulu ; l'IP du conteneur (réseau overlay) non plus. Here! joint Hermes par son nom sur `dokploy-network`.
- **`SOUL.md`** (identité, périmètre, confidentialité, documentation de Here!) est versionné dans `web/hermes/here-support/SOUL.md` : le recopier dans `/opt/data/profiles/here-support/SOUL.md` à chaque modification, puis `gateway restart`. Le tenir d'accord avec `SYSTEM_PROMPT` (`api/app/assistant`).
- **Modèle** : la variante `:free` d'OpenRouter suffit pour tester ; passer à la variante payante avant l'ouverture (limites d'usage, conservation des messages par certains fournisseurs).

Variables du service `here-api` :

```
ASSISTANT_PROVIDER=openai
ASSISTANT_BASE_URL=http://<conteneur ou service Hermes>:8652/v1
ASSISTANT_API_KEY=<API_SERVER_KEY du profil>
ASSISTANT_MODEL=here-support
ASSISTANT_TIMEOUT_SECONDS=60
```

Test depuis la VM, par le conteneur `here-api` (même chemin que l'assistant) :

```bash
docker exec -e K="$K" $A python -c "import os,json,urllib.request as u; r=u.Request('http://$N:8652/v1/chat/completions', data=json.dumps({'model':'here-support','messages':[{'role':'user','content':'Bonjour'}]}).encode(), headers={'Authorization':'Bearer '+os.environ['K'],'Content-Type':'application/json'}); print(json.load(u.urlopen(r, timeout=90))['choices'][0]['message']['content'])"
```

(`A` = conteneur `here-api`, `N` = conteneur Hermes, `K` = clé lue avec `docker exec $N grep '^API_SERVER_KEY=' /opt/data/profiles/here-support/.env | cut -d= -f2`.) Sans réponse dans le délai, la question passe à l'équipe. Documentation : [profils](https://hermes-agent.nousresearch.com/docs/user-guide/profiles), [serveur API](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server), [multi-profils](https://hermes-agent.nousresearch.com/docs/user-guide/multi-profile-gateways).

## Portail admin (équipe Here!)

Un compte devient admin (ou support, pour la conseillère) par une commande, depuis le terminal du conteneur `here-api` (dossier `/app`) (sur Dokploy : onglet du service, « Terminal ») ; le compte doit déjà exister :

```bash
python -m app.admin 07 07 12 34 56            # donne le rôle admin
python -m app.admin 07 07 12 34 56 --support  # conseillère : seulement « Appels et messages »
python -m app.admin 07 07 12 34 56 --retirer  # le retire
```

Les réglages modifiés depuis le portail (prestataire WhatsApp, calendrier proposé des relances, cadence d'envoi) sont gardés en base (`platform_settings`) et remplacent les variables d'environnement du même nom, sans redéployer : l'API les applique tout de suite, le worker à son tour de boucle suivant. Sans réglage en base, la variable d'environnement s'applique.

## Ajouter une migration

Créer `db/migrations/AAAAMMJJHHMMSS_description.sql` avec deux sections `-- migrate:up` et `-- migrate:down`. Ne jamais modifier une migration déjà déployée : en ajouter une nouvelle.
