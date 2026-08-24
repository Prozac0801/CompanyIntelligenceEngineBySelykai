# Enrichment providers

## Objectif

L'enrichissement ajoute des preuves utiles sans transformer chaque consultation en cascade d'appels coûteux. Les adaptateurs restent indépendants du reste du produit et toutes les données persistées gardent leur provider, leur date d'observation et leur confiance.

V0.5.10 ajoute deux règles d'exploitation :

1. la présence d'une clé signifie **configuré**, pas automatiquement **sain** ;
2. l'état est suivi par capability lorsque plusieurs produits partagent un fournisseur.

## Hunter

Utilisation automatique dans les analyses qui nécessitent le web :

1. résolution du domaine à partir du nom d'entreprise ;
2. enrichissement entreprise à partir du domaine ;
3. extraction de firmographie et d'empreinte web uniquement après corroboration.

Utilisation à la demande :

- Domain Search pour révéler des contacts professionnels ;
- accessible uniquement à un utilisateur authentifié ;
- bloqué lorsque la politique RNE est `blocked` ou `unknown` ;
- aucun chargement automatique des contacts dans une recherche publique ;
- le flow contact réutilise d'abord la politique commerciale et le domaine persistés lorsqu'ils sont assez frais ;
- le flow contact ne lance pas BOAMP, BODACC, news ou hiring juste pour afficher des contacts.

Cache :

- domaine : 30 jours ;
- entreprise : 30 jours ;
- contacts : 7 jours.

## INPI / RNE

Le supplément INPI normalisé est stocké dans le cache partagé Neon pendant 1 heure avec une clé versionnée par SIREN. Cela évite qu'un nouveau cold start Vercel doive systématiquement refaire authentification + lecture INPI pour une société récemment observée.

Le token en mémoire reste une optimisation locale ; le cache partagé est l'optimisation inter-instance.

## APILayer

Capabilities distinctes :

- `apilayer-serp` — Serpstack / recoupement web ;
- `apilayer-news` — Mediastack / actualités ;
- `apilayer-geo` — Positionstack / géocodage.

Le moteur conserve le mode d'authentification adapté au produit. Serpstack utilise en priorité le header `apikey`, qui est le mode observé comme fonctionnel sur la configuration actuelle.

Cache métier :

- SERP : 7 jours ;
- actualités : 6 heures lorsqu'une réponse valide existe ;
- géocodage : 30 jours lorsqu'il est utilisé.

### Circuit breaker

L'état des capabilities est partagé via `api_cache` et ne nécessite pas de nouvelle table.

- 401/403 : circuit `auth_error` pendant 60 minutes ;
- 429 : circuit `rate_limited` pendant 5 minutes ;
- erreur dégradée/réseau : backoff court de 2 minutes ;
- un succès permet de retrouver un état sain ;
- une panne news ne désactive jamais le SERP ;
- `/api/health` expose capability, statut, date de contrôle et retry, jamais la clé.

Le catalogue public marque la famille APILayer comme `CONFIGURÉ` lorsque la clé existe ; seule la santé capability permet d'affirmer si un produit est réellement utilisable.

## Best effort

Les providers commerciaux et web sont complémentaires. Leur indisponibilité, une limite de quota ou une réponse vide ne doit pas casser l'analyse officielle de base.

Les données officielles restent utilisables et le scoring réduit sa confiance lorsqu'une famille de preuves manque.

## Observabilité

Chaque appel provider peut enregistrer :

- opération ;
- statut HTTP normalisé ;
- latence ;
- erreur réseau / authentification / rate limit ;
- coût estimé lorsqu'il est renseigné.

Sur les requêtes Next.js interactives, V0.5.10 planifie l'écriture `provider_runs` avec `after()` afin que la télémétrie ne prolonge pas inutilement la réponse utilisateur. Hors cycle de requête, le code dispose d'un fallback synchrone sûr.

Les secrets ne sont jamais journalisés et une panne d'observabilité ne doit jamais faire échouer l'intelligence métier.
