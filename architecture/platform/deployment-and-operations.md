# Deployment and Operations

## Production shape

The production frontend is built as a Vite static application under `/ttrpg/`.
Cloudflare and Nginx serve those assets and proxy `/ttrpg/ws` and
`/ttrpg/ws/chat` to a FastAPI/Uvicorn process listening on loopback port 6767.
The backend runs as `www-data` through the systemd unit in
[`deploy/ttrpg.service`](../../deploy/ttrpg.service).

Initial installation and Nginx changes depend on the sibling `server_config`
repository and the configured local `ssh personal` target. Repository-local
orchestration lives in [`justfile`](../../justfile). Routine deployment can be
started either from that local target or from the manual
[`Deploy Production`](../../.github/workflows/deploy-production.yml) GitHub
Actions workflow.

## Build and verification

`just check` regenerates the protocol, runs backend and frontend tests, lints
the frontend, and performs the production frontend build. The build verifies
the production WebSocket URL, `/ttrpg/` asset base, and packaged Roll20
userscript identity/version metadata.

Backend archives exclude development environments, tests, seed helpers,
caches, credentials, and checkpoint files. Frontend archives contain the built
SPA and userscript. Production dependencies are installed into a fresh virtual
environment during deployment.

[`deploy/verify_websockets.py`](../../deploy/verify_websockets.py) verifies the
deployed application and chat sockets using production configuration. Public
verification also checks HTTPS SPA delivery and userscript headers/content.

## Credentials

`just init-production-env` creates an ignored `production-secret.env` with
independent random player, DM, and service codes and restrictive permissions.
The values are not printed. Deployment installs this file as `/srv/ttrpg/.env`
owned by the service account. Production authentication material must never be
placed in `VITE_*` variables, checked-in source, archives, or logs.

## Maintenance-mode deployment

`just deploy-all` packages and tests before changing the server, enters
maintenance mode, stops and replaces the backend, publishes the matching
frontend, exits maintenance, and runs public verification. A failed backend,
frontend, or public verification step leaves or restores maintenance mode so a
partially deployed application is not presented as healthy.

The GitHub workflow is manual-only and restricted in both workflow logic and
the production environment to `main`. Its first job runs the same tests and
build, produces the same code-only frontend and backend archives, records their
SHA-256 checksums, and uploads them as a one-day workflow artifact. That job
does not have production credentials.

After verification succeeds and the protected `production` environment is
approved, a separate job downloads the artifact from the same workflow run,
verifies its checksums, and materializes a deployment-only SSH identity. It
then runs `just deploy-prebuilt`, which validates and uploads those archives
before entering the same internal maintenance, replacement, and public
verification sequence as `just deploy-all`. GitHub deployments are serialized
and an active deployment is not canceled when another is requested.

The production environment owns `PRODUCTION_SSH_HOST`,
`PRODUCTION_SSH_PORT`, `PRODUCTION_SSH_USER`,
`PRODUCTION_SSH_PRIVATE_KEY`, and `PRODUCTION_SSH_KNOWN_HOSTS`. Only these
secret names are public. The workflow has read-only repository permissions,
pins third-party action revisions, disables persisted checkout credentials,
and uses strict SSH host verification. Repository administrators and required
deployment reviewers are therefore inside the production trust boundary even
though untrusted fork workflows do not receive the environment credentials.

First installation uses `just bootstrap` to install the maintenance page,
systemd service, Nginx configuration, credentials, and application. Routine
deployments preserve the production primary and backup checkpoints because
archives never contain local state.

Operational commands include backend status/log inspection and explicit entry
or exit from maintenance mode. These commands affect external infrastructure
and require the configured host privileges.

## Persistence boundary

The production checkpoint lives under `/srv/ttrpg` and is owned by the service
account. A first deployment without one starts fresh. Routine deployment must
not overwrite it. Campaign exports from the DM backup workspace provide a
separate recoverable copy outside the server checkpoint pair.

## Related implementation

- [`justfile`](../../justfile) is the operational source of truth.
- [`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml)
  is the manual GitHub production entry point.
- [`deploy/maintenance.html`](../../deploy/maintenance.html) is the static
  maintenance response.
- [`frontend/vite.config.ts`](../../frontend/vite.config.ts) owns the
  environment-specific base and build behavior.
- [`violentmonkey_extension/roll20-bridge.user.js`](../../violentmonkey_extension/roll20-bridge.user.js)
  is copied into the frontend build.

## Limitations

The repository workflow targets one production host and one in-memory backend
process. Horizontal deployment and shared durable state are outside the current
architecture.
