# Publication production

Ce document transforme le dépôt vérifié en déploiement Vercel reproductible. Aucun secret ne doit être ajouté à Git, à une archive de livraison ou à un commentaire de pull request.

## 1. Barrière de qualité

Depuis un environnement Node.js 24 :

```bash
npm ci --no-audit --no-fund
npm run verify
```

La publication ne doit continuer que si les tests, le typecheck, ESLint et le build Next.js sont tous verts. GitHub Actions exécute la même barrière sur la pull request et sur `main`.

## 2. Configuration Vercel

- projet : `companyintengine` ;
- branche de production : `main` ;
- région des fonctions : `fra1` via `vercel.json` ;
- version Node.js : `24.x` via `package.json` ;
- build : détection automatique Next.js ;
- origine publique : `https://companyintengine.vercel.app` ou le domaine définitif.

Renseigner au minimum dans l’environnement **Production** :

```text
DATABASE_URL
NEON_AUTH_BASE_URL
NEON_AUTH_COOKIE_SECRET
CRON_SECRET
NEXT_PUBLIC_APP_URL
```

Les fournisseurs sont optionnels mais nécessaires à l’intelligence complète :

```text
INPI_USERNAME
INPI_PASSWORD
APILAYER_API_KEY
HUNTER_API_KEY
```

Réglages optionnels :

```text
MONITOR_BATCH_SIZE=20
MONITOR_CONCURRENCY=2
```

`NEON_AUTH_COOKIE_SECRET` doit contenir au moins 32 caractères. `NEXT_PUBLIC_APP_URL` doit être l’origine HTTPS finale, sans chemin. Les valeurs de `.env.example` sont des noms et des exemples, jamais des secrets de production.

## 3. Base de données

Connecter la ressource Neon `CompanyIntelligenceEngineBySelykai`, région AWS `eu-central-1`, puis vérifier l’application des migrations `0001` à `0004` décrites dans [`database/README.md`](../database/README.md).

Ne pas exécuter une migration destructive pendant le déploiement applicatif. V0.5.10 n’ajoute aucune migration.

## 4. Publication

La configuration désactive volontairement les déploiements Git automatiques des branches `feature/*`, `feat/*`, `fix/*` et `chore/*`. Le chemin normal est :

1. obtenir une CI verte sur la pull request ;
2. intégrer la branche dans `main` ;
3. laisser Vercel construire le commit de `main` ;
4. promouvoir uniquement un déploiement dont le build est vert.

Pour une prévisualisation manuelle avant intégration, utiliser le projet Vercel lié et déployer sans `--prod`. Vérifier que l’environnement Preview ne dispose pas de droits d’écriture production inutiles.

## 5. Smoke test production

Après publication :

1. ouvrir `/` et tester une recherche par nom, SIREN, SIRET et adresse ;
2. ouvrir une fiche entreprise, puis vérifier sources, faits, événements, signaux, graphe de décision et états de confiance ;
3. tester `Ctrl/⌘ + K`, la navigation clavier, le mobile et les états sans résultat ;
4. tester inscription, connexion, workspace, watchlist et déconnexion ;
5. appeler `/api/health` et contrôler base, auth, schéma et diagnostics providers ;
6. vérifier `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml` et l’aperçu social ;
7. confirmer que les fonctions s’exécutent en `fra1` et qu’aucun secret n’apparaît dans les réponses ou les logs ;
8. déclencher le monitor avec son Bearer secret depuis un environnement autorisé, puis vérifier l’absence de doublons et d’erreurs provider répétées.

## 6. Critères go/no-go

**Go** : CI verte, migrations présentes, healthcheck sain, auth fonctionnelle, recherche opérationnelle, aucune fuite de secret, latence et erreurs providers acceptables.

**No-go** : build rouge, base ou auth indisponible, schéma incomplet, boucle d’appels provider, enrichissement contact sans politique RNE valide, ou erreurs runtime nouvelles.

## 7. Retour arrière

En cas de régression, réaffecter immédiatement le domaine au dernier déploiement Vercel sain. Conserver les logs et identifiants de déploiement pour l’analyse. Le retour arrière applicatif ne doit pas tenter de supprimer des données Neon.
