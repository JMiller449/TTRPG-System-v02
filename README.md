# TTRPG-System-v02

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.


Backend-first TTRPG system with authoritative state, websocket-driven gameplay, DM-only content authoring, and a local Firefox extension that bridges backend chat messages into Roll20.

## Current Shape

- `backend/`: FastAPI backend, websocket transport, state sync, runtime logic, and DM admin features
- `frontend/`: frontend workspace
- `firefox_extension/`: local Firefox extension for Roll20 chat delivery

## What Exists Today

- First-application-message websocket auth with three codes:
  - player
  - DM
  - service
- Authoritative backend state with versioned snapshots and patches
- Registry-backed public app websocket routes for auth, runtime actions, chat, and resync
- Generated frontend protocol types and route-contract metadata sourced from backend route registration
- Basic runtime support for:
  - rolling basic checks
  - performing authored actions
- Firefox extension that connects to the backend on Roll20 editor pages and sends chat messages into Roll20
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

The backend websocket endpoints are:

- app clients: `ws://127.0.0.1:6767/ws`
- Roll20 bridge: `ws://127.0.0.1:6767/ws/chat`

## Load The Firefox Extension

For local use on your machine, you do not need to package or sign it.

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on`
3. Select [manifest.json](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/firefox_extension/manifest.json)

Then:

1. Keep the backend running on port `6767`
2. Open your Roll20 game at `https://app.roll20.net/editor/...`
3. The extension will connect automatically when that page is open

The extension only runs on `https://app.roll20.net/editor/*`.

## Development Notes

- Active frontend/backend migration work is tracked in [backend_takeover.md](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/backend_takeover.md).
- Backend state sync is patch-first:
  - clients get a full snapshot on connect
  - later changes arrive as ordered `state_patch` diffs
  - snapshots and patches include `state_version`
  - clients should resync if they detect a version gap
- Frontend state ownership is split:
  - backend-authoritative server state comes from auth/snapshot/patch events
  - active sheet selection, page/view state, drafts, and pending UX stay frontend-local
- Roll20 chat delivery is fail-fast:
  - if the extension bridge is connected, chat sends immediately
  - if not, the backend returns an error instead of queueing messages

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
- The Firefox extension authenticates first on `/ws/chat` with the service code.
- Route-level DM requirements should be declared on `RequestRoute`.
- Do not trust role claims from client payloads.

## Testing

Run backend tests from the repo root:

```bash
./backend/.venv/bin/python -m pytest backend/tests -q
```
