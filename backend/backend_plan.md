# Backend Architecture Plan

For the ongoing frontend/backend migration sequence, also see [backend_takeover.md](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/backend_takeover.md).

## Current Shape

The backend is now split by feature and uses a thin transport layer.

```text
backend/
  core/
    main.py
    request_registry.py
    transport.py
  routes/
    ws.py
  features/
    auth/
    chat/
    session/
    state_sync/
    sheet_runtime/
    sheet_admin/
      actions/
      formulas/
      items/
      sheets/
      shared/
      stats/
  state/
    models/
    store.py
```

## Implemented

### Transport
- `routes/ws.py` owns websocket ingress for:
  - app clients on `/ws`
  - Roll20 bridge clients on `/ws/chat`
- `core/request_registry.py` is the live request registry and dispatch layer for app websocket requests.
- Registered websocket routes now also own route-level authorization requirements such as DM-only access.
- Feature transport models live with their feature code, not in a shared `schemas/ipc_types` tree.

### Auth And Session
- Websocket auth is now the first application message, not post-connect elevation.
- There are three codes:
  - player code
  - DM code
  - service code
- App websocket clients must authenticate as `player` or `dm` as their first message.
- The Roll20 bridge must authenticate as `service` as its first message.
- Session state lives in `features/session` and stores a fixed role for the connection.
- `elevate_to_dm` is no longer part of the protocol.

### Chat / Roll20 Bridge
- `features/chat` now represents Roll20 chat delivery.
- The Firefox extension connects to `/ws/chat`.
- Backend chat delivery is fail-fast:
  - if a bridge is connected, the message is sent immediately
  - if not, the request fails
- There is no deferred queue.
- The backend now consumes bridge `hello` and `chat_delivery` events for logging.

### State Sync
- `features/state_sync` owns:
  - connect bootstrap
  - state snapshot responses
  - resync requests
- `features/state_sync` is now also the serialized state mutation wrapper.
- State-changing services route authoritative writes through `state_sync` instead of mutating persisted state directly.
- `state_sync` now:
  - queues mutations through a single async lock
  - persists state after successful mutations
  - assigns a monotonically increasing `state_version` to each committed mutation
  - stores a bounded patch history for replay
  - broadcasts ordered `state_patch` diffs to connected app clients
  - exposes reusable mutation helpers:
    - `add`
    - `set`
    - `remove`
    - `increment`
    - `decrement`
- App websocket clients receive:
  - auth success
  - full state snapshot with `state_version`
  - subsequent ordered `state_patch` diffs after mutations, each with `state_version`
- `resync_state` now supports:
  - patch replay when the client provides `last_seen_version` and the backend still has the missing diffs
  - full snapshot fallback when the version is invalid or replay is unavailable

### Sheet Runtime
- `features/sheet_runtime` now owns the first runtime execution path.
- Implemented runtime websocket requests:
  - `perform_action`
- `perform_action` now executes authored action steps against the requested sheet for the currently supported step kinds:
  - `set_value`
  - `send_message`
- Runtime state mutations now flow through `state_sync`, so successful action execution emits:
  - broadcast `state_patch` diffs for state changes
  - `action_executed` as the operation summary response

### Sheet Admin
- `features/sheet_admin` is the DM-only authoring surface.
- Admin requests currently use:
  - `create_entity`
  - `update_entity`
  - `delete_entity`
- `entity_kind` routes them to the correct subfeature.
- Those generic contracts are transitional. The target direction is typed route contracts and semantic bridge operations, with route declarations driving generated frontend helper functions.
- DM-only enforcement for those requests now lives on the registered websocket routes, so unauthorized requests are rejected during dispatch before feature handlers run.
- Implemented authoring CRUD:
  - `action`
  - `formula`
  - `item`
  - `sheet`
- `stats` authoring is still not implemented.
- Successful admin mutations now:
  - mutate through `state_sync`
  - broadcast `state_patch` diffs
  - use patch-only success responses
  - use `error` responses for failures

### Action Authoring
- Actions are now modeled as authored step pipelines, not static combat records.
- Current action definition shape:

```text
Action
  id
  name
  notes
  steps[]
```

- Implemented action step kinds:
  - `send_message`
  - `set_value`
- Formula-backed values are used inside steps rather than dedicated cost/rank fields.
- Those step kinds are now consumable by the first `sheet_runtime.perform_action` implementation.

### Formula Model
- `state/models/formula.py` remains a domain model, not a sheet-admin-local model.
- Formula expansion is now:
  - relative to one root object
  - safe for dataclass attribute traversal
  - safe for dict traversal
  - guarded against formula cycles
- Target/enemy assumptions were removed from the formula logic.

## Current Feature Responsibilities

### `features/auth`
- Validate first-message websocket authentication.
- Build auth response payloads.
- Own the player/DM/service role decision.

### `features/session`
- Own websocket session registration and lookup.
- Track session role.
- Provide send/broadcast helpers and group counts.

### `features/chat`
- Build Roll20 chat transport payloads.
- Manage authenticated Roll20 bridge connections.
- Send direct chat messages to the Firefox bridge.

### `features/state_sync`
- Send connection bootstrap state.
- Return authoritative state snapshots.
- Serialize state mutations through one backend-owned queue/lock.
- Assign authoritative state versions.
- Build, store, replay, and broadcast ordered state diffs.
- Provide reusable low-level mutation primitives for other features.
- Keep raw path/state mutation primitives internal; they are not intended to become public frontend APIs.

### `features/sheet_runtime`
- Own runtime interactions against explicit sheet targets.
- Execute authored action pipelines against an explicit sheet target.
- Currently implemented requests:
  - `perform_action`
- Currently implemented runtime step execution:
  - `send_message`
  - `set_value`

### `features/sheet_admin`
- Own DM-only authoring and mutation flows.
- Keep authoring concerns separate from runtime action execution.
- Rely on route-level DM authorization instead of handler-local permission shims.

#### `sheet_admin/sheets`
- create/update/delete sheet definitions

#### `sheet_admin/items`
- create/update/delete item definitions

#### `sheet_admin/actions`
- create/update/delete action definitions
- author ordered action pipelines

#### `sheet_admin/formulas`
- create/update/delete reusable formula definitions

#### `sheet_admin/stats`
- reserved for stat authoring and adjustments
- not implemented yet

## State Shape Notes

The persisted in-memory state currently includes at least:

```text
state = {
  sheets: {},
  instanced_sheets: {},
  formulas: {},
  actions: {},
  items: {},
  ...
}
```

`sheet`, `item`, `action`, and `formula` authoring currently persist into this state store through `state_sync`.

## Remaining Work

### Near Term
- Implement `sheet_admin/stats`
- Decide whether proficiencies need dedicated admin CRUD next
- Add stronger validation around cross-entity references:
  - sheet action bridges pointing to real actions
  - sheet item bridges pointing to real items
  - formulas referenced by authored runtime flows

### Runtime
- Expand runtime step execution beyond:
  - `send_message`
  - `set_value`
- Add stronger runtime validation for focus ownership, targeting, and cross-entity references
- Flesh out combat/rules execution beyond the current basic check and action pipeline baseline

### Transport / Ops
- Decide whether to keep the HTTP chat debug endpoint long-term
- Consider surfacing bridge delivery status back to app clients if needed
- Move auth codes to explicit environment/config management if deployment needs tighten
- Continue trimming redundant websocket success payloads when the authoritative patch stream already proves success
- Have frontend clients track `last_seen_version` and request replay or full resync on any detected version gap

## Current Architectural Decisions
- Keep domain models under `state/models`, not under admin features.
- Keep websocket auth at connection start, not as a runtime privilege escalation.
- Keep the Roll20 bridge as a service-authenticated websocket client.
- Keep authored action definitions generic and formula-driven.
- Keep action authoring in `sheet_admin` and action execution in `sheet_runtime`.
- Route authoritative state mutations through `state_sync` so diff ordering and broadcast behavior stay centralized.
- Treat `state_version` from `state_sync` as the primary frontend synchronization contract.
- Keep websocket permission requirements declared on registered routes so authorization is visible at the transport boundary.
