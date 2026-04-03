# WebSocket Protocol

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.


This package defines the canonical websocket contract between the FastAPI backend and the React frontend.

## Type Generation

Generated frontend transport types live at [backendProtocol.ts](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/frontend/src/generated/backendProtocol.ts).

That generated file now also exports `protocolRouteContracts`, a registry-backed
manifest of public websocket route metadata for future typed frontend helper
generation.

Each route contract currently includes:

- request `type`
- request model name
- emitted event `type` list
- `minimumRole` (`unauthenticated`, `player`, or `dm`)
- generated client namespace/method metadata

Refresh them with:

```bash
cd frontend
npm run generate:protocol
```

## Rules

- Backend internal models may evolve.
- Websocket transport models change deliberately and should be treated as API contract.
- Auth/session bootstrap is limited to auth/session truth plus authoritative state bootstrap.
- Legacy connection-count or socket-group events are not part of the application websocket contract.
- Raw backend state/path mutation helpers are internal implementation details, not part of the public websocket request API.
- Route declarations are the intended source for future generated frontend helper functions as well as transport types.
- App-route auth availability is part of that registry-backed contract surface via
  the generated `minimumRole` metadata.

## Canonical Application Requests

Application websocket requests are discriminated by `type`.

- `authenticate`
- `resync_state`
- `send_roll20_chat_message`
- `perform_action`

Typed sheet-admin requests are not public websocket contracts yet. The old generic
entity CRUD requests were removed so future admin APIs can be added on a clean,
typed route surface.

## Canonical Application Server Events

Application websocket responses/events are discriminated by `type`.

- `authenticate_response`
- `state_snapshot`
- `state_patch`
- `action_executed`
- `error`

## Bootstrap Flow

For the main app websocket:

1. Client connects.
2. Client sends `authenticate`.
3. Backend sends `authenticate_response`.
4. Backend sends `state_snapshot`.

There is no `socket_group_assigned` event in the application bootstrap flow.

## Snapshot Shape

`state_snapshot.state` is the authoritative backend state payload.

Top-level keys:

- `sheets`
- `instanced_sheets`
- `formulas`
- `actions`
- `items`
- `proficiencies`

The typed snapshot schema lives in [state_schema.py](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/backend/protocol/state_schema.py).

## Patch Shape

`state_patch.ops` uses the backend-native patch dialect:

- `set`
- `inc`
- `add`
- `remove`

Paths use the backend JSON-pointer-like state path format.

These raw patch ops are public for state synchronization. The corresponding low-level backend mutator helpers remain internal backend plumbing.
