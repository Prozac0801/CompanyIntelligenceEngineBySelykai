# Selykai Company Intelligence Engine

> Comprendre une entreprise avant de la contacter.

Moteur d'intelligence entreprise multi-source conçu pour consolider des faits, garder leur provenance, détecter les changements et produire une lecture décisionnelle exploitable. Principe d'architecture : **FACT ≠ INFERENCE**.

## État du projet

**Intelligence V0.4 — executive intelligence + legal signals**

- recherche live par nom, adresse, SIREN ou SIRET ;
- API Recherche d'entreprises en source officielle primaire ;
- INPI / RNE en recoupement officiel complémentaire ;
- BODACC / DILA pour événements juridiques, modifications, radiations, procédures et dépôts de comptes ;
- Hunter pour résolution de domaine, firmographie, technologies et contacts à la demande ;
- APILayer pour SERP et actualités lorsque l'accès fournisseur est actif ;
- cache provider dans Neon pour limiter latence et crédits ;
- faits sourcés avec date, confiance et empreinte stable ;
- snapshots, timeline, comparaison entre observations et événements factuels ;
- signaux dérivés stockés séparément des faits ;
- résumé exécutif : forces, vigilances, déclencheurs et next best action ;
- scoring V0.4 séparé en Prospect Fit, Momentum, Commercial Access, Risk Exposure et Data Confidence ;
- `Momentum = données insuffisantes` lorsqu'aucun déclencheur fiable n'est disponible, sans fausse note neutre ;
- analyse financière : CA, résultat, marge nette et évolution lorsque plusieurs exercices existent ;
- libellés métier humains pour formes juridiques, NAF, effectifs et dates ;
- benchmark automatique uniquement lorsqu'un échantillon comparable suffisant est historisé ;
- contacts professionnels enrichis uniquement à la demande et derrière authentification ;
- garde-fou RNE `diffusionCommerciale=false` avant enrichissement contact ;
- watchlists, surveillance quotidienne/hebdomadaire et alertes ;
- previews Vercel en lecture seule par défaut afin de ne pas polluer Neon production ;
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

## Pipeline V0.4

```text
Recherche Entreprises ─┐
INPI / RNE            ─┤
BODACC / DILA         ─┤
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

## Intelligence scoring

La V0.4 ne présente plus un gros score « Opportunity » sans contexte comme vérité centrale. Le moteur expose cinq axes distincts :

- **Prospect Fit** — intérêt structurel : taille, employeur, multi-sites, catégorie ;
- **Momentum** — changements et déclencheurs réellement observés ;
- **Commercial Access** — domaine, points de contact, gouvernance et visibilité ;
- **Risk Exposure** — signaux juridiques BODACC et indicateurs financiers disponibles ;
- **Data Confidence** — couverture réelle des familles de preuves.

Une opportunité immédiate n'est déclarée que si un bon Fit est accompagné d'un Momentum documenté et sans risque rédhibitoire. Sinon le moteur recommande surveillance ou collecte de données supplémentaires. Le champ numérique historique est conservé dans l'API pour compatibilité, mais n'est plus la décision principale de l'interface.

## Providers et coût

Les appels payants ne sont pas tous lancés à chaque action :

- BODACC : cache 6 heures ;
- Hunter Domain Finder : cache 30 jours ;
- Hunter Company Enrichment : cache 30 jours ;
- Hunter Domain Search contacts : uniquement sur action utilisateur, cache 7 jours ;
- APILayer Serpstack : cache 7 jours ;
- APILayer Mediastack : cache 6 heures ;
- Positionstack reste disponible pour une future vue carte mais n'est pas appelé automatiquement.

## Base Neon

Projet dédié : `CompanyIntelligenceEngineBySelykai`.

Migrations :

```text
database/migrations/0001_foundation_v0.2.sql
database/migrations/0002_workspaces_watchlists.sql
database/migrations/0003_bodacc_provider.sql
```

Le schéma cumulé reste disponible dans `database/schema.sql`.

## Sécurité et conformité

- aucun secret dans Git ;
- la BDD n'est pas exposée directement au navigateur ;
- faits et inférences sont séparés ;
- provenance, date d'observation et confiance sont conservées ;
- les previews Vercel ne persistent pas les analyses automatiquement ;
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
