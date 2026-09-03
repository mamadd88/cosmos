# Cosmos

Application de gouvernance personnelle. Un **Cosmos** est un grand domaine de vie (une pièce) ; un **Mini-cosmos** est un terrain que tu gouvernes à l'intérieur (un meuble) : objectif, valeur actuelle, entropie et réponse, seuils Alerte / Kill, SAS d'entrée, étapes, échéance et projection dans le temps.

## Fichiers

- `Cosmos.dc.html` — l'interface (Tableau, Modèles, Statistiques, Journal). S'ouvre dans un navigateur.
- `cosmos-core.js` — le cœur métier, sans UI : statuts calculés, projection, système de dates, migration, données d'exemple, modèles. Réutilisable côté serveur.
- `support.js` — runtime nécessaire à `Cosmos.dc.html`.
- `schema.md` — modèle de données et SQL pour la future base.

## Pages (routes)

`#/tableau` · `#/tableau/<id>` (ouvre un mini-cosmos) · `#/modeles` · `#/statistiques` · `#/journal`

## Principes

- Le statut est calculé (SAS → Actif) ; seuls Pause et Clôturé sont manuels.
- Une échéance est une date (précise, fin de mois / trimestre / année) ou Permanent.
- La projection alerte sur le temps ; la valeur actuelle face aux seuils se juge à l'œil — jamais de corrélation automatique.
- L'assistant IA (volet gauche d'un mini-cosmos) relit ce que tu as écrit et propose ; rien n'est appliqué sans clic, tout est tracé dans le Journal.

## Données

Sauvegarde locale automatique (ce navigateur). Menu Données (icône base, en haut à droite) : exporter / importer un JSON, restaurer l'exemple. Le journal garde 12 mois en local, le reste part dans l'archive incluse dans l'export.

## Lancer

```bash
npx serve .
```

## Pousser sur GitHub

```bash
git init && git add . && git commit -m "Cosmos — prototype"
git branch -M main
git remote add origin https://github.com/mamadd88/cosmos.git
git push -u origin main
```
