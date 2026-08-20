# Selykai Company Intelligence Engine

> Comprendre une entreprise avant de la contacter.

Moteur d'intelligence entreprise multi-source conçu pour consolider des faits, garder leur provenance, détecter les changements et produire un score explicable. Principe d'architecture : **FACT ≠ INFERENCE**.

## État du projet

**Intelligence V0.3 — multi-source + scoring composite**

- recherche live par nom, adresse, SIREN ou SIRET ;
- API Recherche d'entreprises en source officielle primaire ;
- INPI / RNE en recoupement officiel complémentaire ;
- Hunter pour résolution de domaine, firmographie, technologies et contacts à la demande ;
- APILayer pour SERP et actualités ;
- cache provider dans Neon pour limiter latence et crédits ;
- faits sourcés avec date, confiance et empreinte stable ;
- snapshots, timeline, comparaison entre observations et événements factuels ;
- signaux dérivés stockés séparément des faits ;
- Opportunity Score V0.2 composite et explicable ;
- quatre sous-scores : Company Health, Growth Signals, Digital Presence, Commercial Fit ;
- couverture des preuves et confiance affichées séparément du score ;
- benchmark automatique par division NAF uniquement lorsqu'un échantillon suffisant est historisé ;
- contacts professionnels enrichis uniquement à la demande et derrière authentification ;
- garde-fou RNE `diffusionCommerciale=false` avant enrichissement contact ;
- watchlists, surveillance quotidienne/hebdomadaire et alertes ;
- animation premium pendant la recherche et l'analyse multi-source ;
- Neon PostgreSQL dédié + Managed Neon Auth ;
- déploiement Vercel sur `companyintengine`.

## Stack

- Next.js 16.3 / React 19.2 / TypeScript 6
- Neon PostgreSQL 18 + `@neondatabase/serverless`
- Managed Neon Auth via `@neondatabase/auth` pinné
- Vercel
- CSS natif / design system interne

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

La même chaîne `typecheck → lint → build` est exécutée dans GitHub Actions avant merge.

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

## Pipeline

```text
Recherche Entreprises ─┐
INPI / RNE            ─┤
Hunter                ─┼─► Normalisation ► Faits sourcés ► Snapshot / diff
APILayer              ─┘                              │
                                                     ▼
                                              Événements factuels
                                                     │
                                                     ▼
                                              Signaux dérivés
                                                     │
                                                     ▼
                                            Score composite V0.2
                                                     │
                                                     ▼
                                              Watchlists / alertes
```

## Opportunity Score

Le score n'est **pas** un percentile arbitraire. Il combine quatre axes pondérés :

- Company Health : 25 % ;
- Growth Signals : 25 % ;
- Digital Presence : 20 % ;
- Commercial Fit : 30 %.

Quand une famille dynamique n'a pas assez de preuves, elle reste neutre plutôt que d'être interprétée comme négative. La confiance dépend séparément de la couverture des sources.

Un percentile sectoriel n'est affiché que lorsque Neon contient au moins un échantillon comparable suffisant avec la même version de scoring. Voir [`docs/scoring.md`](docs/scoring.md).

## Providers et coût

Les appels payants ne sont pas tous lancés à chaque action :

- Hunter Domain Finder : cache 30 jours ;
- Hunter Company Enrichment : cache 30 jours ;
- Hunter Domain Search contacts : uniquement sur action utilisateur, cache 7 jours ;
- APILayer Serpstack : cache 7 jours ;
- APILayer Mediastack : cache 6 heures ;
- Positionstack reste disponible pour une future vue carte mais n'est pas appelé automatiquement.

Voir [`docs/providers/enrichment.md`](docs/providers/enrichment.md).

## Base Neon

Projet dédié : `CompanyIntelligenceEngineBySelykai`.

Migrations appliquées :

```text
database/migrations/0001_foundation_v0.2.sql
database/migrations/0002_workspaces_watchlists.sql
```

Le schéma cumulé reste disponible dans `database/schema.sql`.

## Sécurité et conformité

- aucun secret dans Git ;
- la BDD n'est pas exposée directement au navigateur ;
- faits et inférences sont séparés ;
- provenance, date d'observation et confiance sont conservées ;
- les accès workspace sont vérifiés côté serveur ;
- `diffusionCommerciale=false` bloque l'enrichissement de prospection ;
- les contacts ne sont jamais recherchés massivement par défaut ;
- les réponses de contacts sont `private, no-store` ;
- le worker de surveillance est protégé par secret.

## Documentation

- [`docs/scoring.md`](docs/scoring.md)
- [`docs/providers/enrichment.md`](docs/providers/enrichment.md)
- [`docs/providers/inpi-rne.md`](docs/providers/inpi-rne.md)
- [`docs/auth.md`](docs/auth.md)
- [`docs/monitoring.md`](docs/monitoring.md)
- [`database/README.md`](database/README.md)
