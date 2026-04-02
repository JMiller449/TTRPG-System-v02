# WebSocket Protocol

This package defines the canonical websocket contract between the FastAPI backend and the React frontend.

## Type Generation

Generated frontend transport types live at [backendProtocol.ts](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/frontend/src/generated/backendProtocol.ts).

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

## Canonical Application Requests

Application websocket requests are discriminated by `type`.

- `authenticate`
- `resync_state`
- `send_roll20_chat_message`
- `perform_action`
- `create_entity`
- `update_entity`
- `delete_entity`

`create_entity`, `update_entity`, and `delete_entity` are current transitional admin contracts. The target direction is typed feature requests and semantic bridge commands rather than permanent generic entity CRUD.

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
