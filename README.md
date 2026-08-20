# Selykai Company Intelligence Engine

> Comprendre une entreprise avant de la contacter.

Moteur d'intelligence entreprise conçu pour agréger plusieurs sources, conserver la provenance de chaque fait, détecter des changements et produire des scores explicables. Principe d'architecture : **FACT ≠ INFERENCE**.

## État du projet

**Foundation V0.2 — Neon + Workspace foundation**

- recherche live par nom, adresse, SIREN ou SIRET ;
- API Recherche d'entreprises connectée en production ;
- INPI / RNE intégré en source complémentaire optionnelle ;
- garde-fou `diffusionCommerciale` pour la réutilisation de prospection ;
- normalisation en modèle Company commun ;
- faits sourcés avec date, confiance et empreinte stable ;
- snapshots et comparaison avec la précédente observation ;
- détection d'événements factuels ;
- signaux dérivés séparés des faits ;
- Opportunity Score déterministe, versionné et expliqué ;
- timeline persistée ;
- observabilité des providers : statut, latence et erreurs ;
- Neon PostgreSQL dédié en EU Central / Frankfurt ;
- migrations `0001` et `0002` appliquées et testées ;
- workspaces multi-utilisateur ;
- watchlists et fréquences quotidien / hebdomadaire / manuel ;
- alertes dédupliquées ;
- worker interne de surveillance protégé par secret ;
- Managed Neon Auth provisionné ;
- connexion, inscription et espace personnel codés ;
- workspace personnel + watchlist par défaut créés au premier accès.

Le déploiement Vercel applicatif reste volontairement différé jusqu'à validation finale du dépôt et de sa chaîne de build.

## Stack

- Next.js 16.3
- React 19.2
- TypeScript 6
- Neon PostgreSQL 18
- `@neondatabase/serverless`
- Managed Neon Auth via `@neondatabase/auth` **pinné en `0.5.0-beta`**
- CSS natif / design system interne

## Démarrage local

```bash
npm install
cp .env.example .env.local
npm run dev
```

La recherche publique fonctionne sans API commerciale. Neon est nécessaire pour la timeline, les watchlists et les alertes.

## Vérification

```bash
npm run verify
```

Cette commande exécute typecheck, lint puis build. La même chaîne est définie dans GitHub Actions.

## Surfaces

### Public

```text
/                       recherche entreprise
/company/{siren}        fiche Intelligence
/api/v1/companies/...   API normalisée
/api/health             état moteur / DB / auth / sources
```

### Authentifié

```text
/auth/sign-in
/auth/sign-up
/workspace
```

### Interne

```text
/api/internal/monitor
```

Le worker interne exige `CRON_SECRET` et n'est pas une API publique.

## Pipeline d'intelligence

```text
Sources officielles / commerciales
            │
            ▼
      Normalisation
            │
            ▼
       Faits sourcés
            │
      snapshot / diff
            │
            ▼
    Événements factuels
            │
            ▼
     Signaux dérivés
            │
            ▼
     Score explicable
            │
            ▼
       Watchlists
            │
            ▼
         Alertes
```

## Providers

- **API Recherche d'entreprises** — live ;
- **INPI / RNE** — adaptateur prêt, activé uniquement avec identifiants ;
- **APILayer** — prévu ;
- **Hunter** — prévu pour enrichissement contact à la demande.

Chaque provider reste derrière un adaptateur. Le reste de l'application ne dépend pas de son payload brut.

## Base Neon

Projet dédié : `CompanyIntelligenceEngineBySelykai`.

Migrations :

```text
database/migrations/0001_foundation_v0.2.sql
database/migrations/0002_workspaces_watchlists.sql
```

Le schéma cumulé reste disponible dans `database/schema.sql`.

Voir également :

- [`database/README.md`](database/README.md)
- [`docs/neon-vercel.md`](docs/neon-vercel.md)
- [`docs/auth.md`](docs/auth.md)
- [`docs/monitoring.md`](docs/monitoring.md)
- [`docs/providers/inpi-rne.md`](docs/providers/inpi-rne.md)

## Sécurité et conformité

- faits et inférences sont stockés séparément ;
- aucun secret ni connection string dans Git ;
- la BDD n'est jamais exposée directement au navigateur ;
- les accès workspace sont vérifiés côté serveur par appartenance utilisateur ;
- le statut INPI `diffusionCommerciale=false` bloque la logique de prospection ;
- l'enrichissement de contacts doit rester à la demande ;
- si la Data API ou un accès BDD navigateur est ajouté, RLS devient obligatoire avant exposition.

## Prochaines étapes

1. faire passer la chaîne typecheck / lint / build avec la dépendance Neon Auth ;
2. configurer les variables Neon/Auth dans le futur projet Vercel ;
3. tester le parcours inscription → workspace → watchlist en preview ;
4. connecter les identifiants INPI / RNE ;
5. intégrer APILayer derrière des adaptateurs mesurés ;
6. intégrer Hunter avec respect du statut de prospection ;
7. ajouter marquage lu/archivé des alertes et gestion complète des watchlists ;
8. créer le projet Vercel, déployer une preview, valider puis promouvoir en production.
