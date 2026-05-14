# AGENTS.md

## Quick start
```bash
bun install                  # install all workspace deps
make docker-up               # start SQL Server container only
make dev                     # kills stale processes, runs both workspaces
```
Start order: Docker up first (SQL Server required), then `make dev`.

## Monorepo (Bun workspaces)
- Workspace dir is `pakages/` (not `packages/`).
- `bun run dev` runs both workspaces in parallel via `--filter '*' dev`.
- `bun run dev:backend` / `bun run dev:frontend` for single workspace.

## Backend (`pakages/backend`)
- **Framework:** Elysia (Bun web framework), port hardcoded to **8080**.
- **DB:** SQL Server via `mssql`, connection from `.env` (`DB_HOST`, `DB_PORT=1436/1437`).
- **Dev:** `bun --hot src/index.ts` (file-watching reload).
- **Entry:** `src/index.ts` — routes for `/Login`, `/Usuario/*`, `/api/citas/*`, `/api/tickets/*`, `/api/pantalla/cola`.

## Frontend (`pakages/frontend`)
- React 19 + Vite, strict port **5173**.
- Vite proxy: `/api` → `http://localhost:5000` (note: backend is on **8080** — mismatch may need fixing).
- **Env:** `VITE_API_URL=http://localhost:8080` (used directly in API calls).

## Database
- **Container:** `clinica_sqlserver` (SQL Server 2022 Express), host port `1436` → container `1433`.
- **Default SA password:** `ClinicaDBgrupo3#` (requires quoting in shell/cmd).
- Init scripts in `sql/init/`. Export backups to `sql/export/`, import from `sql/import/`.
- DB name: `ClinicaF`.

## Key commands (Makefile)
| Command | What it does |
|---|---|
| `make dev` | Kill bun+node, then `bun run dev` |
| `make stop` | Kill bun+node |
| `make docker-up` | `docker compose up -d` |
| `make docker-down` | `docker compose down` |
| `make db-export` | Backup DB to `sql/export/` |
| `make db-import` | Restore from `sql/import/*.bak` |

## Gotchas
- **Vite proxy port mismatch:** proxy target is `5000` but backend runs on `8080` — check if intentional.
- **Hardcoded backend port:** `src/index.ts` has `const port = 8080` (`.env` `APP_PORT=8080` is unused).
- **No tests, linter, or typecheck scripts** — only dev server.
- **Windows-native bats:** `start.bat` / `stop.bat` as alternative to Makefile.
- **`make db-export`/`db-import` uses `docker exec -it`** — may fail in non-interactive CI; drop `-it` if needed.
- `.gitignore` has broken entries (`nul`, `tscongfg.json`, `echo "nul" >> .gitignore`).
