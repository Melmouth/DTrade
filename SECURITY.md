# Sécurité de DTrade

## Périmètre supporté

La branche main courante, un seul propriétaire, un seul processus backend. Toute personne possédant la clé peut lire/modifier l'intégralité du portefeuille fictif. Le partage entre utilisateurs, les workers multiples et une exposition directe du serveur de développement ne sont pas supportés.

Les routes métier HTTP exigent une session HttpOnly ou une clé Bearer pour les clients non navigateur. Les écritures par cookie exigent une origine exacte autorisée. Les WebSockets exigent une session et une origine exacte ; aucune clé dans l'URL. Une session expire après 8 heures, est révocable, et les émissions WebSocket vérifient sa validité. Les connexions inactives révoquées sont fermées au prochain contrôle (30 secondes maximum).

Limites applicatives : corps HTTP 16 Kio, lecture du corps 5 secondes, 120 requêtes/minute par catégorie authentifiée/anonyme pour le processus, 5 connexions au compte/minute, 16 sessions, 16 WebSockets et 30 tentatives WebSocket/minute. Les limites sont globales pour ce terminal personnel ; un proxy doit compléter la résistance au déni de service. Stockage : 100 dossiers, 500 entrées de suivi, 500 indicateurs, 100 positions, 10 000 transactions et 16 384 pages SQLite. Les quotas sont contrôlés transactionnellement. Pas de suppression automatique silencieuse de l'historique : exporter/sauvegarder localement avant un reset si un quota est atteint.

## Déploiement distant

Le démarrage documenté écoute seulement `127.0.0.1:8000`, sans rechargement automatique ni logs d'accès. Conserver ce bind derrière un reverse proxy HTTPS. Servir uniquement `frontend/dist`, jamais le dépôt ni le répertoire de données. Ne pas exposer Vite, sa preview ou un listing de fichiers.

Configurer des listes explicites de hosts et d'origines HTTPS, `DTRADE_SECURE_COOKIE=true`, préserver l'en-tête Origin et transmettre un Host autorisé. Router `/api/` et `/ws/` vers le backend en loopback, sans mettre en cache les réponses privées. Le proxy doit limiter les connexions/débits/taille des corps, gérer TLS, les timeouts et les upgrades WebSocket. Ne pas activer de confiance universelle dans X-Forwarded-For. Ajouter HSTS après vérification HTTPS et servir le frontend avec une CSP : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`, ainsi que `X-Content-Type-Options: nosniff` et `Referrer-Policy: no-referrer`.

Utiliser un compte système dédié, des répertoires privés (0700) et fichiers privés (0600). Les sauvegardes, WAL, SHM et caches Yahoo sont sensibles. Un disque chiffré et la protection de l'hôte restent à la charge de l'opérateur ; SQLite n'est pas chiffré par cette application.

## Signaler une vulnérabilité

Utiliser la fonction GitHub « Report a vulnerability » du dépôt lorsque disponible. Ne pas publier de secret ou de données de portefeuille dans une issue publique. Décrire le scénario, la version, l'impact et une reproduction synthétique.

## Incident et historique public

Révoquer d'abord tout véritable credential exposé, puis le remplacer. Pour changer la clé locale : arrêter le serveur, supprimer uniquement le fichier d'accès privé, relancer `scripts/init_local.py`, puis redémarrer. Ne pas afficher de vraie clé dans les logs. Le redémarrage invalide les sessions existantes.

La remédiation retire bases SQLite/journaux, venv, bytecode et adresses Git personnelles des références publiées. Une suppression dans HEAD ne suffit pas. Toute réécriture doit conserver une sauvegarde privée hors dépôt, vérifier les objets de toutes les références, puis remplacer la branche avec un lease fixé à l'ancien SHA. Ne jamais fusionner une ancienne branche contaminée après nettoyage : repartir d'un clone neuf et reporter seulement les changements source nécessaires.

Les anciens SHA, caches GitHub et clones tiers peuvent survivre au remplacement des références. La réécriture n'est pas une révocation ni une preuve d'effacement mondial. Si les données anciennes devaient être privées, demander au support GitHub le traitement des vues/caches concernés selon [sa procédure officielle](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). Les sauvegardes privées de remédiation doivent rester protégées, avec une durée de conservation choisie par le propriétaire.

## Contrôles continus

Workflow Security à chaque push/PR et chaque semaine : garde des artefacts et emails dans tout l'historique, Gitleaks avec une seule exception exacte pour un ancien libellé localStorage, tests des frontières d'accès, Bandit, audits Python/npm et build/lint. Aucun ignore global de secrets ou de CVE. Dependabot suit Python, npm et les Actions épinglées. Exiger les jobs repository/backend/frontend sur main, interdire force push et suppression hors procédure d'incident, et conserver la protection push contre les secrets.
