# Deployment Research Notes

Last investigated: 2026-07-04

This file records the deployment conventions already used by the projects on
`personal`. It is research for a later implementation plan; it is not a claim
that TTRPG deployment is implemented yet.

No production secrets were read or copied during this investigation.

## Confirmed Server Shape

- SSH target: `personal` (currently logs in as `root`).
- Public host: `https://bossadapt.org`.
- Cloudflare is the public DNS and reverse-proxy middle layer that resolves
  `bossadapt.org` to the server IP. Public HTTP and WebSocket traffic follows
  `client -> Cloudflare -> Nginx -> application`; deployment should use the
  hostname rather than embedding the origin IP.
- OS: Ubuntu 24.04.
- Reverse proxy/TLS: Nginx 1.24.0. Port 80 redirects to HTTPS; Nginx is the
  origin listener on ports 80 and 443. The configured certificate paths identify
  a Cloudflare origin certificate, so Cloudflare SSL mode must continue to
  validate HTTPS to the origin (normally Full (strict)).
- Application files follow a consistent split:
  - static frontend: `/var/www/bossadapt.org/<app>`
  - executable backend: `/srv/<app>`
- Backends bind to loopback and Nginx proxies to them. Existing examples use
  ports 4001, 5000, and 7898. Port 6767 was free when inspected.
- systemd manages the Java and FastAPI services. Docker Compose plus a systemd
  wrapper manages the Rails application.
- Installed runtimes include Python 3.12.3, Node 18.19.1, npm 9.2.0, Docker
  29.3.1, and Java (used by the running Ant service).
- Capacity at inspection time: 48 GB disk with about 40 GB available; 1.9 GiB
  RAM with about 947 MiB available; no swap.
- UFW is inactive. A new backend must bind to `127.0.0.1`, not `0.0.0.0`,
  because host firewall rules do not provide a second containment layer.
- The active Nginx site is `/etc/nginx/sites-available/default`, enabled through
  `/etc/nginx/sites-enabled/default`.
- The local source used to deploy that shared configuration is
  `/home/devinphillips20/Desktop/Projects/server_config/default`. Its working
  tree currently has an uncommitted change enabling `/blogs`; preserve that
  change when adding a TTRPG location.

## Reference Deployments

| Project | Frontend | Backend | Deployment mechanism | Useful lesson |
| --- | --- | --- | --- | --- |
| `home` | Vite static output | none | Build `dist`, tar it, SCP through `/tmp`, clear and extract into `/var/www/bossadapt.org/home` | Small static-site baseline |
| `ant-colony-sim` | Next static export under `/antsim` | Spring Boot JAR | Separate frontend/backend recipes; JAR in `/srv/antsim`; systemd service on loopback port 4001 | Split full-stack deployment and explicit service install |
| `ToDoOrganized` | Rails-served | Rails + PostgreSQL | Archive source, preserve/upload env, Docker Compose build and DB preparation, systemd wrapper | Secret handling, persistent data, bootstrap/status/log recipes |
| `CSC478-Tetris` | Static React build under `/tetris` | FastAPI/Uvicorn | Separate archives; `/srv/tetris_api`; server-side venv; systemd as `www-data`; preserve env and SQLite files | Closest direct backend template for TTRPG |

### Static `home` pattern

Source: `/home/devinphillips20/Desktop/Projects/home/justfile`.

1. Run `npm run build` locally.
2. Archive the contents of `dist`, not the `dist` directory itself.
3. Upload the archive to `/tmp` with SCP.
4. Create and clear the destination directory.
5. Extract into `/var/www/bossadapt.org/home` and delete both temporary
   archives.

This is appropriate for replaceable static assets. Its destructive directory
clear must not be reused for a backend directory containing persistent state.

### Ant simulation pattern

Sources:

- `/home/devinphillips20/Desktop/Projects/ant-colony-sim/justfile`
- `/home/devinphillips20/Desktop/Projects/ant-colony-sim/deploy/antsim.service`
- `/home/devinphillips20/Desktop/Projects/ant-colony-sim/ant-colony-frontend/next.config.ts`

The frontend is statically exported with a `/antsim` base path and deployed to
`/var/www/bossadapt.org/antsim`. Nginx serves those files and proxies
`/antsim/api/` to the JAR on loopback port 4001.

The backend build happens locally. Only the resulting JAR is uploaded. The
systemd unit runs as `www-data`, restarts automatically, and is installed by a
separate one-time `install-backend-service` recipe. Routine deployment replaces
the JAR and restarts the service. Status and journal recipes are included.

This demonstrates the desired frontend/backend recipe split and subpath-aware
frontend build.

### ToDoOrganized pattern

Sources:

- `/home/devinphillips20/Desktop/Projects/ToDoOrganized/justfile`
- `/home/devinphillips20/Desktop/Projects/ToDoOrganized/docker-compose.yml`
- `/home/devinphillips20/Desktop/Projects/ToDoOrganized/deploy/todoorganized.service`

The release archive is built from Git-known and non-ignored files, so ignored
secrets and local build debris are excluded. A separate
`production-secret.env` is required and installed with mode 600. The deployment
starts PostgreSQL, waits for readiness, creates required databases, runs Rails
database preparation, and then starts the complete Compose stack.

The reusable ideas are:

- use a strict shell (`bash -euo pipefail`);
- separate first-time `bootstrap`/service installation from routine deploys;
- treat secrets and persistent data separately from replaceable application
  code;
- include `status`, `logs`, and process inspection recipes;
- wait for dependencies and perform migrations before declaring success.

TTRPG does not currently need Docker or PostgreSQL, so copying this stack would
add cost without solving a current requirement.

### Tetris FastAPI pattern

Sources:

- `/home/devinphillips20/Desktop/Projects/CSC478-Tetris/justfile`
- `/home/devinphillips20/Desktop/Projects/CSC478-Tetris/backend/tetris_api.service`
- `/home/devinphillips20/Desktop/Projects/CSC478-Tetris/README.md`

This is the closest runtime analogue:

- frontend files are independently built and deployed under a URL subpath;
- backend code is archived while excluding `.venv`, caches, bytecode, and the
  SQLite database;
- `/srv/tetris_api/.env` is uploaded when a local copy exists, otherwise an
  existing remote copy is reused, and deployment fails if neither exists;
- the remote directory is cleaned while explicitly preserving `.env` and the
  SQLite database files;
- a virtualenv is created on the server and dependencies are installed from
  `requirements.txt`;
- systemd runs Uvicorn as `www-data` on `127.0.0.1:7898` and restarts it on
  failure;
- frontend deploy, backend deploy, service installation, status, logs, and
  combined deploy are separate recipes.

The TTRPG implementation should begin from this model, with stronger handling
for its JSON checkpoint and WebSocket-only protocol.

## TTRPG-Specific Deployment Requirements

The current project is not a static-only app:

- Vite produces replaceable frontend files.
- FastAPI/Uvicorn must remain running for `/ws` and `/ws/chat`.
- `state_dumpy.json` and `state_dumpy.json.bak` are durable campaign data.
  `backend/state/store.py` resolves them at the repository root regardless of
  the process working directory.
- The first production deployment must not upload the repository's local
  checkpoint files. With no production checkpoint present, the backend creates
  its fresh default state, including its built-in global actions and
  weapon-family proficiencies. Later deployments preserve the resulting live
  production checkpoints.
- Backend shutdown performs a final state dump. Deploy must stop the service
  gracefully before replacing backend code or handling the state files.
- Production startup requires non-empty, distinct `PLAYER_JOIN_CODE`,
  `DM_ADMIN_CODE`, and `SERVICE_AUTH_CODE` values when `APP_ENV=production`.
- The browser UI already accepts player/GM codes at runtime. Do not put real
  player or GM codes into Vite variables: `VITE_*` values are embedded in the
  public JavaScript bundle.
- The Roll20 Firefox extension must be configured for the production bridge,
  `wss://bossadapt.org/ttrpg/ws/chat`, and the production service code. Its
  current defaults and user-facing help text still point to localhost.
- The extension itself continues to run locally on the client machine inside
  the user's Roll20 browser tab. It opens an outbound WebSocket to the deployed
  backend, receives chat jobs, and performs the Roll20 DOM interaction locally.
  No Roll20 bot or browser automation runs on the server, avoiding a separate
  server-side anti-bot integration.
- Because the public page is HTTPS, browser WebSocket URLs must use `wss://`.
- Cloudflare must proxy the chosen hostname and allow WebSocket upgrades; Nginx
  then forwards those upgraded connections to Uvicorn.
- Nginx needs WebSocket upgrade headers and long read/send timeouts for both
  app clients and the Roll20 bridge. The default proxy timeout is too short for
  an idle game session.

## Development and Production Configuration

Production support must not replace or complicate the existing local workflow.
Use the configuration systems already present rather than adding one global
production boolean:

| Area | Development | Production | Required codebase change |
| --- | --- | --- | --- |
| Backend environment | `APP_ENV` omitted or `development`; existing fallback auth codes remain available | `/srv/ttrpg/.env` sets `APP_ENV=production` and all three distinct auth codes | No backend config redesign; systemd supplies the production env |
| Backend listener | `just run-backend` on port 6767 | systemd binds Uvicorn to `127.0.0.1:6767` | Keep `run-backend`; add production service/deploy recipes separately |
| Frontend mode | `npm run dev`, root base `/`, default `ws://127.0.0.1:6767/ws` | `npm run build`, base `/ttrpg/`, `VITE_WS_URL=wss://bossadapt.org/ttrpg/ws` | Make `frontend/vite.config.ts` mode-aware and add a production frontend env file |
| Frontend authentication | Codes entered in the UI; optional development helpers may remain | Codes entered in the UI | Do not define production `VITE_PLAYER_AUTH_TOKEN` or `VITE_DM_AUTH_TOKEN` values |
| Roll20 extension | Existing localhost defaults | User selects/configures `wss://bossadapt.org/ttrpg/ws/chat` and the production service code | Keep runtime options as the switch; make help text environment-neutral or provide Local/Production presets |
| State | Repository-local `state_dumpy.json` | Server-local `/srv/ttrpg/state_dumpy.json` | Deployment archives exclude local checkpoints and preserve remote checkpoints |

Vite already selects modes by command: `npm run dev` uses development and
`npm run build` uses production. Continue using the existing `VITE_WS_URL`
field; do not invent a second production-specific WebSocket variable. A tracked
`frontend/.env.production` may contain the public `wss://` URL because it is not
a secret. `frontend/vite.config.ts` should select `/ttrpg/` only for production
builds and retain `/` for the development server.

Backend mode selection already exists in `backend/core/config.py`. Local runs
default to development. The production systemd environment sets
`APP_ENV=production`, which disables development auth defaults and requires the
three production codes.

The extension runs the same code in both environments. Its saved options are
the runtime toggle, so local development can continue using
`ws://127.0.0.1:6767/ws/chat` while production users select the hosted `wss://`
endpoint. Production support must not hardcode the hosted endpoint in a way
that removes local use.

Local-development acceptance criteria after deployment work:

- `just run-backend` still starts the local backend without a production env;
- `cd frontend && npm run dev` still serves at the root and connects to the
  local backend by default;
- the extension can still use its localhost bridge settings;
- local checkpoint and environment files are not uploaded, deleted, or
  rewritten by deployment recipes;
- backend and frontend tests continue to run without production secrets.

## Production Codebase Change Checklist

The later implementation plan should identify these exact fields and files:

- `justfile`: add strict-shell deploy constants and recipes for `personal`,
  `/var/www/bossadapt.org/ttrpg`, `/srv/ttrpg`, `ttrpg.service`, port 6767,
  environment installation, planned downtime, verification, and cleanup while
  retaining the current local recipes.
- `frontend/vite.config.ts`: select base `/` for development and `/ttrpg/` for
  production.
- `frontend/.env.production`: set only public production build configuration,
  including `VITE_WS_URL=wss://bossadapt.org/ttrpg/ws`; never place auth codes
  in it.
- `.gitignore`: ignore `production-secret.env` and generated deployment
  archives.
- `deploy/ttrpg.service` (new): set working directory, production environment
  file, Uvicorn entrypoint, loopback address, port, `www-data` ownership, and
  restart behavior.
- `firefox_extension/options/options.js` and
  `firefox_extension/content/roll20-chat-bridge.js`: preserve local defaults;
  optionally add explicit Local/Production presets without embedding the
  production service code.
- `frontend/src/hooks/useGameClient.ts`: replace the localhost-only Roll20
  troubleshooting message with environment-neutral extension setup guidance.
- `README.md` and `firefox_extension/README.md`: document both local and hosted
  URLs and the client-local extension architecture.
- `/home/devinphillips20/Desktop/Projects/server_config/default` (shared
  infrastructure repository): add `/ttrpg` static and WebSocket locations while
  preserving its existing uncommitted `/blogs` change.

Backend routes do not need production path changes. Nginx maps public
`/ttrpg/ws` and `/ttrpg/ws/chat` to backend `/ws` and `/ws/chat`.

## Deployment Shape

The public subpath and application names are confirmed. The remaining values
reflect the current implementation and available server port:

| Concern | Likely value |
| --- | --- |
| Public page | `https://bossadapt.org/ttrpg/` |
| Frontend directory | `/var/www/bossadapt.org/ttrpg` |
| Backend directory | `/srv/ttrpg` |
| systemd unit | `ttrpg.service` |
| Backend listener | `127.0.0.1:6767` |
| App WebSocket | `wss://bossadapt.org/ttrpg/ws` |
| Roll20 bridge WebSocket | `wss://bossadapt.org/ttrpg/ws/chat` |
| Production environment | `/srv/ttrpg/.env`, owned by `www-data`, mode 640 or stricter |
| Service account | `www-data:www-data` |

The Vite config needs a production base of `/ttrpg/`; it currently uses Vite's
root default. The production frontend build needs only the public WebSocket URL.
Authentication codes should be entered at runtime and remain backend secrets.

An Nginx shape consistent with the current server would be:

```nginx
location = /ttrpg {
    return 301 /ttrpg/;
}

location /ttrpg/ws {
    proxy_pass http://127.0.0.1:6767/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

location /ttrpg/ {
    alias /var/www/bossadapt.org/ttrpg/;
    index index.html;
    try_files $uri $uri/ /ttrpg/index.html;
}
```

With that prefix replacement, `/ttrpg/ws` reaches backend `/ws` and
`/ttrpg/ws/chat` reaches backend `/ws/chat`. Validate this behavior with a real
WebSocket handshake before considering deployment complete.

The systemd unit should follow the Tetris unit:

- `WorkingDirectory=/srv/ttrpg`
- `EnvironmentFile=/srv/ttrpg/.env`
- Uvicorn entrypoint `backend.core.main:app`
- `--host 127.0.0.1 --port 6767`
- `User=www-data` and `Group=www-data`
- automatic restart with a short delay
- normal SIGTERM shutdown so the FastAPI lifespan can flush state

## Recommended Justfile Responsibilities

A future implementation plan should account for these recipes:

- `check`: backend tests, frontend tests/lint/build, and protocol generation
  consistency checks.
- `build-frontend`, `pack-frontend`, `upload-frontend`, `deploy-frontend`.
- `pack-backend`, `upload-backend`, `deploy-backend`.
- `deploy-backend-env`: upload a deliberately named ignored production env, or
  safely reuse the existing remote env; fail if neither exists.
- `install-backend-service`: first-time systemd installation, daemon reload,
  and enablement.
- `bootstrap`: create directories, install the service, install secrets, deploy,
  and start.
- `status-backend` and `logs-backend`.
- `deploy-all`: build both artifacts before changing the server, then deploy
  backend and frontend in a defined compatibility order. Routine deployment is
  allowed to take the application offline; zero-downtime releases are not a
  requirement.
- `ssh` and local archive cleanup.

The backend archive/cleanup must preserve at least:

- `.env`
- `state_dumpy.json`
- `state_dumpy.json.bak`

Exclude the repository's local `state_dumpy.json` and `state_dumpy.json.bak`
from deployment archives. On first deployment the server starts without them;
on later deployments the server's live copies remain untouched.

Follow the Tetris secret-deployment convention with an explicitly production
file such as `production-secret.env`:

- keep it ignored by Git;
- require `APP_ENV=production` plus distinct `PLAYER_JOIN_CODE`,
  `DM_ADMIN_CODE`, and `SERVICE_AUTH_CODE` values;
- generate all three production codes independently from cryptographically
  secure random data (for example, 32 random bytes encoded as hexadecimal);
- never use the development defaults `player`, `dm`, or `service` in
  production;
- when the local file exists, upload it through `/tmp` and install it as
  `/srv/ttrpg/.env`, owned by `www-data:www-data` with mode 600;
- when the local file is absent, reuse the existing `/srv/ttrpg/.env`;
- fail deployment if neither copy exists;
- remove the temporary remote secret immediately after installation.

The routine backend deployment sequence is intentionally offline:

1. Put the public `/ttrpg` application into a maintenance/unavailable state so
   users cannot continue using the old frontend during deployment.
2. Stop `ttrpg.service` gracefully so the FastAPI shutdown lifecycle writes its
   final live checkpoint.
3. Replace backend application code while preserving the production environment
   and checkpoint files.
4. Recreate the server-side Python virtualenv and install dependencies from
   `backend/requirements.txt`.
5. Start `ttrpg.service`, verify it is active, inspect recent journal output,
   and check Uvicorn directly from the server with
   `curl --fail http://127.0.0.1:6767/openapi.json`.
6. Deploy the matching frontend and restore public access only after validation
   passes. Then check the public URL to cover Nginx and Cloudflare separately.

The website is intentionally unavailable while this sequence runs. Do not add
timestamped deployment backups or a retention system: campaign operators can
export the complete running campaign through the existing state-backup page.
Preserve `state_dumpy.json` and the backend-managed `state_dumpy.json.bak` during
code deployment. Never run `just seed` as part of production deployment.

Nginx is shared infrastructure. Update the existing `server_config` repository,
run `nginx -t`, and reload only after validation. Do not overwrite the live
configuration from a stale app-local copy.

## Hardening Missing From Existing Examples

The reference deployments work, but a TTRPG plan should improve these areas:

- Build and test all local artifacts before stopping the running backend, even
  though the remote dependency installation occurs during planned downtime.
- Avoid clearing `/srv/ttrpg` wholesale; persistent state and secrets live
  there unless the application is changed to support a separate data path.
- Preserve the live checkpoint files during deploy. Historical campaign backup
  and retention are handled by the application's full-state export page rather
  than the deployment system.
- Add deployment failure traps so temporary local and remote archives are
  removed without hiding the original error.
- Validate file ownership after extraction; `www-data` must be able to atomically
  replace the checkpoint and create its `.tmp` and `.bak` files.
- Verify the service becomes active and inspect recent journal output after
  restart.
- Verify both WebSocket endpoints through Nginx, not only the loopback Uvicorn
  listener.
- Do not add a dedicated readiness endpoint. Use systemd state, recent journal
  output, and a direct server-side request to FastAPI's existing
  `/openapi.json` before restoring public access. Check the public hostname
  afterward to cover Nginx and Cloudflare.
- Do not use Docker for this app merely for consistency with Rails. On this
  small no-swap host, native Uvicorn under systemd matches the existing FastAPI
  deployment and has lower overhead.

## Resolved Planning Decisions

- Public path and service names: `/ttrpg`, `/srv/ttrpg`, and `ttrpg.service`.
- First production start: fresh default state; never upload local checkpoints.
- Campaign backups: use the application's full-state export page; deployment
  only preserves the live checkpoint and backend-managed `.bak` file.
- Roll20: the extension runs on the client and connects to the deployed bridge.
- Deployment: planned downtime, remote virtualenv recreation, and dependency
  installation from `backend/requirements.txt`.
- Secrets: ignored local production env with safe remote reuse, following the
  Tetris deployment pattern.
- Readiness: direct loopback request on the server, followed by a public URL
  check; no new health endpoint.

## Deployment TODO List

Complete these tasks in order. The first production deployment must begin with
fresh default state and must not upload repository-local checkpoint files.

Implementation status (2026-07-04): production is live and all automated
deployment checks are complete. Remaining unchecked items require interaction
with the locally loaded Firefox extension, an active Roll20 game, or the
production application UI.

### 1. Preserve local development behavior

- [x] Record baseline commands and verify they work before deployment changes:
  - `just run-backend`
  - `cd frontend && npm run dev`
  - `backend/.venv/bin/python -m pytest`
  - `cd frontend && npm test`
- [x] Keep local backend defaults on port 6767 with `APP_ENV=development` or no
  explicit `APP_ENV`.
- [x] Keep the local frontend base at `/` and its default socket at
  `ws://127.0.0.1:6767/ws`.
- [x] Keep the Firefox extension capable of using
  `ws://127.0.0.1:6767/ws/chat`.

### 2. Add production-aware frontend configuration

- [x] Update `frontend/vite.config.ts` to use `/` in development and
  `/ttrpg/` in production.
- [x] Add `frontend/.env.production` with
  `VITE_WS_URL=wss://bossadapt.org/ttrpg/ws`.
- [x] Do not define `VITE_PLAYER_AUTH_TOKEN` or `VITE_DM_AUTH_TOKEN` in the
  production frontend environment.
- [x] Build the frontend and verify generated asset URLs are under `/ttrpg/`.
- [x] Run frontend tests, lint, formatting checks, and the production build.

### 3. Make Roll20 guidance environment-aware

- [x] Replace the localhost-only bridge troubleshooting text in
  `frontend/src/hooks/useGameClient.ts` with instructions to check the Firefox
  extension's configured bridge URL and service code.
- [x] Preserve the extension's editable runtime settings for backend URL and
  service code.
- [x] Decide during implementation whether to add Local and Production preset
  buttons; do not embed the production service code in extension source.
- [x] Document the production bridge URL as
  `wss://bossadapt.org/ttrpg/ws/chat`.
- [ ] Verify the locally running extension can switch between local and hosted
  backends without rebuilding it.

### 4. Add production secret handling

- [x] Add `production-secret.env` to `.gitignore`.
- [x] Add deployment archive names to `.gitignore`.
- [x] Create a local ignored `production-secret.env` containing:
  - `APP_ENV=production`
  - an independently generated cryptographically random `PLAYER_JOIN_CODE`
  - an independently generated cryptographically random `DM_ADMIN_CODE`
  - an independently generated cryptographically random `SERVICE_AUTH_CODE`
- [x] Generate each production code from at least 32 random bytes and never use
  the development defaults `player`, `dm`, or `service`.
- [x] Add a Justfile recipe that uploads the local production env when present,
  otherwise reuses `/srv/ttrpg/.env`, and fails when neither exists.
- [x] Install the remote env as `/srv/ttrpg/.env`, owned by
  `www-data:www-data`, mode 600.
- [x] Remove the temporary remote secret after installation without printing
  secret contents.

### 5. Add the production systemd unit

- [x] Create `deploy/ttrpg.service`.
- [x] Configure `WorkingDirectory=/srv/ttrpg`.
- [x] Configure `EnvironmentFile=/srv/ttrpg/.env`.
- [x] Run `/srv/ttrpg/backend/.venv/bin/uvicorn backend.core.main:app` on
  `127.0.0.1:6767`.
- [x] Run the service as `www-data:www-data`.
- [x] Configure automatic restart with a short delay.
- [x] Ensure normal systemd stop uses graceful SIGTERM so FastAPI writes its
  final checkpoint.
- [x] Add a Justfile bootstrap/service-install recipe that installs the unit,
  runs `systemctl daemon-reload`, and enables it.

### 6. Implement frontend packaging and deployment recipes

- [x] Add strict-shell Justfile constants for `personal`, the frontend build
  directory, `/var/www/bossadapt.org/ttrpg`, and a uniquely named archive.
- [x] Add `build-frontend`, `pack-frontend`, and `upload-frontend` recipes.
- [x] Package the contents of `frontend/dist`, not the directory itself.
- [x] Upload through `/tmp` and remove local and remote temporary archives.
- [x] Add `deploy-frontend` to replace only static frontend files.
- [x] Ensure the destination files are readable by Nginx.

### 7. Implement backend packaging and deployment recipes

- [x] Add Justfile constants for `/srv/ttrpg`, `ttrpg.service`, the backend
  archive, and `backend/requirements.txt`.
- [x] Package the required repository-root/backend files while excluding:
  - `.git`
  - local virtualenvs
  - `node_modules` and frontend build output
  - Python caches, test caches, and bytecode
  - `production-secret.env` and other local environment files
  - `state_dumpy.json`, `state_dumpy.json.bak`, and `state_dumpy.json.tmp`
  - deployment archives
- [x] Upload the backend archive through `/tmp`.
- [x] Stop `ttrpg.service` gracefully before replacing backend code.
- [x] Preserve `/srv/ttrpg/.env`, `/srv/ttrpg/state_dumpy.json`, and
  `/srv/ttrpg/state_dumpy.json.bak` during every routine deployment.
- [x] On the first deployment, verify no checkpoint exists in `/srv/ttrpg`
  before startup so the backend creates fresh default state.
- [x] Extract application files with ownership that allows `www-data` to create
  and atomically replace checkpoint files.
- [x] Recreate `/srv/ttrpg/backend/.venv` on every deployment.
- [x] Install dependencies from `/srv/ttrpg/backend/requirements.txt`.
- [x] Start `ttrpg.service` and fail deployment if it does not become active.

### 8. Implement maintenance-mode orchestration

- [x] Add an explicit maintenance/unavailable state for the public `/ttrpg`
  application during `deploy-all`.
- [x] Build and validate both artifacts before taking the site offline.
- [x] Take the public application offline before stopping the backend.
- [x] Deploy and validate the backend before deploying the matching frontend.
- [x] Keep the application offline if backend installation or validation fails.
- [x] Restore public access only after backend and frontend validation passes.
- [x] Add shell traps that clean temporary artifacts without masking the
  deployment error or incorrectly restoring a failed release.

### 9. Update shared Nginx configuration

- [x] Preserve the existing uncommitted `/blogs` change in
  `/home/devinphillips20/Desktop/Projects/server_config/default`.
- [x] Add the `/ttrpg` to `/ttrpg/` redirect.
- [x] Add the `/ttrpg/` static alias and SPA fallback.
- [x] Add the `/ttrpg/ws` proxy to `http://127.0.0.1:6767/ws`.
- [x] Include WebSocket upgrade, forwarding, and host headers.
- [x] Add long WebSocket read and send timeouts.
- [x] Run `nginx -t` before reloading Nginx.
- [x] Reload rather than restart Nginx.
- [x] Confirm Cloudflare continues proxying `bossadapt.org` with origin TLS and
  WebSocket support.

### 10. Add operational and verification recipes

- [x] Add `status-backend` using full, non-paged systemd status.
- [x] Add `logs-backend` using recent `journalctl` output.
- [x] Add a direct readiness check from `personal`:
  `curl --fail http://127.0.0.1:6767/openapi.json`.
- [x] Add a public frontend check for `https://bossadapt.org/ttrpg/`.
- [x] Verify `wss://bossadapt.org/ttrpg/ws` through Cloudflare and Nginx.
- [ ] Verify `wss://bossadapt.org/ttrpg/ws/chat` using the locally running
  Firefox extension and production service code.
- [ ] Verify the extension can deliver a chat message into an open Roll20 game.
- [x] Add `ssh` and cleanup recipes.

### 11. Update documentation

- [x] Update the root `README.md` with local and production run/deploy commands.
- [x] Update `firefox_extension/README.md` with local and hosted bridge setup.
- [x] Document that the extension runs on the client and only its WebSocket
  backend is hosted.
- [x] Document first-deploy fresh-state behavior and the prohibition against
  running `just seed` in production.
- [x] Document full-state export as the campaign backup mechanism.
- [x] Document bootstrap, deploy, status, logs, maintenance behavior, and common
  recovery steps.

### 12. Final regression and production acceptance

- [x] Run all backend tests.
- [x] Run frontend tests, lint, touched-file formatting, protocol generation
  checks, and the production build. Repository-wide formatting has unrelated
  pre-existing drift.
- [x] Re-run the local-development acceptance criteria.
- [x] Verify production auth refuses development defaults.
- [x] Verify the first production start creates fresh default state.
- [ ] Make a production state mutation, redeploy, and verify the live state is
  preserved.
- [ ] Export the complete campaign state from the application page and verify it
  can be downloaded.
- [ ] Confirm static assets, both WebSocket endpoints, Cloudflare proxying, and
  Roll20 delivery operate together.
- [x] Record any deployment deviations or unresolved operational issues in this
  file and update `plan/active/PLAN.md` when implementation is complete.

### Automated Verification Result — 2026-07-04

- Backend: 434 tests passed.
- Frontend: 353 tests passed; lint and production build passed.
- Touched frontend/extension/deployment files pass Prettier checks. The existing
  repository-wide formatting drift remains unrelated and was not rewritten.
- Production frontend, redirect, and SPA fallback return successfully through
  Cloudflare and Nginx.
- Production rejects the development `player` authentication default.
- Authenticated application and Roll20 bridge WebSockets pass through
  `wss://bossadapt.org/ttrpg/ws` and `/ttrpg/ws/chat`.
- `ttrpg.service` is enabled and active on `127.0.0.1:6767`.
- First startup used fresh default state. A routine `deploy-all` cycle then
  created, retained, and reloaded the production checkpoint.
- Production `.env` and checkpoint files are owned by `www-data` with mode 600.
- Static frontend files are owned by `root:root` and readable by Nginx.
- Live Nginx configuration matches the local `server_config/default`, validates
  with `nginx -t`, and preserves the pre-existing `/blogs` change.
- Maintenance is disabled and temporary deployment archives/secrets are absent.
- Remaining manual checks are the unchecked Firefox/Roll20 and application-UI
  items above.
