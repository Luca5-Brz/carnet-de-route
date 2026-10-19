# Carnet de route — Prototype V1

Application de suivi de kilomètres pour iPhone, en mode sombre.

## Fichiers

- `index.html` : structure HTML
- `css/style.css` : thème sombre et mise en page
- `js/app.js` : navigation, véhicules, événements, trajets et statistiques

## Déploiement GitHub Pages

Déposer `index.html`, le dossier `css` et le dossier `js` à la racine
de la branche `main`. Dans Settings > Pages, publier depuis `main` / `(root)`.

## Données

Ce prototype utilise `localStorage` avec la clé `carnet-route-demo-v1`.
La clé n'a pas changé : les données existantes sur le même navigateur
et la même origine GitHub Pages seront conservées.

Attention : les données fictives ne sont chargées que lors de la toute
première utilisation. Le stockage est local à chaque navigateur/appareil.
Ce prototype n'est pas encore une PWA hors ligne complète.
