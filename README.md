# Cosmos

Application de gouvernance personnelle : un **Cosmos** est un grand domaine de vie (pièce), un **Mini-cosmos** un terrain que tu gouvernes à l'intérieur (meuble), avec objectif, seuils Alerte/Kill, étapes et statut.

## Fichiers

- `Cosmos.dc.html` — l'application (tableau, modèles, statistiques, journal). S'ouvre directement dans un navigateur.
- `support.js` — runtime nécessaire à `Cosmos.dc.html` (même dossier).
- `schema.md` — modèle de données et SQL pour la future base.

## Utilisation

Ouvrir `Cosmos.dc.html` dans un navigateur (via un petit serveur local, ex. `npx serve .`). Les données sont sauvegardées localement dans le navigateur ; le menu Données (icône base) permet d'exporter / importer un JSON et de restaurer l'exemple.

## Pousser sur GitHub

```bash
git init
git add .
git commit -m "Cosmos — prototype"
git branch -M main
git remote add origin https://github.com/mamadd88/cosmos.git
git push -u origin main
```
