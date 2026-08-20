# Selykai Company Intelligence Engine

> Comprendre une entreprise avant de la contacter.

Moteur d'intelligence entreprise conçu pour agréger plusieurs sources, conserver la provenance de chaque fait, détecter des changements et produire des scores explicables. Le principe d'architecture est strict : **FACT ≠ INFERENCE**.

## État du projet

**Foundation V0.1**

- recherche live par nom, adresse, SIREN ou SIRET ;
- source connectée : API Recherche d'entreprises (publique / officielle) ;
- normalisation en modèle Company commun ;
- fiche entreprise ;
- provenance et confiance visibles ;
- Opportunity Score V0.1 déterministe et expliqué ;
- API interne versionnée ;
- schéma PostgreSQL prêt pour une base Neon dédiée ;
- APILayer, INPI/RNE et Hunter préparés comme prochaines sources.

La base Neon et le déploiement Vercel ne sont volontairement **pas** créés à ce stade. Le Git doit d'abord être validé proprement.

## Stack

- Next.js 16.3
- React 19.2
- TypeScript
- Neon serverless driver (activé seulement quand `DATABASE_URL` existe)
- CSS natif / design system interne

## Démarrage local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Aucune clé API n'est nécessaire pour la recherche V0.1.

## Vérifications

```bash
npm run typecheck
npm run lint
npm run build
```

## API

### Recherche

```http
GET /api/v1/companies/search?q=selykai
```

### Fiche enrichie

```http
GET /api/v1/companies/{siren}
```

### Santé

```http
GET /api/health
```

## Architecture cible

```text
Client / SaaS
    │
    ▼
Selykai Company Intelligence API
    │
    ├─ Provider officiel : Recherche Entreprises  [LIVE]
    ├─ Provider officiel : INPI / RNE             [NEXT]
    ├─ Provider web      : APILayer               [NEXT]
    └─ Provider contact  : Hunter                 [NEXT]
    │
    ▼
Normalisation → faits sourcés → événements → scoring → inférences
    │
    ▼
Neon PostgreSQL (dédié)
```

## Données et conformité

- Les faits doivent conserver leur source, date d'observation et niveau de confiance.
- Une inférence ne doit jamais écraser un fait.
- Les données personnelles de contacts professionnels seront enrichies à la demande et non collectées massivement par défaut.
- Les conditions de licence et de réutilisation de chaque fournisseur devront être enregistrées avant activation en production.

## Roadmap immédiate

1. valider build/lint/typecheck ;
2. connecter INPI/RNE et créer la timeline d'événements ;
3. ajouter persistance et snapshots dans un nouveau projet Neon dédié ;
4. ajouter APILayer / Hunter via adaptateurs ;
5. watchlists et alertes ;
6. authentification et multi-tenant ;
7. déploiement Vercel après validation du dépôt.
