# Frontend State and Transport

## Purpose and ownership split

The React/Vite frontend renders backend-authoritative game state and submits
typed intents. It owns presentation state such as navigation, active-sheet
selection, drafts, filters, pending requests, and connection feedback. It does
not finalize gameplay calculations or persist canonical outcomes.

## Transport layers

The client boundary is divided into focused layers:

- [`frontend/src/infrastructure/transport/`](../../frontend/src/infrastructure/transport/)
  defines the generic game transport and WebSocket implementation.
- [`frontend/src/infrastructure/ws/SocketProtocolClient.ts`](../../frontend/src/infrastructure/ws/SocketProtocolClient.ts)
  decodes generated protocol events.
- [`frontend/src/infrastructure/ws/GameClient.ts`](../../frontend/src/infrastructure/ws/GameClient.ts)
  manages connection state, authentication reuse, request IDs, last-seen state
  version, and bounded reconnect backoff.
- [`frontend/src/infrastructure/ws/requestBuilders.ts`](../../frontend/src/infrastructure/ws/requestBuilders.ts)
  centralizes typed request construction on generated payload types.
- [`frontend/src/infrastructure/ws/eventAdapters.ts`](../../frontend/src/infrastructure/ws/eventAdapters.ts)
  applies backend-native patches and projects protocol records into frontend
  domain models.
- [`frontend/src/hooks/useGameClient.ts`](../../frontend/src/hooks/useGameClient.ts)
  connects transport events to React state and feature-facing client methods.

The generated protocol file is an input to these layers. Feature components do
not define parallel transport payload shapes.

## State model

[`frontend/src/app/state/`](../../frontend/src/app/state/) separates:

- `serverState`: normalized projections of sheets, instances, actions, items,
  formulas, attributes, effects, conditions, encounters, and action history.
- `uiState`: role-specific views, active instance selection, sheet tabs,
  connection presentation, and other local navigation choices.
- intent state: request-scoped pending, success, and failure feedback.

Snapshots replace normalized server collections. Patches are first applied to
the retained protocol document, projected into a complete domain snapshot, and
then reduced in the same way. This keeps snapshot and patch behavior aligned.

Feature editor drafts live in feature modules or component state until an
explicit save. Optimistic feedback may show that an intent is pending, but the
visible authoritative value reconciles to a later snapshot or patch.

## Application shell

[`frontend/src/app/App.tsx`](../../frontend/src/app/App.tsx) gates unauthenticated,
player-claim, player-console, and GM-console experiences. GM navigation selects
dedicated workspaces for characters, templates, actions, items, formulas,
attributes, proficiencies, conditions, effects, encounters, XP, action history,
state safety, and the extension. Player navigation exposes only assigned-sheet
capabilities and the extension workflow.

The shared console and status components under
[`frontend/src/features/console/`](../../frontend/src/features/console/) present
session state, navigation, and persistent request feedback. Role checks in the
UI improve usability but do not replace backend authorization or redaction.

## Reconnection and reconciliation

An unexpected disconnect schedules bounded reconnect attempts. After transport
reconnection, the client re-authenticates with the prior token and reconciles
from its last seen version. A full snapshot is used when replay is not safe or
available. Ending a session explicitly clears the retained auth token and local
connection state.

Claiming a character triggers a non-incremental resync so the server can
recompute visibility for the new session assignment.

## Styling and accessibility

Global layout and semantic theme tokens live under
[`frontend/src/styles/`](../../frontend/src/styles/), including the dense R6
console system. Feature styles may control presentation but must not encode
gameplay truth. Interactive summary cards and editors retain keyboard and
dismissal behavior tested at the component level.

Destructive controls use the shared
[`confirmDestructiveAction`](../../frontend/src/shared/ui/confirmDestructiveAction.ts)
boundary before submitting a request or removing an assignment from a saved
draft. Messages identify the affected entity and consequence. Cancelling leaves
the local draft intact and sends no intent; accepting still relies on the
backend's normal dependency, authorization, and state validation.

The desktop console owns the viewport and gives navigation, panels, editors,
and character destinations explicit internal scroll regions. On desktop-width
viewports no taller than 900 CSS pixels, fixed shell and character-sheet chrome
compacts so the active workspace retains useful height without introducing
whole-page horizontal scrolling. Viewports at or below 960 CSS pixels continue
to use the document-flow mobile layout instead of the fixed desktop shell.

## Principal tests

- Transport and adapters are tested under
  [`frontend/src/infrastructure/`](../../frontend/src/infrastructure/).
- Reducer and selector tests live under
  [`frontend/src/app/state/`](../../frontend/src/app/state/).
- [`frontend/src/hooks/useGameClient.test.ts`](../../frontend/src/hooks/useGameClient.test.ts)
  covers integration between transport events and store actions.
- Feature folders contain focused request-builder and component tests.
- [`frontend/src/app/App.test.ts`](../../frontend/src/app/App.test.ts) covers
  role and workspace routing.

## Limitations

Generated route metadata does not yet generate client methods. Some feature
request helpers remain explicit wrappers around the centralized client, but
their payloads are typed from the generated backend contract.
