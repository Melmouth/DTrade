# Contribuer à DTrade

Python 3.12 et Node 24 sont les versions de référence. Lire AGENTS.md et SECURITY.md avant une modification.

Configurer une adresse GitHub noreply puis installer les hooks locaux :

```sh
git config user.email '124444507+Melmouth@users.noreply.github.com'
git config core.hooksPath .githooks
```

Installer Gitleaks 8.30.1 depuis sa release officielle, vérifier ses checksums, puis le rendre disponible dans PATH. Le hook refuse de continuer si le scanner manque. Les hooks locaux peuvent être contournés ; les mêmes contrôles sont donc exécutés par GitHub Actions, dont les jobs doivent rester requis par la protection de main.

Créer un environnement Python hors du dépôt, par exemple `~/.local/share/dtrade-venv`, et installer `backend/requirements-dev.txt` avec `pip install --require-hashes`. Dans frontend, utiliser `npm ci --ignore-scripts`.

Validation avant commit :

```sh
python3 scripts/check_repository.py
gitleaks dir . --redact=100
gitleaks git --log-opts=--all --redact=100
python -m pytest -q backend/tests
bandit -r backend/app backend/main.py
pip-audit -r backend/requirements.txt --no-deps --disable-pip
pip-audit -r backend/requirements-dev.txt --no-deps --disable-pip
```

Dans frontend : `npm audit --audit-level=low`, `npm run lint`, `npm run build`. Les tests utilisent uniquement une base temporaire, des prix simulés et des clés aléatoires. Ne pas capturer une vraie session dans une fixture ou un screenshot public.

Mise à jour des dépendances Python : modifier les `.in`, puis générer les deux `.txt` avec `pip-compile --generate-hashes --allow-unsafe --strip-extras --no-emit-index-url --output-file ...`. Les mises à jour Dependabot doivent conserver les hashes cohérents et repasser tous les contrôles. Ne pas ajouter d'exception CVE sans analyse de portée et échéance documentées.

Les modifications de sécurité restent de petits changements examinables, avec un scénario refusé et un scénario légitime vérifiés. Les Actions sont épinglées par SHA et reçoivent uniquement `contents: read` ; aucune utilisation de `pull_request_target` avec du code non fiable, aucun secret de production dans les tests.
