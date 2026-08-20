# Selykai Company Intelligence Engine

> Comprendre une entreprise avant de la contacter.

Moteur d'intelligence entreprise conçu pour agréger plusieurs sources, conserver la provenance de chaque fait, détecter des changements et produire des scores explicables. Le principe d'architecture est strict : **FACT ≠ INFERENCE**.

## État du projet

**Foundation V0.2**

- recherche live par nom, adresse, SIREN ou SIRET ;
- source connectée : API Recherche d'entreprises (publique / officielle) ;
- normalisation en modèle Company commun ;
- faits sourcés avec date, confiance et empreinte stable ;
- comparaison avec la précédente observation ;
- détection d'événements factuels ;
- signaux dérivés séparés des faits ;
- snapshots historiques prêts pour Neon ;
- fiche entreprise avec score, signaux et timeline ;
- Opportunity Score déterministe, versionné et expliqué ;
- API interne versionnée ;
- persistance Neon optionnelle : le moteur reste utilisable sans BDD ;
- schéma PostgreSQL v0.2 prêt pour une base Neon dédiée ;
- APILayer, INPI/RNE et Hunter préparés comme prochaines sources.

Le déploiement Vercel reste volontairement différé jusqu'à validation complète du dépôt et de la base.

## Stack

- Next.js 16.3
- React 19.2
- TypeScript
- Neon serverless driver, activé seulement quand `DATABASE_URL` existe
- CSS natif / design system interne

## Démarrage local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Aucune clé API commerciale n'est nécessaire pour la recherche de base.

## Vérifications

```bash
npm run verify
```

Cette commande exécute typecheck, lint puis build. La même chaîne est définie dans GitHub Actions.

## API

### Recherche

```http
GET /api/v1/companies/search?q=selykai
```

### Analyse entreprise

```http
GET /api/v1/companies/{siren}
```

La réponse contient l'entreprise normalisée, les faits, les nouveaux événements détectés, les signaux, le score et les métadonnées moteur.

### Timeline

```http
GET /api/v1/companies/{siren}/timeline
```

La timeline nécessite la base Neon dédiée afin de comparer plusieurs observations.

### Santé

```http
GET /api/health
```

## Architecture

```text
Client / SaaS
    │
    ▼
Selykai Company Intelligence API
    │
    ├─ Recherche Entreprises   [LIVE]
    ├─ INPI / RNE              [NEXT]
    ├─ APILayer                [NEXT]
    └─ Hunter                  [NEXT]
    │
    ▼
Normalisation
    │
    ▼
Faits sourcés + empreintes
    │
    ├─ comparaison historique → événements factuels
    │                              ↓
    │                          signaux dérivés
    │
    └─ score explicable/versionné
    │
    ▼
Neon PostgreSQL dédié
```

Le code applicatif consomme le modèle normalisé, jamais directement le payload d'un fournisseur. Une API peut donc être remplacée sans casser l'ensemble du produit.

## Modèle de données

Le schéma V0.2 sépare notamment :

- entreprises et établissements ;
- personnes publiques ;
- domaines et futurs contacts enrichis ;
- faits sources ;
- snapshots ;
- événements ;
- signaux ;
- scores ;
- exécutions fournisseurs et coûts ;
- cache API.

## Données et conformité

- Chaque fait conserve source, date d'observation et niveau de confiance.
- Une inférence ne peut jamais écraser un fait.
- Les contacts professionnels seront enrichis à la demande, pas collectés massivement par défaut.
- Les conditions de licence et de réutilisation de chaque fournisseur doivent être validées avant activation en production.
- Aucun secret ni connection string ne doit être commité dans Git.

## Neon

L'organisation Neon accessible est gérée par Vercel et refuse la création directe d'un nouveau projet via l'API Neon. La base dédiée doit donc être provisionnée via l'intégration Neon du Vercel Marketplace, sans réutiliser la base d'un autre produit Selykai.

Voir [`docs/neon-vercel.md`](docs/neon-vercel.md).

## Roadmap immédiate

1. faire passer typecheck / lint / build sur la branche ;
2. provisionner le Neon dédié via Vercel Marketplace ;
3. tester `database/schema.sql` sur une branche Neon temporaire ;
4. appliquer la migration validée sur la branche principale Neon ;
5. connecter INPI/RNE ;
6. ajouter APILayer et Hunter derrière des adaptateurs ;
7. watchlists, alertes et jobs de surveillance ;
8. authentification et multi-tenant ;
9. créer le projet Vercel, déployer une preview puis la production.
