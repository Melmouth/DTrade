# Frontend DEIMOS

Les instructions d'installation, d'authentification et de sécurité sont dans le [README principal](../README.md), [SECURITY.md](../SECURITY.md) et [CONTRIBUTING.md](../CONTRIBUTING.md).

Node 24, `npm ci --ignore-scripts`, puis `npm run dev`. Le serveur écoute uniquement sur `127.0.0.1:5173`, avec proxy `/api` et `/ws` vers le backend local. Aucune clé d'accès dans une variable VITE, une URL ou localStorage. Les polices sont distribuées localement, sans requête Google Fonts.

`npm run lint`, `npm run build` et `npm audit --audit-level=low` sont requis avant publication. Le déploiement distant sert seulement `dist/` derrière HTTPS avec les en-têtes décrits dans SECURITY.md ; ne pas exposer Vite ou sa preview.
