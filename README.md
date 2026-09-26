# DTrade / DEIMOS

Terminal d'analyse boursière et de paper trading pour un propriétaire unique : graphiques, indicateurs, listes de suivi et portefeuille fictif. Données Yahoo Finance, React/Vite, Python/FastAPI et SQLite.

## Démarrage local

Prérequis : Linux, Python 3.12, Node 24. L'application reste sur la boucle locale et demande une clé d'accès. Les données ne sont jamais enregistrées dans ce dépôt.

```sh
python3 -m venv ~/.local/share/dtrade-venv
~/.local/share/dtrade-venv/bin/pip install --require-hashes -r backend/requirements.txt
python3 scripts/init_local.py
```

La clé est dans `~/.config/dtrade/access-token` (0600). La lire localement pour remplir l'écran de connexion ; ne pas la copier dans un ticket, une commande partagée ou un fichier frontend. Le script ne remplace pas une clé existante.

Dans backend : `~/.local/share/dtrade-venv/bin/python main.py`.
Dans frontend : `npm ci --ignore-scripts`, puis `npm run dev`.
Ouvrir `http://127.0.0.1:5173`, puis se connecter. Le frontend et les WebSockets passent par un proxy de même origine. Les polices sont servies localement, sans appel Google Fonts. Les graphiques et le portefeuille ne sont chargés qu'après authentification.

Données privées : `~/.local/share/dtrade/market.db` et cache Yahoo dans le même répertoire privé. Un compte de simulation neuf contient 100 000 dollars fictifs. Aucune ancienne base publiée n'est réimportée automatiquement.

## Configuration

| Variable serveur | Valeur par défaut / règle |
|---|---|
| `DTRADE_ACCESS_TOKEN` | Sinon, lecture du fichier privé ci-dessus ; au moins 32 caractères, générés aléatoirement. Jamais de variable `VITE_*` contenant un secret. |
| `DTRADE_DATA_DIR` | `~/.local/share/dtrade`, obligatoirement hors dépôt. |
| `DTRADE_ALLOWED_ORIGINS` | Origines exactes localhost/127.0.0.1 sur ports 5173 et 4173, séparées par des virgules. |
| `DTRADE_ALLOWED_HOSTS` | `localhost,127.0.0.1`, sans wildcard. |
| `DTRADE_SECURE_COOKIE` | `false` uniquement pour HTTP local ; `true` obligatoire avec une origine distante HTTPS. |

Une session dure 8 heures maximum ; la déconnexion la révoque. Un redémarrage invalide toutes les sessions. La clé d'accès n'est jamais enregistrée dans localStorage. Les cookies locaux ne sont pas isolés par port : n'utiliser que des services localhost de confiance.

Application mono-propriétaire et mono-processus : pas d'isolation multi-utilisateur, ni de connexion à un courtier réel. Yahoo reçoit les symboles demandés et les métadonnées réseau. Les historiques sont plafonnés aux 10 000 dernières bougies, les appels externes à 4 connexions concurrentes avec un timeout de 10 secondes par requête.

Voir [SECURITY.md](SECURITY.md) pour les limites, incidents et déploiements ; [CONTRIBUTING.md](CONTRIBUTING.md) pour les contrôles ; [AGENTS.md](AGENTS.md) pour les conventions de travail.
