# Backend Authority and WebSocket Protocol

## Purpose and scope

The FastAPI backend is the authority for authentication, canonical game state,
validation, calculations, mutations, persistence, and player-visible
redaction. The frontend submits typed intents and reconciles to backend events.
The public application transport is WebSocket-based; low-level mutation helpers
are not public client operations.

This document covers the application contract and request flow. State delivery
is detailed in [State sync, redaction, and undo](state-sync-redaction-and-undo.md).
The separate service socket used by Roll20 is covered in
[Roll20 bridge](../features/roll20-bridge.md).

## Endpoints and request flow

[`backend/routes/ws.py`](../../backend/routes/ws.py) exposes:

- `/ws` for application clients authenticating as player or DM.
- `/ws/chat` for the service-token-authenticated Roll20 userscript bridge.

An application request flows through these layers:

1. `ws.py` parses JSON, supplies a request ID when one is absent, and obtains
   the current `WebSocketSession`.
2. [`backend/core/request_registry.py`](../../backend/core/request_registry.py)
   resolves the stable request `type`.
3. The registered `RequestRoute` validates the feature-owned Pydantic request,
   enforces the declared minimum role, and records client-generation metadata.
4. A feature handler coordinates the request; its service owns domain
   validation and mutation construction.
5. Persisted changes pass through the authoritative state-sync service, which
   emits ordered patches.

Feature modules normally keep transport models in `schema.py`, route
registration in `route.py`, orchestration in `handler.py` when needed, and
domain logic in `service.py`. Some small features omit a handler and call their
service directly from the route.

## Contract ownership and code generation

The request registry is the source of truth for public application request
availability. Each registered route supplies its request model, emitted event
models, minimum role, and generated client namespace/method metadata.

[`backend/protocol/generate_typescript.py`](../../backend/protocol/generate_typescript.py)
combines registry-owned request/event models with
[`backend/protocol/state_schema.py`](../../backend/protocol/state_schema.py) and
writes [`frontend/src/generated/backendProtocol.ts`](../../frontend/src/generated/backendProtocol.ts).
The generated file contains transport types, the request/event unions, and
`protocolRouteContracts`.

Frontend request-builder functions are currently centralized, typed helpers in
[`frontend/src/infrastructure/ws/requestBuilders.ts`](../../frontend/src/infrastructure/ws/requestBuilders.ts).
They are built on generated payload types; the functions themselves are not
generated. Regenerate the contract with `just generate-protocol` or
`npm run generate:protocol` from the `frontend/` directory after changing
public schemas or route metadata.

## Responses, errors, and correlation

Server events use stable discriminated `type` fields. The protocol includes
authentication responses, snapshots, patches, feature-specific responses,
action acknowledgements, and correlated errors. `request_id` links the original
intent to a direct response, error, patch, or acknowledgement. The backend
generates an ID for object-shaped requests that omit one; malformed non-object
payloads cannot receive that correlation.

Validation, permission, migration, and domain errors are converted to explicit
`error` events. Unknown request types are rejected by the registry. Individual
features may additionally fail an otherwise valid request when entity
references, permissions, current state, or external delivery prerequisites are
not satisfied.

## Invariants

- Gameplay outcomes and persisted mutations are finalized on the backend.
- Public request types remain stable unless an intentional protocol change is
  made across backend, generation, frontend, and tests.
- Role requirements belong on routes; client-provided role claims are never
  trusted.
- Feature code does not publish raw internal state mutation paths as generic
  public CRUD operations.
- Generated protocol output is refreshed in the same change as its backend
  source.
- Application clients reconcile to snapshots and patches instead of treating a
  local request as proof that a mutation succeeded.

## Principal tests

- [`backend/tests/test_request_registry.py`](../../backend/tests/test_request_registry.py)
  verifies registration, role metadata, model discovery, and route behavior.
- [`backend/tests/test_protocol_codegen.py`](../../backend/tests/test_protocol_codegen.py)
  verifies generated output and registry-backed contracts.
- [`backend/tests/test_ws.py`](../../backend/tests/test_ws.py) exercises parsing,
  authentication, permissions, errors, and end-to-end WebSocket contracts.
- [`frontend/src/infrastructure/ws/requestBuilders.test.ts`](../../frontend/src/infrastructure/ws/requestBuilders.test.ts)
  verifies typed client payload construction.

## Limitations and deferred direction

Route metadata is generated, but generated client methods are a future
extension. Adding that generation must preserve the current central transport
boundary rather than introduce feature-local payload definitions.
