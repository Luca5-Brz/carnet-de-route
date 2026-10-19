# Carnet de route — V1

PWA personnelle en français pour iPhone : véhicules, événements et trajets kilométriques. HTML, CSS et JavaScript natifs, sans backend, dépendance d’exécution ni outil de compilation.

## Développement local

Depuis le dossier parent du dépôt :

```sh
python3 -m http.server 8001 --bind 127.0.0.1 --directory .
```

Ouvrir le chemin `/carnet-de-route/` sur ce serveur. Le nom du dossier doit être `carnet-de-route`, comme le chemin prévu sur GitHub Pages. Le Service Worker nécessite HTTPS ou localhost. Aucun secret ni variable d’environnement n’est nécessaire.

## Utilisation

- **Accueil** : total kilométrique et accès rapide.
- **Nouveau trajet** : véhicule, événement, date, compteurs entiers et remarque facultative. La distance est calculée ; les compteurs négatifs et une arrivée inférieure au départ sont refusés.
- **Historique** : événements triés par date décroissante → véhicules utilisés → trajets, avec totaux par véhicule et événement. Toucher un trajet pour le modifier ou le supprimer.
- **Gestion** : ajouter et modifier véhicules (nom, immatriculation) et événements (nom, date, lieu), gérer les sauvegardes.

Une suppression demande confirmation. Un véhicule ou événement associé à des trajets ne peut pas être supprimé : réaffecter les trajets auparavant. Modifier les noms ou dates conserve les identifiants et les trajets associés. Aucun jeu de données fictives n’est créé.

## Données et sauvegardes

Les données sont écrites dans **IndexedDB**, base `carnet-route`, après chaque enregistrement. L’interface ne confirme le succès qu’à la fin de la transaction. Une erreur de stockage est affichée sans remplacer l’état affiché par des données non enregistrées.

À la première ouverture, les données du prototype sous la clé `localStorage` `carnet-route-demo-v1` sont migrées si la base IndexedDB est vide. La date d’un ancien événement est déduite de son trajet le plus récent, ou de la date du jour s’il n’a aucun trajet. La copie localStorage reste intacte. En cas de données anciennes invalides, la migration est interrompue et l’erreur affichée.

Dans Gestion :

- **CSV Excel** : UTF-8 avec BOM, séparateur point-virgule, champs entre guillemets, dates ISO et une ligne par trajet. Les cellules commençant par un marqueur de formule sont préfixées d’une apostrophe pour limiter leur interprétation comme formule.
- **JSON** : sauvegarde complète avec `version: 1`, `exportedAt` et `data` contenant les tableaux `vehicles`, `events`, `trips`.
- **Restauration JSON** : maximum 10 Mo, vérification de la version, des champs, dates, identifiants uniques, références et compteurs. Une confirmation indique les quantités avant remplacement atomique de la base. Une sauvegarde invalide conserve les données existantes.

Exportez régulièrement le JSON dans Fichiers/iCloud Drive : supprimer les données Safari ou l’application, perdre l’appareil ou l’éviction du stockage par iOS peut effacer le carnet. Il n’y a pas de synchronisation entre appareils ou navigateurs. Les onglets ouverts simultanément ne synchronisent pas leur état : utiliser un seul onglet pour la saisie.

## Installation sur iPhone et hors ligne

1. Ouvrir le site HTTPS dans Safari avec Internet.
2. Attendre **Hors ligne prêt** (les fichiers de l’application sont mis en cache).
3. Partager → **Sur l’écran d’accueil** → Ajouter.
4. Ouvrir l’icône et vérifier le carnet, puis tester en mode avion.

Le manifeste prévoit `/carnet-de-route/`, les icônes et le mode autonome. Les fichiers sont servis par un Service Worker et les opérations métier utilisent uniquement IndexedDB. Aucune requête réseau n’est nécessaire pour consulter ou enregistrer des trajets hors ligne. Une première visite réussie avec Internet reste nécessaire. Le stockage de l’application installée peut être distinct de celui de Safari selon la version d’iOS : utiliser l’export/import JSON si nécessaire.

Pour une nouvelle livraison, incrémenter `CACHE` dans `sw.js` à chaque changement des fichiers mis en cache. La nouvelle version est téléchargée en arrière-plan et activée après fermeture des anciennes fenêtres ; rouvrir l’application avec Internet. Les mises à jour du cache n’effacent pas IndexedDB.

## Déploiement GitHub Pages

Après validation et fusion de la Pull Request dans `main` du dépôt `Luca5-Brz/carnet-de-route` :

1. Settings → Pages → Deploy from a branch.
2. Choisir `main`, dossier `/ (root)`, puis Save.
3. Attendre la fin du déploiement et ouvrir `https://luca5-brz.github.io/carnet-de-route/`.
4. Vérifier installation iPhone, lancement depuis l’écran d’accueil et mode avion.

Les chemins des ressources et du Service Worker sont relatifs au dossier publié. Le manifeste fixe le chemin de base `/carnet-de-route/`. Aucun backend ni configuration de serveur supplémentaire n’est requis.

## Tests

Node.js 22 ou ultérieur :

```sh
node --test tests/data.test.mjs
```

Ces tests couvrent distances, totaux, regroupement hiérarchique, tri, validation des imports, aller-retour JSON, CSV et migration.

Tests fonctionnels : Python 3, paquet `playwright` et Chromium requis **uniquement pour les tests**. Dans l’environnement cloud préparé, ils sont déjà disponibles. Démarrer le serveur ci-dessus sur le port 8001 puis :

```sh
python3 tests/browser.py
```

Le test utilise `/usr/bin/chromium` et des profils temporaires : création/modification, blocage des suppressions liées, export CSV/JSON, restauration valide et invalide, migration, disposition mobile et création/consultation après coupure réseau et rechargement. Il ne modifie pas votre profil utilisateur. Sur une autre machine, installer Playwright avec `python3 -m pip install playwright` et adapter le chemin de Chromium si nécessaire.

Une vérification manuelle sur un iPhone reste nécessaire pour valider les particularités de Safari, le menu de partage, le téléchargement des sauvegardes et le lancement depuis l’écran d’accueil.
