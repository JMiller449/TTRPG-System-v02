# Backend Architecture Plan

## Goal
- Refactor backend transport and domain handling into feature-oriented modules.
- Keep websocket ingress thin.
- Keep session/auth state separate from IPC schemas.
- Split admin editing work deeply enough that sheet editing, item editing, and formula authoring do not collapse into one oversized feature module.

## Core Rule
- Split by capability and use case, not by frontend screen and not purely by role.
- Use auth/session state to decide who may perform an operation.
- Use feature modules to define what the operation actually does.

## High-Level Backend Shape
```text
backend/
  core/
  routes/
  features/
    auth/
    chat/
    session/
    state_sync/
    sheet_runtime/
    sheet_admin/
  schemas/
    ipc_types/
  state/
```

## Feature Responsibilities

### `features/auth`
- Elevate a session to DM.
- Validate admin code.
- Return auth-specific responses.

### `features/session`
- Own websocket session state.
- Map `WebSocket -> Session`.
- Expose helpers for permission context.
- Keep runtime-only state out of `schemas/ipc_types`.

### `features/chat`
- Handle chat transport shapes.
- Route player-visible vs DM-only chat.
- Later support session-targeted or character-targeted messaging if needed.

### `features/state_sync`
- Own snapshot/patch contracts.
- Own resync behavior.
- Keep websocket connect/bootstrap sync logic out of unrelated features.

### `features/sheet_runtime`
- Player/runtime interactions against live sheet instances.
- Damage, healing, resource spending, status changes.
- Execute authored action pipelines against live sheet instances.
- Perform action, roll resolution entrypoints, and other gameplay intents.

### `features/sheet_admin`
- DM-side content authoring and editing flows.
- Template and instance CRUD.
- Formula authoring and validation.
- Item/action/stat authoring and editing.
- Author action macros/pipelines that runtime execution can consume.

## `sheet_admin` Internal Split
`sheet_admin` should be a parent feature with subfeatures instead of one flat module.

```text
features/
  sheet_admin/
    shared/
    sheets/
    items/
    actions/
    formulas/
    stats/
```

### `sheet_admin/shared`
- shared admin request/response helpers
- admin policy checks
- common edit result types
- common validation helpers

### `sheet_admin/sheets`
- create player sheet
- create enemy sheet
- update sheet metadata
- delete sheet
- template vs instance editing rules

### `sheet_admin/items`
- create/update/delete items
- inventory-facing authoring
- augmentation attachment/edit flows later

### `sheet_admin/actions`
- create/update/delete action definitions
- action metadata and cost editing
- author action step pipelines/macros
- define ordered effects like:
  - subtract mana
  - increment proficiency/proficiency counts
  - apply healing or damage
  - emit specific formulas/results into chat

## Action Model Direction
Actions should move away from being a single static record and toward being an authored pipeline of ordered steps.

Example mental model:
```text
ActionDefinition
  metadata
  costs
  prerequisites
  steps[]
```

Example step kinds:
- resource adjustment
- proficiency counter increment
- formula evaluation
- chat emission
- status application
- sheet field mutation

Example spell flow:
1. subtract mana
2. increment relevant proficiency/proficiency-use counters
3. evaluate the spell formula
4. emit the formula/result to chat
5. apply any resulting state mutation

This means the split should be:
- `sheet_admin/actions` authors the action definition and its steps
- `sheet_runtime` executes the action definition against a live sheet/session context

Action architecture implication:
- action authoring belongs under admin
- action execution belongs under runtime
- formulas should stay reusable and separate, then be referenced by action steps rather than embedded as ad hoc code

### `sheet_admin/formulas`
- formula authoring
- formula validation/parsing
- reusable formula builder payloads

### `sheet_admin/stats`
- stat/substat authoring
- manual admin stat adjustments
- rules around what players may not edit directly

## Suggested File Pattern Per Feature
Not every feature needs every file on day one, but this is the default pattern.

```text
feature/
  schema.py
  handler.py
  service.py
  policy.py
```

### `schema.py`
- Wire-level request/response models for that feature.
- Shared literals/enums that are only relevant to that feature.

### `handler.py`
- Thin transport adapter.
- Convert validated transport messages into service calls.
- Should stay small and orchestration-focused.

### `service.py`
- Business/use-case logic.
- State mutation orchestration.
- Calls into shared state store and rules logic.

### `policy.py`
- Permission checks.
- Example: session must be DM to perform sheet admin mutations.

## IPC Schema Plan
Move away from one global `requests.py` and one global `responses.py`.

Target shape:
```text
schemas/ipc_types/
  __init__.py
  registry.py
  shared.py
  auth.py
  chat.py
  sheet_runtime.py
  state_sync.py
  sheet_admin/
    shared.py
    sheets.py
    items.py
    actions.py
    formulas.py
    stats.py
```

### Rules for IPC Schemas
- A feature file may contain both inbound and outbound messages.
- Keep one central `registry.py` that assembles:
  - inbound request union
  - outbound response union
  - `parse_request(...)`
- Do not place runtime objects like websocket sessions in `schemas/ipc_types`.

## Session Plan
Session should stay runtime/backend-side, not in IPC schema files.

Target shape:
```text
features/
  session/
    service.py
    models.py
```

Session should own:
- websocket reference
- DM flag
- future connection metadata if needed

Session should not own:
- gameplay sheet state
- formula state
- persisted character data

## Websocket Route Target
`routes/ws.py` should eventually do only this:
1. accept websocket
2. resolve/create session
3. parse inbound transport message
4. dispatch to the correct feature handler
5. send outbound feature response or state patch

If route logic grows beyond orchestration, move it into a feature handler/service.

## Dispatch Plan
Introduce a central dispatcher layer once the feature split starts.

Example target:
```text
features/
  dispatch/
    handler.py
```

Responsibilities:
- map request type to feature handler
- pass session + request to that handler
- keep `routes/ws.py` from becoming a giant `match` statement

## Refactor Phases

### Phase 1: Stabilize Current Session/Auth/Chat Split
- Move websocket session management into `features/session`.
- Move DM elevation into `features/auth`.
- Move chat routing into `features/chat`.
- Keep current behavior unchanged while relocating code.

### Phase 2: Extract State Sync
- Move snapshot/patch contracts and sync helpers into `features/state_sync`.
- Keep connect/bootstrap behavior centralized there.

### Phase 3: Create `sheet_runtime`
- Pull runtime gameplay actions out of generic IPC files.
- Group damage/heal/resource/action operations together.
- Add policy checks where player-vs-DM distinctions matter.
- Introduce action execution pipeline logic for authored action steps.

### Phase 4: Create `sheet_admin` Parent Feature
- Start with `shared`, `sheets`, and `formulas`.
- Then split items/actions/stats once admin edit flows expand.
- Make `actions` explicitly responsible for authoring macro-style action definitions.

### Phase 5: Introduce Central Dispatcher
- Replace direct routing logic in `routes/ws.py` with feature dispatch.
- Keep a single parse step and feature-specific handling after that.

## Immediate Next Steps
1. Create `features/session/` and move `WebSocketSession` plus manager there.
2. Create `features/auth/` and move `ElevateToDM` handling there.
3. Create `features/chat/` and move `ChatUpdate` handling there.
4. Replace direct websocket route branching with a small dispatcher.
5. After session/auth/chat are stable, split IPC schemas into feature files.

## Current Architectural Decision
- `sheet_admin` should be a parent feature with subfolders.
- `sheet_runtime` should be separate from `sheet_admin`.
- auth/session should be separate from both.
- permissions should live in policy checks, not as the main folder structure.
- actions should be modeled as authored step pipelines, with admin authoring separated from runtime execution.
