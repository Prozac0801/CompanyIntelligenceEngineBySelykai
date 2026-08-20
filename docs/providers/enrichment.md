# Enrichment providers

## Objectif

L'enrichissement ajoute des preuves utiles sans transformer chaque consultation en cascade d'appels coûteux. Les adaptateurs restent indépendants du reste du produit et toutes les données persistées gardent leur provider, leur date d'observation et leur confiance.

## Hunter

Utilisation automatique :

1. résolution du domaine à partir du nom d'entreprise ;
2. enrichissement entreprise à partir du domaine ;
3. extraction de firmographie et d'empreinte web lorsque disponible.

Utilisation à la demande :

- Domain Search pour révéler des contacts professionnels ;
- accessible uniquement à un utilisateur authentifié ;
- bloqué lorsque le RNE expose une opposition `diffusionCommerciale=false` ;
- aucun chargement automatique des contacts dans une recherche publique.

Cache :

- domaine : 30 jours ;
- entreprise : 30 jours ;
- contacts : 7 jours.

## APILayer

Utilisation automatique :

- Serpstack pour identifier/recouper la présence web et la visibilité organique ;
- Mediastack pour récupérer des actualités puis appliquer un filtre de pertinence local.

Capacité disponible mais non automatique :

- Positionstack pour le géocodage futur d'une vue carte.

Cache :

- SERP : 7 jours ;
- actualités : 6 heures ;
- géocodage, lorsqu'il sera utilisé : 30 jours.

## Best effort

Les providers commerciaux sont complémentaires. Leur indisponibilité, une limite de quota ou une réponse vide ne doit pas casser l'analyse officielle de base.

Les données officielles restent utilisables et le scoring réduit sa confiance lorsqu'une famille d'enrichissement manque.

## Observabilité

Chaque appel provider peut enregistrer :

- opération ;
- statut HTTP normalisé ;
- latence ;
- erreur réseau / authentification / rate limit ;
- coût estimé lorsqu'il sera renseigné.

Les secrets ne sont jamais journalisés.
