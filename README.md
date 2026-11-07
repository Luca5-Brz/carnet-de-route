# Carnet de route — V1.3

PWA personnelle en français pour iPhone : véhicules, événements et trajets kilométriques. HTML, CSS et JavaScript natifs, sans backend, dépendance d’exécution ni outil de compilation.

## Développement local

Depuis le dossier parent du dépôt :

```sh
python3 -m http.server 8001 --bind 127.0.0.1 --directory .
```

Ouvrir le chemin `/carnet-de-route/` sur ce serveur. Le nom du dossier doit être `carnet-de-route`, comme le chemin prévu sur GitHub Pages. Le Service Worker nécessite HTTPS ou localhost. Aucun secret ni variable d’environnement n’est nécessaire.

## Utilisation

- **Accueil** : total kilométrique et accès rapide.
- **Nouveau trajet** : choisir « Trajet complet » pour saisir les deux compteurs, ou « Démarrer un trajet — En cours » pour saisir uniquement le départ. Véhicule, événement et date sont requis ; la remarque est facultative. Les compteurs doivent être des entiers positifs ou nuls, et l’arrivée ne peut pas être inférieure au départ.
- **Historique** : événements triés par date décroissante → véhicules utilisés → trajets, avec totaux par véhicule et événement. Toucher un trajet pour le modifier ou le supprimer.
- **Gestion** : ajouter et modifier véhicules (nom, immatriculation) et événements (nom, date, lieu), gérer les sauvegardes.

### Trajets en cours

Plusieurs trajets peuvent être en cours sur des véhicules différents, avec **un seul trajet en cours par véhicule**. La règle est vérifiée lors de la création, modification et restauration JSON. Un trajet complet reste saisissable même si le véhicule a un autre trajet en cours.

L’Accueil affiche chaque trajet en cours avec « Terminer le trajet ». Cet écran demande uniquement le compteur d’arrivée, calcule la distance et conserve la date, l’événement et la remarque du départ. Une arrivée égale au départ est autorisée (0 km). L’historique conserve la hiérarchie Événement → Véhicules → Trajets et permet de modifier ou supprimer aussi les trajets en cours. **Seuls les trajets terminés contribuent aux totaux kilométriques**, y compris à l’Accueil.

Une suppression demande confirmation. Un véhicule ou événement associé à des trajets ne peut pas être supprimé : réaffecter les trajets auparavant. Modifier les noms ou dates conserve les identifiants et les trajets associés. Aucun jeu de données fictives n’est créé.

## Données et sauvegardes

Les données sont écrites dans **IndexedDB**, base `carnet-route`, après chaque enregistrement. L’interface ne confirme le succès qu’à la fin de la transaction. Une erreur de stockage est affichée sans remplacer l’état affiché par des données non enregistrées.

À la première ouverture, les données du prototype sous la clé `localStorage` `carnet-route-demo-v1` sont migrées si la base IndexedDB est vide. La date d’un ancien événement est déduite de son trajet le plus récent, ou de la date du jour s’il n’a aucun trajet. La copie localStorage reste intacte. En cas de données anciennes invalides, la migration est interrompue et l’erreur affichée.

Dans Gestion :

- **CSV Excel** : colonne « Statut » (`En cours` / `Terminé`), arrivée et distance vides tant que le trajet est en cours. UTF-8 avec BOM, séparateur point-virgule, champs entre guillemets, dates ISO et une ligne par trajet. Les cellules commençant par un marqueur de formule sont préfixées d’une apostrophe pour limiter leur interprétation comme formule.
- **JSON** : sauvegarde complète avec `version: 2`, `exportedAt` et `data` contenant les tableaux `vehicles`, `events`, `trips`.
Les trajets V1.1 possèdent un `status` (`in-progress` ou `completed`). Un trajet en cours a `end: null`. Les anciennes données IndexedDB et sauvegardes JSON `version: 1` restent lisibles : les trajets sans statut sont considérés comme terminés, sans modification de leurs compteurs ni de leurs identifiants. Le nom de base IndexedDB reste inchangé et aucune suppression de données n’est nécessaire. Les sauvegardes V2 doivent être restaurées avec V1.1 ou ultérieure.

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

Tests fonctionnels : Python 3, paquet `playwright` et Chromium requis **uniquement pour les tests**. Installer les outils de test dans un environnement Python dédié :

```sh
python3 -m venv /tmp/carnet-tests-venv
. /tmp/carnet-tests-venv/bin/activate
python -m pip install -r tests/requirements.txt
python -m playwright install --with-deps chromium
```

Démarrer le serveur ci-dessus sur le port 8001 puis :

```sh
python3 tests/browser.py
python3 tests/ongoing.py
```

Les tests utilisent par défaut le Chromium installé par Playwright et des profils temporaires : création/modification, blocage des suppressions liées, export CSV/JSON, restauration valide et invalide, migration, disposition mobile et création/consultation après coupure réseau et rechargement. Le second parcours vérifie spécifiquement les anciennes données IndexedDB et JSON, deux trajets en cours sur des véhicules distincts, le refus d’un doublon, la modification/suppression, la clôture hors ligne, les totaux et la restauration V2. Les tests ne modifient pas votre profil utilisateur. Pour utiliser un Chromium système dans l’environnement cloud, définir `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` avant les commandes de test. Aucun chemin de navigateur système n’est imposé au runner GitHub Actions. Le job `browser` installe Python, Playwright et son Chromium avec les dépendances système, démarre le serveur sur le port 8001, attend sa disponibilité, puis exécute les deux parcours ; un échec arrête le job et le serveur est arrêté à la sortie.

Une vérification manuelle sur un iPhone reste nécessaire pour valider les particularités de Safari, le menu de partage, le téléchargement des sauvegardes et le lancement depuis l’écran d’accueil.

## V1.2

- « Démarrer un trajet » ouvre par défaut la saisie en cours. Le mode complet reste disponible.
- Les trajets restent regroupés par événement et véhicule, avec date de trajet décroissante puis ordre de création décroissant. L’ordre des anciens trajets est déduit de leur position enregistrée ; modifier un trajet conserve cet ordre.
- Tirer vers le bas en haut de chaque page (ou bouton ↻) relit les données locales sans recharger la page. Les formulaires et fichiers sélectionnés restent intacts. Cette action fonctionne hors ligne et ne force pas une mise à jour de l’application.
- Démarrer un autre trajet en cours du même véhicule demande confirmation. Son compteur de départ clôture le précédent ; les deux changements sont validés avant une écriture IndexedDB unique. Une erreur ou un refus conserve les données et la saisie.
- Gestion : tarif par véhicule en EUR/km, de 0 à 1000, jusqu’à quatre décimales. Le tarif courant est figé à la clôture (ou à la création d’un trajet complet). La modification ultérieure d’un véhicule ou d’un trajet terminé conserve ce tarif. Un trajet rouvert sera retarifé lors de sa nouvelle clôture. Les indemnités sont arrondies au centime par trajet puis additionnées.
- Les trajets terminés anciens restent « Tarif non renseigné », sans calcul rétroactif. Les totaux d’indemnités additionnent les montants connus ; les trajets en cours sont exclus des distances et montants.
- Gestion : export d’un événement avec plusieurs véhicules cochés, CSV et aperçu imprimable PDF. L’aperçu contient les commentaires intégraux, les compteurs, statuts, tarifs et totaux par véhicule et événement. Le PDF est produit par la fonction d’impression du navigateur (sur iPhone, partager l’aperçu et enregistrer dans Fichiers). Aucun service externe n’est utilisé. Les véhicules sélectionnés sans trajet ne contribuent pas aux totaux.

### Migration et partage

Le JSON exporté utilise désormais `version: 3`. Les imports V1 et V2 restent pris en charge ; l’export V3 doit être restauré avec V1.2 ou ultérieure. La base IndexedDB `carnet-route`, sa version et son magasin `state` sont conservés. La normalisation ajoute `rate` aux véhicules, `rate` figé et `createdAt` aux trajets ; elle est idempotente et enregistrée par transaction sans effacement. L’ancienne copie localStorage reste préservée.

Le dépôt ne contient aucun carnet personnel, secret, sauvegarde ou donnée de démonstration. Le partage de l’URL distribue uniquement les fichiers de l’application ; chaque nouveau navigateur/profil ouvre un carnet vide, sauf s’il contient déjà une ancienne copie locale. Ne partagez pas vos fichiers JSON/CSV/PDF personnels pour distribuer l’app. Aucun bouton de remise à zéro n’est nécessaire pour partager une installation vierge.

La synchronisation multi-appareils et les notifications persistantes iOS sont reportées. Continuer à utiliser un seul onglet pour saisir : les écritures simultanées entre onglets ne sont pas coordonnées.

### Validation iPhone avant fusion

Tester dans Safari et depuis l’écran d’accueil : largeur du calendrier à 320/390 px, geste d’actualisation avec une saisie non enregistrée, enchaînement accepté/refusé, mode avion, export CSV avec plusieurs véhicules, aperçu PDF et partage vers Fichiers. Les tests automatisés ne remplacent pas cette validation sur appareil réel.

## V1.2.1 — indemnités des anciens trajets

Dans Gestion, configurez d’abord le tarif de chaque véhicule, puis touchez **Comptabiliser les anciens trajets**. Une confirmation présente les véhicules, tarifs, kilomètres et montants concernés. Les trajets terminés sans tarif historique reçoivent le tarif actuel du véhicule, puis ce tarif reste figé. Les trajets en cours, les tarifs déjà figés (y compris zéro) et les véhicules dont le tarif est encore zéro restent inchangés. L’opération fonctionne hors ligne, est enregistrée en une transaction et peut être répétée sans doubler les montants. Les totaux et exports utilisent immédiatement les indemnités ainsi ajoutées.


## V1.3 — Finances (mémo n°12)

L’onglet **Finances** affiche les indemnités des trajets terminés, les paiements globaux de l’employeur et le solde restant dû : indemnités cumulées + solde initial − remboursements reçus. Les montants utilisent le tarif figé V1.2 et l’arrondi au centime par trajet. Les corrections et suppressions recalculent le solde à partir des trajets présents, sans registre dupliqué. Un trajet en cours ne génère pas d’indemnité. Les anciens trajets sans tarif sont signalés et restent exclus jusqu’à leur comptabilisation explicite dans Gestion.

**Ajouter un remboursement reçu** demande une date, un montant positif avec au maximum deux décimales et un commentaire facultatif. Aucun événement ni véhicule ne peut lui être attribué. L’historique est trié par date décroissante ; modification et suppression demandent confirmation. Le solde initial peut être modifié, y compris avec un montant négatif pour une avance antérieure. Il doit uniquement couvrir les montants antérieurs aux trajets du carnet afin d’éviter leur double comptage. Les montants saisis sont limités à un milliard d’euros en valeur absolue.

Les sauvegardes exportées sont en **version 4**, avec `payments` et `openingBalance`. Les imports V1, V2 et V3 sont conservés et reçoivent une liste de paiements vide et un solde initial nul. Restaurer une ancienne sauvegarde remplace aussi les finances ; la confirmation indique les paiements et le solde importés. Une sauvegarde V4 nécessite V1.3 ou ultérieure. Les exports CSV/PDF par événement restent des relevés de trajets et ne répartissent pas les paiements globaux.

La base IndexedDB, sa version et son magasin restent identiques. À l’ouverture, la normalisation ajoute les champs financiers manquants puis enregistre le résultat en une transaction, sans effacer la base ni la copie localStorage. Une erreur de validation ou d’écriture conserve les données précédentes. Les finances fonctionnent hors ligne et bénéficient du même rafraîchissement local que les autres écrans. Le cache applicatif est incrémenté en V1.3.

Validation : tests métier Node et parcours navigateur `tests/finances.py` (saisie, annulation/confirmation, persistance hors ligne, sauvegarde/restauration, largeur 320 px). Les anciens parcours restent dans la CI. Une vérification sur un iPhone réel reste nécessaire avant fusion.
