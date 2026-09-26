# DTrade working conventions

- DTrade is a single-owner paper-trading application. Every portfolio, watchlist and indicator is private. Never add an anonymous sensitive endpoint or treat localhost as authentication.
- Runtime data, secrets, backups, scanner reports and Python environments belong outside Git. Never commit a database, WAL/SHM, cache, bytecode, key or token, even for a test. Tests generate synthetic credentials and temporary data.
- Keep access keys out of frontend code, VITE variables, URLs, localStorage, logs and exception responses. Browser authentication uses the server-issued HttpOnly cookie; writes require an exact allowed Origin. WebSockets require both session and Origin.
- Preserve fail-closed configuration, loopback defaults, session revocation, finite input bounds and storage/network quotas. New routes inherit the global security middleware. Single process only unless sessions and quotas are redesigned for multiple workers.
- Use parameterized SQL. Dynamic SQL identifiers must be a fixed internal allowlist. Never trust an indicator's persisted parameters without validation when importing external data.
- Install Python dependencies from hashed requirements.txt / requirements-dev.txt. Change their .in inputs and regenerate both locks with pip-compile; never vendor site-packages. Use npm ci --ignore-scripts and the committed lockfile. Review dependency major upgrades and Action commit pins.
- Required checks: repository guard, Gitleaks, backend security tests, Bandit, both Python dependency audits, npm audit, frontend lint/build. Add meaningful denial and permitted-path tests when changing an authentication boundary. Never disable a scanner broadly to get green checks.
- Do not expose the Vite development/preview server publicly. A remote deployment needs the documented HTTPS reverse proxy and exact host/origin configuration.
- Use GitHub noreply author and committer addresses; the platform automation identity noreply@github.com is also accepted. Do not print discovered secrets. Rotate confirmed exposed credentials before historical cleanup. Preserve private rollback copies outside the repository and use an exact force-with-lease for an authorized history replacement.
- Never merge pre-cleanup history into the sanitized repository. CI checks all reachable commits, including old personal email addresses and artifacts.
