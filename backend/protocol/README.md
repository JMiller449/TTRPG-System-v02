# WebSocket Protocol

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules. The current architecture overview is in `architecture/platform/backend-authority-and-websocket-protocol.md`.

This package defines and generates the canonical WebSocket contract between the
FastAPI backend and React frontend.

## Sources of truth

- [`backend/core/request_registry.py`](../core/request_registry.py) registers
  every public application request and its request model, emitted events,
  minimum role, and client-generation metadata.
- Feature-owned `schema.py` modules define request and direct-response shapes.
- [`state_schema.py`](state_schema.py) defines the public authoritative state
  payload used by snapshots and patches.
- [`socket.py`](socket.py) normalizes the complete server-event union.

Do not maintain a handwritten exhaustive request list in documentation. The
registry and generated `protocolRouteContracts` are the current inventory.

## Type generation

[`generate_typescript.py`](generate_typescript.py) writes
[`frontend/src/generated/backendProtocol.ts`](../../frontend/src/generated/backendProtocol.ts).
The generated output contains:

- transport request, response, event, and state types;
- `ProtocolApplicationRequest` and `ProtocolServerEvent` unions;
- `protocolRouteContracts`, including request type, models, emitted event types,
  minimum role, and client namespace/method metadata.

Refresh it from the repository root with `just generate-protocol` or from the
frontend directory with `npm run generate:protocol`.

Generated metadata does not currently generate client methods. Typed request
builders are centralized in
[`frontend/src/infrastructure/ws/requestBuilders.ts`](../../frontend/src/infrastructure/ws/requestBuilders.ts)
and consume the generated payload types.

## Contract rules

- Backend internal models may evolve independently, but public transport models
  change deliberately across backend, generated output, frontend, and tests.
- Stable request/event `type` values are discriminators and must not be renamed
  casually.
- Route-level auth availability belongs in registered `minimum_role` metadata.
- Auth/session bootstrap contains session truth and an authoritative state
  bootstrap; legacy socket-group events are not application contract.
- Raw backend state mutation helpers are internal. Public requests express
  feature intent through typed schemas.
- Formula tags are normalized by trimming/collapsing whitespace, case-folding,
  and removing duplicates while preserving first-seen order.

## Bootstrap and state flow

For the application socket:

1. Connect to `/ws`.
2. Send `authenticate`.
3. Receive `authenticate_response`.
4. Receive a role-redacted `state_snapshot` with `state_version`.
5. Reconcile later ordered `state_patch` events.

Sheet access codes and direct-effect projections are not part of ordinary
public state. Access codes use dedicated DM-only responses; projections remain
private backend bookkeeping.

Patch operations use the backend-native `set`, `inc`, `add`, and `remove`
dialect with JSON-pointer-like paths. The patch dialect is public for state
reconciliation; the mutation functions that produce it are not public APIs.

Request/response correlation uses `request_id`. The transport assigns an ID to
object-shaped requests when absent, and mutation processing suppresses repeated
IDs within its bounded runtime cache.

## Validation

- [`backend/tests/test_request_registry.py`](../tests/test_request_registry.py)
  verifies registration and route contracts.
- [`backend/tests/test_protocol_codegen.py`](../tests/test_protocol_codegen.py)
  verifies checked-in generated output.
- [`backend/tests/test_ws.py`](../tests/test_ws.py) exercises the public socket
  contract.
