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

Formula payloads include optional semantic `tags`. The backend normalizes tags by
trimming and collapsing whitespace, case-folding, and removing duplicates while
preserving first-seen order. Missing tags remain backward compatible and load as
an empty list.

## Canonical Application Requests

Application websocket requests are discriminated by `type`.

- `authenticate`
- `resync_state`
- `get_variable_registry`
- `generate_sheet_access_code`
- `get_sheet_access_codes`
- `send_roll20_chat_message`
- `create_action`
- `update_action`
- `delete_action`
- `create_formula`
- `update_formula`
- `delete_formula`
- `create_item`
- `update_item`
- `delete_item`
- `create_sheet`
- `update_sheet`
- `delete_sheet`
- `create_instanced_sheet`
- `set_instanced_sheet_notes`
- `set_instanced_sheet_resource`
- `adjust_instanced_sheet_resource`
- `apply_instanced_sheet_damage`
- `create_sheet_action_bridge`
- `update_sheet_action_bridge`
- `delete_sheet_action_bridge`
- `create_sheet_item_bridge`
- `update_sheet_item_bridge`
- `delete_sheet_item_bridge`
- `create_sheet_proficiency_bridge`
- `update_sheet_proficiency_bridge`
- `delete_sheet_proficiency_bridge`
- `create_condition_preset`
- `update_condition_preset`
- `delete_condition_preset`
- `upsert_item_augmentation_template`
- `remove_item_augmentation_template`
- `set_sheet_base_stat`
- `set_sheet_formula_stat`
- `perform_action`
- `get_xp_tracker`
- `set_sheet_xp_required`
- `set_mob_xp_value`
- `set_sheet_mob_kill_count`

Only the typed sheet-admin routes listed above are public websocket contracts.
The old generic entity CRUD requests were removed so future admin APIs can be
added on a clean, typed route surface.

## Canonical Application Server Events

Application websocket responses/events are discriminated by `type`.

- `authenticate_response`
- `state_snapshot`
- `state_patch`
- `action_executed`
- `variable_registry`
- `sheet_access_codes`
- `xp_tracker`
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
- `augmentations`
- `condition_presets`

The typed snapshot schema lives in [state_schema.py](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/backend/protocol/state_schema.py).

Sheet access codes are persisted in backend state but are not part of public
state snapshots or state patches. DMs retrieve them through the DM-only
`sheet_access_codes` response from `generate_sheet_access_code` and
`get_sheet_access_codes`.

## Patch Shape

`state_patch.ops` uses the backend-native patch dialect:

- `set`
- `inc`
- `add`
- `remove`

Paths use the backend JSON-pointer-like state path format.

These raw patch ops are public for state synchronization. The corresponding low-level backend mutator helpers remain internal backend plumbing.
