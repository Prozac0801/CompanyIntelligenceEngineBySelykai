# Selykai Company Intelligence Engine

> Comprendre une entreprise avant de la contacter.

Moteur d'intelligence entreprise multi-source conçu pour consolider des faits, conserver leur provenance, détecter les changements et produire une lecture décisionnelle exploitable. Principe d'architecture : **FACT ≠ INFERENCE**.

## État du projet

**Intelligence V0.5.10 — runtime hardening + Momentum + monitoring + executive UI**

- recherche live par nom, adresse, SIREN ou SIRET ;
- API Recherche d'entreprises en source officielle primaire ;
- INPI / RNE en recoupement officiel complémentaire, avec cache partagé 1 h ;
- BODACC / DILA pour événements juridiques, modifications, radiations, procédures et dépôts de comptes ;
- BOAMP / DILA pour les attributions de marchés publics ;
- recrutement vérifié uniquement depuis le site officiel ou un ATS explicitement lié et corroboré ;
- Hunter pour résolution de domaine, firmographie, technologies et contacts professionnels à la demande ;
- APILayer découpé par capability SERP / actualités / géocodage avec circuit breaker partagé ;
- cache provider dans Neon pour limiter latence et crédits ;
- faits sourcés avec date, confiance et empreinte stable ;
- snapshots, timeline, comparaison entre observations et événements factuels ;
- signaux dérivés stockés séparément des faits ;
- Momentum fondé sur des déclencheurs réellement observés : marchés publics, recrutement, implantation, finance, juridique et actualités ;
- résumé exécutif : forces, vigilances, déclencheurs et next best action ;
- scoring séparé en Prospect Fit, Momentum, Commercial Access, Risk Exposure et Data Confidence ;
- `Momentum = données insuffisantes` lorsqu'aucun déclencheur fiable n'est disponible ;
- garde-fou RNE fail-closed : une opposition ou un statut inconnu bloque enrichissement contact et recommandation de prospection ;
- contacts professionnels enrichis uniquement à la demande et derrière authentification ;
- watchlists multiples, navigation par liste et ajout depuis une fiche société ;
- surveillance quotidienne/hebdomadaire, boîte d'alertes, lecture et archivage ;
- monitoring à concurrence bornée avec backoff sur erreurs ;
- chemins d'exécution spécialisés pour éviter une analyse exhaustive lors d'un simple ajout en watchlist ou d'une révélation de contacts ;
- persistance Neon set-based pour réduire les round-trips SQL ;
- télémétrie provider différée avec `after()` sur les requêtes interactives ;
- Vercel Functions ciblées sur `fra1`, au plus près de Neon `eu-central-1` ;
- previews Vercel en lecture seule par défaut afin de ne pas polluer Neon production ;
- Neon PostgreSQL dédié + Managed Neon Auth ;
- système visuel executive tech, sobre et premium, piloté par des tokens avec navigation mobile persistante et surfaces de données cohérentes ;
- palette de recherche globale `Ctrl/⌘ + K`, détection automatique nom/SIREN/SIRET/adresse et navigation clavier des résultats ;
- graphe de décision navigable fondé sur les sources, faits, événements, signaux et la couverture réellement calculés ;
- préchargement des analyses entreprise désactivé dans les listes : aucun pipeline coûteux avant l’intention explicite de l’utilisateur ;
- contrastes AA, focus clavier visible, cibles tactiles renforcées et réduction des animations respectée ;
- déploiement Vercel sur `companyintengine`.

## Stack

- Next.js 16.3 / React 19.2 / TypeScript 6
- Node.js 24.x
- Neon PostgreSQL 18 + `@neondatabase/serverless`
- Managed Neon Auth via `@neondatabase/auth`
- Vitest + ESLint
- Vercel
- CSS natif / design system UI/UX Pro Max adapté à l’identité Selykai

## Démarrage local

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Vérification

```bash
npm run verify
```

La chaîne exécute `test → typecheck → lint → build`. La même barrière est imposée par GitHub Actions avant intégration.

## Surfaces

### Public

```text
/                                      recherche entreprise
/company/{siren}                       fiche Intelligence
/api/v1/companies/search               recherche normalisée
/api/v1/companies/{siren}              analyse multi-source
/api/health                            santé moteur / DB / auth / providers
```

### Authentifié

```text
/auth/sign-in
/auth/sign-up
/workspace
/api/v1/companies/{siren}/contacts     enrichissement contact à la demande
```

### Interne

```text
/api/internal/monitor                  surveillance planifiée protégée par CRON_SECRET
```

## Pipeline Intelligence

```text
Recherche Entreprises ─┐
INPI / RNE            ─┤
BODACC / DILA         ─┤
BOAMP / DILA          ─┤
Site officiel / ATS   ─┤
Hunter                ─┼─► Normalisation ► Faits sourcés ► Snapshot / diff
APILayer              ─┘                              │
                                                     ▼
                                              Événements factuels
                                                     │
                                                     ▼
                                              Signaux dérivés
                                                     │
                                                     ▼
                               Fit · Momentum · Access · Risk · Confidence
                                                     │
                                                     ▼
                              Executive summary · Next best action · Alertes
```

## Profils d'exécution V0.5.10

Le moteur n'utilise plus systématiquement le pipeline exhaustif pour chaque action :

- **interactive** — fiche et analyse utilisateur ;
- **monitoring** — collecte exhaustive, persistence et détection de changements ;
- **contact** — politique commerciale + domaine vérifié, puis Hunter Contacts uniquement si autorisé ;
- **bootstrap** — identité officielle minimale nécessaire à une watchlist ;
- **refresh** — rafraîchissement exhaustif explicite.

Le cockpit V0.6 devra lire l'intelligence déjà calculée et ne lancera pas de providers simplement parce que le workspace est ouvert.

## Intelligence scoring

La release moteur est **0.5.10**, mais le modèle de scoring reste volontairement **`intelligence-v0.5.5`** : le hardening ne change ni les poids ni la sémantique des décisions introduits avec les garde-fous RNE.

Le moteur expose cinq axes distincts :

- **Prospect Fit** — intérêt structurel : taille, employeur, multi-sites, catégorie ;
- **Momentum** — changements et déclencheurs réellement observés ;
- **Commercial Access** — domaine, points de contact, gouvernance et visibilité ;
- **Risk Exposure** — signaux juridiques BODACC et indicateurs financiers disponibles ;
- **Data Confidence** — couverture réelle des familles de preuves.

Une opportunité immédiate n'est déclarée que si un bon Fit est accompagné d'un Momentum documenté, d'un cadre RNE compatible et sans risque rédhibitoire. Sinon le moteur recommande surveillance ou collecte de données supplémentaires.

## Providers, coût et santé

Les appels ne sont pas tous déclenchés à chaque action :

- INPI / RNE : supplément normalisé partagé 1 h entre instances serverless ;
- BODACC : cache 6 heures ;
- Hunter Domain Finder : cache 30 jours ;
- Hunter Company Enrichment : cache 30 jours ;
- Hunter Domain Search contacts : uniquement sur action utilisateur, cache 7 jours ;
- APILayer Serpstack : cache 7 jours ;
- APILayer Mediastack : cache 6 heures lorsqu'il est disponible ;
- Positionstack : disponible pour géocodage mais non appelé automatiquement ;
- un 401/403 APILayer ouvre un circuit de 60 minutes uniquement pour la capability concernée ;
- les états SERP, actualités et géocodage sont indépendants ;
- `/api/health` expose un diagnostic sûr sans révéler les secrets.

La présence d'une clé APILayer signifie désormais **configuré**, pas automatiquement **sain**.

## Monitoring

Le cron quotidien sélectionne uniquement les cibles dues, groupe les watchlists par SIREN et analyse une société une seule fois par batch.

- `MONITOR_BATCH_SIZE` : 20 par défaut, 1–100 ;
- `MONITOR_CONCURRENCY` : 2 par défaut, plafond dur 4 ;
- succès : prochaine échéance quotidienne/hebdomadaire normale ;
- erreur transitoire : nouvelle tentative après 60 minutes ;
- société introuvable : backoff de 7 jours ;
- circuit provider : évite de marteler un fournisseur en erreur.

## Base Neon

Projet dédié : `CompanyIntelligenceEngineBySelykai`.

Migrations actuelles :

```text
database/migrations/0001_foundation_v0.2.sql
database/migrations/0002_workspaces_watchlists.sql
database/migrations/0003_bodacc_provider.sql
database/migrations/0004_momentum_v0.5_providers.sql
```

V0.5.10 n'ajoute aucune migration : le backoff monitoring réutilise `next_check_at` et les circuits providers réutilisent `api_cache`.

Le schéma cumulé reste disponible dans `database/schema.sql`.

## Sécurité et conformité

- aucun secret dans Git ;
- la BDD n'est pas exposée directement au navigateur ;
- faits et inférences sont séparés ;
- provenance, date d'observation et confiance sont conservées ;
- les previews Vercel ne persistent pas les analyses automatiquement ;
- les accès workspace sont vérifiés côté serveur ;
- `diffusionCommerciale=false` bloque l'enrichissement de prospection ;
- l'absence de preuve d'autorisation RNE bloque également l'action commerciale ;
- les contacts ne sont jamais recherchés massivement par défaut ;
- un domaine persisté n'est réutilisé pour les contacts que s'il correspond exactement à une preuve de vérification encore fraîche ;
- les réponses de contacts sont `private, no-store` ;
- le worker de surveillance utilise un Bearer secret comparé en temps constant ;
- les vérifications de sites first-party conservent les protections SSRF.

## Documentation

- [`docs/scoring.md`](docs/scoring.md)
- [`docs/providers/enrichment.md`](docs/providers/enrichment.md)
- [`docs/providers/inpi-rne.md`](docs/providers/inpi-rne.md)
- [`docs/auth.md`](docs/auth.md)
- [`docs/monitoring.md`](docs/monitoring.md)
- [`docs/deployment.md`](docs/deployment.md)
- [`docs/PUBLISHING.md`](docs/PUBLISHING.md)
- [`docs/v0.5.10-runtime-hardening.md`](docs/v0.5.10-runtime-hardening.md)
- [`database/README.md`](database/README.md)
