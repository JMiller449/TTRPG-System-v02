# TTRPG-System-v02

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.

Backend-first TTRPG system with authoritative state, websocket-driven gameplay,
DM-only content authoring, and a Violentmonkey userscript that bridges backend
chat messages into Roll20 on Firefox.

## Current Shape

- `backend/`: FastAPI backend, websocket transport, state sync, runtime logic, and DM admin features
- `frontend/`: frontend workspace
- `violentmonkey_extension/`: installable Firefox/Violentmonkey userscript for
  Roll20 chat delivery

## What Exists Today

- First-application-message websocket auth with three codes:
  - player
  - DM
  - service
- Authoritative backend state with versioned snapshots and patches
- Registry-backed public app websocket routes for auth, runtime actions, chat, and resync
- Generated frontend protocol types and route-contract metadata sourced from backend route registration
- Basic runtime support for:
  - baseline checks represented as authored actions
  - performing authored actions
  - per-invocation public or GM-only Roll20 delivery
- Per-user installation and synchronization for a Violentmonkey userscript
  that connects each DM or claimed player sheet to Roll20
- Roll20 chat acts as the table play log; the app is not keeping a second authoritative roll log.

## Run The Backend

Create and install the backend environment if needed:

```bash
python -m venv backend/.venv
./backend/.venv/bin/pip install -r backend/requirements.txt
```

Run the backend from the repo root:

```bash
just run-backend
```

Or directly:

```bash
./backend/.venv/bin/python -m uvicorn backend.core.main:app --host 0.0.0.0 --port 6767
```

Run the frontend locally in a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Local development uses `ws://127.0.0.1:6767/ws` and serves the frontend at the
site root. Production configuration does not replace these defaults.

## Production Deployment

The production application is served through Cloudflare and Nginx at
`https://bossadapt.org/ttrpg/`. The static frontend lives under
`/var/www/bossadapt.org/ttrpg`; systemd runs the FastAPI backend from
`/srv/ttrpg` on loopback port `6767`.

Production deployment requires the sibling
`/home/devinphillips20/Desktop/Projects/server_config` repository and the
configured `ssh personal` target.

For the first deployment:

```bash
just init-production-env
just bootstrap
```

`init-production-env` creates ignored `production-secret.env` with independent
random player, DM, and service codes. It does not print them. Keep the DM and
service codes private; distribute the player code only to intended players.

Routine deployment is:

```bash
just deploy-all
```

Deployment intentionally returns a maintenance response while it stops the
backend, replaces code, recreates the server virtualenv, installs
`backend/requirements.txt`, and publishes the matching frontend. A failed
deployment leaves maintenance enabled.

Operational commands:

```bash
just status-backend
just logs-backend
just enter-maintenance
just exit-maintenance
```

The first production deployment does not upload local checkpoint files and
therefore starts with fresh default state. Routine deployments preserve the
server's `state_dumpy.json` and `state_dumpy.json.bak`. Use the DM state-export
page for campaign backups. Never run `just seed` against production.

## Seed Development State

Stop the backend, then replace the local checkpoint with the comprehensive
starter campaign:

```bash
just seed
```

The command builds and validates the seed in isolation before atomically
replacing `state_dumpy.json`. The previous valid checkpoint is retained as
`state_dumpy.json.bak`. Seeded content includes player and enemy templates,
instances, formulas, attributes, actions, proficiencies, equipment,
consumables, conditions, effects, and encounters.

The seeded player instances can be claimed with these development access
codes:

- `EXAMPLE1` — Example Player 1
- `EXAMPLE2` — Example Player 2

Do not run the seed command while the backend is active. A running process
retains its current state in memory and could overwrite the new checkpoint on
its next mutation.

The backend websocket endpoints are:

- app clients: `ws://127.0.0.1:6767/ws`
- Roll20 bridge: `ws://127.0.0.1:6767/ws/chat`

There is intentionally no HTTP chat debug endpoint. Roll20 chat delivery goes
through app websocket requests and the `/ws/chat` bridge only.

## Install And Sync The Firefox Userscript

1. Run the backend and frontend, authenticate, and open **Extension**. Players
   must claim their character first. The page immediately checks for the bridge
   userscript.
2. If the bridge is not detected, install Violentmonkey if needed, choose
   **Install or Update Roll20 Bridge**, and approve Violentmonkey's prompt.
3. Return to the Extension tab and choose **Reload to Activate** once after a
   new installation, then choose **Sync Bridge**.
4. Open or reload the Roll20 editor and use **Refresh Status** or **Send Test
   Message** to verify delivery.

Local development serves the install artifact at
`http://127.0.0.1:5173/roll20-bridge.user.js` and synchronizes
`ws://127.0.0.1:6767/ws/chat`. Production serves the same userscript identity at
`https://bossadapt.org/ttrpg/roll20-bridge.user.js` and synchronizes
`wss://bossadapt.org/ttrpg/ws/chat`.

Sync Bridge requests a signed token scoped to the authenticated DM or claimed
player-sheet instance and passes it directly to the detected userscript. The
frontend does not render or persist it. Violentmonkey stores one active binding
per browser profile; syncing after changing users, characters, or environments
replaces that local configuration. Every player and the DM must install and
sync the userscript in their own browser. The userscript and Roll20 interaction
still run locally in Firefox.

## Development Notes

- Active frontend/backend migration work is tracked in [PLAN.md](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/plan/active/PLAN.md).
- Local auth codes are configured through environment variables:
  - `PLAYER_JOIN_CODE` for app player auth, defaulting to `player` for local development.
  - `DM_ADMIN_CODE` for app GM auth, defaulting to `dm` for local development.
  - `SERVICE_AUTH_CODE` for the Roll20 bridge, defaulting to `service` for local development.
  - Frontend helper tokens use `VITE_PLAYER_AUTH_TOKEN` and `VITE_DM_AUTH_TOKEN`; keep them aligned with backend codes when using those helper paths.
- Backend state sync is patch-first:
  - clients get a full snapshot on connect
  - later changes arrive as ordered `state_patch` diffs
  - snapshots and patches include `state_version`
  - clients should resync if they detect a version gap
  - the backend retains bounded runtime mutation-audit metadata linking patch versions and paths to their originating request, actor role, and relevant entity IDs; mutation values are not duplicated in this trail
- Backend state remains authoritative in memory; `state_dumpy.json` is a recovery checkpoint rather than a queryable database.
  - Checkpoints use a versioned envelope and load legacy unversioned state as schema version `0`.
  - Writes are flushed to a temporary file and atomically replace the primary checkpoint.
  - The previous validated primary is retained as `state_dumpy.json.bak`; startup falls back to it when the primary is corrupt or unsupported.
  - State-shape upgrades are registered in `backend/state/store.py` as sequential version migrations.
  - DMs can export or import the private persisted-state envelope through typed websocket routes; imports replace state and force full client snapshots.
- Frontend state ownership is split:
  - backend-authoritative server state comes from auth/snapshot/patch events
  - active sheet selection, page/view state, drafts, and pending UX stay frontend-local
- Roll20 chat delivery is fail-fast:
  - DM-authored messages use only the DM bridge; player-authored messages use
    only the acting claimed sheet's bridge
  - if that user's bridge is not connected, the backend returns an error
    instead of queueing or falling back to another user's browser
  - the newest authenticated Roll20 tab wins only within the same binding,
    preventing duplicate delivery while other users remain connected

## Backend-First Contract Model

The backend is the authoritative core of the app.

- Backend owns auth/session truth, canonical game state, validation, mutations, snapshots, and patches.
- Frontend renders that state, submits requests/intents, and reconciles to backend output.
- Frontend should not invent gameplay truth, maintain its own transport contract, or keep a parallel source of domain authority.

The public app websocket contract is driven from backend route registration.

- [request_registry.py](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/backend/core/request_registry.py) is the source of truth for public app requests.
- Each route declares:
  - request model
  - emitted event models
  - minimum app role (`unauthenticated`, `player`, `dm`)
  - client-generation metadata
- [generate_typescript.py](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/backend/protocol/generate_typescript.py) reads that registry-backed contract and writes generated frontend protocol definitions.
- Generated output lives in [backendProtocol.ts](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/frontend/src/generated/backendProtocol.ts).

Today that generation produces:

- transport request/event TypeScript types
- registry-backed route-contract metadata via `protocolRouteContracts`

That generated contract is the base for centralized and future-generated frontend request helpers. New frontend transport work should build on that generated contract instead of adding handwritten feature-level payload shapes.

Refresh generated protocol output with:

```bash
cd frontend
npm run generate:protocol
```

## Backend Editing Notes

The backend is organized by feature. The thin transport layer lives at the top, and feature modules own their request schemas, route registration, handlers, and services.

### Backend Structure

- `backend/core/main.py`
  - FastAPI app setup
- `backend/routes/ws.py`
  - websocket ingress for app clients and the Roll20 bridge
  - transport-level websocket handling plus app request dispatch
  - hands app messages to the request registry
- `backend/core/request_registry.py`
  - central websocket request registry
  - maps request `type` to a feature route
  - enforces route-level authorization through the app role hierarchy
  - is the source for generated frontend protocol contract metadata
- `backend/features/<feature>/schema.py`
  - pydantic request models and dataclass response models for that feature
- `backend/features/<feature>/route.py`
  - registers request types with the central registry
- `backend/features/<feature>/handler.py`
  - request orchestration after route parsing and authorization
- `backend/features/<feature>/service.py`
  - lower-level business logic and state mutation calls
- `backend/state/models/`
  - shared domain models
- `backend/features/state_sync/`
  - authoritative mutation path, patch generation, versioning, replay, and snapshots

### Websocket Request Flow

For app websocket requests on `/ws`, the flow is:

1. `backend/routes/ws.py` receives JSON
2. `backend/core/request_registry.py` resolves the request by `type`
3. The matching feature `route.py` validates into that feature's request model and applies route-level authorization
4. The feature `handler.py` processes the request
5. Any real state change should go through `backend/features/state_sync/service.py`
6. `state_sync` emits authoritative `state_patch` updates

### How To Register A New Websocket Request

Add the request model in the owning feature's `schema.py`.

Example shape:

```python
from typing import Literal

from backend.core.transport import RequestModel


class ExampleRequest(RequestModel):
    value: str
    type: Literal["example_request"]
```

Add a route class in the owning feature's `route.py`.

Example shape:

```python
from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.session.models import WebSocketSession
from backend.protocol.socket import ExampleEvent

from . import handler
from .schema import ExampleRequest


class ExampleRequestRoute(RequestRoute[ExampleRequest]):
    type_name = "example_request"
    request_model = ExampleRequest
    emitted_event_models = (ExampleEvent,)
    minimum_role = "dm"
    permission_denied_reason = "This request requires an authenticated DM session."
    client_generation = ClientGenerationMetadata(
        namespace="example",
        method_name="runExample",
    )

    async def handle(self, session: WebSocketSession, request: ExampleRequest) -> None:
        await handler.handle_example_request(session, request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(ExampleRequestRoute())
```

Make sure that feature's `register_routes(...)` is imported and called from [request_registry.py](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/backend/core/request_registry.py).

If a websocket request is public app contract, declare its emitted models, role requirement, and client-generation metadata on the route instead of scattering that knowledge across handlers and frontend code.

### When Editing State

Do not mutate persisted game state directly from feature handlers or services.

Use `backend/features/state_sync/service.py` so the backend can:

- serialize mutations
- increment `state_version`
- emit `state_patch`
- keep replay history available for resync

Current low-level helpers include:

- `add`
- `set`
- `remove`
- `increment`
- `decrement`

If a change bypasses `state_sync`, clients can drift out of sync.

### How To Code On Top Of The Contract

When adding new behavior, build on the backend-owned contract instead of bypassing it.

Backend:

1. Add or update the feature request/event schemas.
2. Register the route with request model, emitted models, role requirement, and client-generation metadata.
3. Put authoritative mutations through `backend/features/state_sync/service.py`.
4. Add backend contract tests for request validation, auth, and emitted events.

Frontend:

1. Regenerate [backendProtocol.ts](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/frontend/src/generated/backendProtocol.ts).
2. Read the generated request/event types and `protocolRouteContracts`.
3. Add or extend centralized request helpers on top of that generated contract.
4. Reconcile UI state to backend snapshots and patches instead of inventing parallel local authority.

Do not:

- add frontend-only transport payload shapes that drift from backend schemas
- mutate authoritative game state directly in frontend reducers
- bypass `state_sync` for real backend state changes
- expose raw internal mutation helpers as public client APIs

### Auth Notes

- App clients authenticate as their first application message on `/ws` with a player or DM code.
- The Violentmonkey userscript authenticates first on `/ws/chat` with a signed,
  backend-issued token scoped to the DM or one claimed sheet instance.
- Route-level DM requirements should be declared on `RequestRoute`.
- Do not trust role claims from client payloads.
- Backend auth codes are configured with `PLAYER_JOIN_CODE`, `DM_ADMIN_CODE`, and
  `SERVICE_AUTH_CODE`. Copy `.env.example` to `.env` for `just run-backend`, or export the
  variables before starting Uvicorn.
- `APP_ENV=development` permits the documented local defaults (`player`, `dm`, and `service`).
  Any other environment requires all three codes to be explicitly configured and distinct.
- Optional frontend role shortcuts use `VITE_PLAYER_AUTH_TOKEN` and `VITE_DM_AUTH_TOKEN` from
  `frontend/.env.local`; compiled fallback codes are intentionally not provided.
- Configure each user's Roll20 bridge through their **Extension** page and
  **Sync Bridge** action; do not place `SERVICE_AUTH_CODE` in frontend state or
  userscript source.

## Testing

Run backend tests from the repo root:

```bash
./backend/.venv/bin/python -m pytest backend/tests -q
```
