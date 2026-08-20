# Opportunity Score V0.2

Le score Opportunity mesure un **niveau d'intérêt commercial observable**, pas la solvabilité, la valeur d'entreprise ni une probabilité de vente.

## Lecture correcte

`75/100` signifie que les signaux disponibles produisent un score composite de 75 selon le modèle versionné `opportunity-v0.2-composite`.

Cela ne signifie pas :

- que l'entreprise est meilleure que 75 % des entreprises françaises ;
- qu'elle a 75 % de chances d'acheter ;
- qu'elle est financièrement saine à 75 %.

Le percentile est une information distincte et n'est affiché que lorsqu'un échantillon comparable suffisant existe.

## Pondération

| Axe | Poids | Exemples de preuves |
| --- | ---: | --- |
| Company Health | 25 % | activité, ancienneté, gouvernance, recoupement RNE, comptes publics |
| Growth Signals | 25 % | événements historisés, signaux de mouvement, actualités récentes |
| Digital Presence | 20 % | domaine, visibilité SERP, technologies, présence web |
| Commercial Fit | 30 % | employeur, effectif, multi-sites, contactabilité publique |

Le score global est la somme pondérée des quatre sous-scores, bornée entre 0 et 100.

## Données manquantes

Une absence de données n'est pas assimilée à une mauvaise performance. Pour les axes Growth et Digital, lorsqu'il n'existe pas assez de preuves pour conclure, le moteur utilise une valeur neutre et réduit le niveau de confiance.

La fiche expose séparément :

- le score ;
- les quatre sous-scores ;
- les facteurs ayant contribué au résultat ;
- le niveau de confiance ;
- le pourcentage de couverture des familles de preuves ;
- les familles encore manquantes.

## Confiance

La confiance ne modifie pas mécaniquement le score. Elle indique la densité et la diversité des preuves disponibles.

Exemple : une entreprise peut obtenir un score 70 avec une confiance faible si seules les données légales sont disponibles. La même valeur avec RNE, web, actualités et historique aura une confiance supérieure.

## Benchmark automatique

Le benchmark compare le score à la dernière valeur connue d'entreprises utilisant la **même version de scoring** et appartenant à la même division NAF.

Le moteur n'affiche aucun percentile tant que l'échantillon est inférieur au seuil minimum de 20 entreprises comparables.

Quand le seuil est atteint, la fiche peut afficher par exemple :

```text
Percentile 68 sur 47 entreprises comparables — division NAF 80
```

Ce benchmark s'améliore donc naturellement à mesure que le moteur analyse et historise davantage d'entreprises.

## Versionnement

Toute modification significative des poids ou des règles doit créer une nouvelle version de score. Les benchmarks ne doivent jamais mélanger des versions différentes.
