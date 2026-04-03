# Backend Takeover Plan

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.


## Goal

Make the backend authoritative for game state, auth/session truth, and gameplay mutations while keeping React responsible for UI state, rendering, and intent submission.

This is not a move to backend-generated UI. It is a move to backend-authoritative state.

## Target Split

### Backend owns

- Authenticated websocket session role
- Canonical game/domain state
- All gameplay mutations and calculations
- Snapshot and patch delivery
- Validation and explicit error responses

### Frontend owns

- Routing and page/view selection
- Form draft state
- Search/filter inputs
- Pending banners and request lifecycle UX
- Temporary editor state that is not authoritative
- Any Roll20 chat integration state needed for display, but not a duplicated in-app roll history

## Core Rules

- Backend transport schemas are the stable API contract.
- The websocket request registry should evolve into the equivalent of HTTP route registration for app transport.
- Request availability should come from registered websocket routes, not from a separate handwritten list.
- Output and emitted event declarations should live close to registered routes so generation can follow the live backend contract.
- Frontend TypeScript types should be generated from transport schemas, not hand-maintained by feature.
- Frontend request helpers should eventually be generated from public websocket route contracts, not handwritten per feature.
- Only websocket snapshot and patch events mutate authoritative client state.
- React local state is allowed only for UI concerns, drafts, filters, pending UX, and display preferences.
- Roll history is no longer part of authoritative app state; Roll20 chat is the effective play log.
- Active sheet selection is frontend UI state; requests should include `sheetId` explicitly instead of relying on backend-owned active-sheet toggling.
- Raw state/path mutation helpers are internal backend implementation details and should not become public frontend APIs.
- Mock transport may remain for UI work, but it must match the real protocol instead of inventing its own.

## Augmentation Direction

Target direction:

- Replace item-owned `stat_augmentations` as the long-term effect model with a
  general backend-owned augmentation system.
- Treat an augmentation as an applied, reversible effect rather than as a
  special item-only stat bonus field.
- Augmentations should be able to represent item-granted buffs, poison and
  other status effects, ally-granted buffs, and similar future applied effects.
- The backend should remain authoritative for augmentation application,
  removal, stacking, and recomputation.
- Frontend should render augmentation state and submit intents, but should not
  invent augmentation math or lifecycle rules.

Likely model direction:

- Each augmentation should have stable identity so it can be removed or updated
  cleanly.
- Each augmentation should carry source metadata such as item, action, status,
  ally effect, or other future origin.
- Each augmentation should target validated backend-owned paths or references,
  not just hardcoded stat-name fields.
- Each augmentation should carry a formula/effect payload that the backend can
  evaluate or apply authoritatively.
- Duration, expiry, and other removal conditions should be part of augmentation
  semantics rather than being implied by the source type alone.

Future scope:

- Support conditional augmentations once the base augmentation model is stable.
- Conditional effects should stay backend-authored and backend-validated, for
  example logic such as "if weapon is fire type, double this formula result."
- Do not expose unrestricted raw path mutation to the frontend in the name of
  augmentation flexibility; keep augmentation authoring constrained by backend
  contracts and validation.

## Registry Direction

Target direction:

- `RequestRegistry` stays the source of truth for what websocket requests exist.
- Each registered route should declare its request model, emitted output models,
  and route-level auth requirement.
- Protocol/codegen should read from that registration surface the same way HTTP tooling reads route registrations and schemas.
- App-level shared envelopes and reusable payload models can still live in `backend/protocol/`, but request availability should come from the registry-backed routes.
- Public app-route auth should use a simple role hierarchy:
  - `unauthenticated`
  - `player`
  - `dm`
- `authenticate` should live inside that same registry-backed app-route contract
  surface rather than remaining a permanent special case.
- The Roll20 bridge `service` auth flow can stay separate from the app-route
  hierarchy because it is a one-off transport case.

Why this direction:

- Adding a new websocket request should feel like adding an HTTP route.
- Generation gets easier when live route registration and transport declarations are attached.
- New requests become less painful because request type, auth rule, request schema, and emitted events are declared together.

Output shape concern:

- Overlapping output shapes are expected and should be shared, not duplicated.
- If multiple routes emit the same event shape, they should reference the same output model.
- If two outputs are structurally similar but semantically different, keep them as distinct named event models with distinct `type` discriminants.
- Generation should build unions from declared models, not from anonymous ad hoc payloads emitted inside handlers.

Likely end state:

- request registry declares request model, role requirement, emitted models, and
  client-generation metadata
- backend protocol module provides shared event/payload model definitions
- frontend generated transport types come from those declared models
- frontend generated request helper functions come from the same declared route contracts

## Generated Frontend API Direction

Target direction:

- Generate frontend helper functions from public websocket route contracts, not just bare TypeScript types.
- Generated helpers should wrap websocket request sending with stable typed method names.
- Generation should come from route declarations plus request schemas, not from internal backend service functions.
- Raw state sync mutation helpers should remain internal-only and should not be exposed as generated frontend APIs.

Why this direction:

- Types alone prevent drift, but generated helpers also remove repetitive handwritten transport code.
- Route-backed helper generation keeps frontend ergonomics aligned with the real backend contract.
- Internal backend mutation plumbing can keep evolving without forcing frontend API churn.

Rule for public operations:

- Simple entity ownership operations can use typed CRUD-style route contracts.
- Bridge or relationship operations should use semantic commands, not fake CRUD.
- Prefer operations like `attach_item_to_sheet`, `detach_item_from_sheet`, `link_formula_to_action`, and `instantiate_sheet_from_template` over generic delete/update semantics when the real behavior crosses aggregates.

Likely end state:

- registry routes declare request model, emitted models, role requirement, and
  optional client-generation metadata
- generator emits TS request/event types plus frontend helper namespaces/functions
- frontend calls generated helper methods instead of handwritten feature-level websocket request builders
- backend `state_sync_service` remains the internal patch/mutation primitive rather than a public client API

## Phase 1: Lock the WebSocket Protocol

- [x] Define one canonical request envelope for frontend-to-backend websocket messages.
- [x] Define one canonical server event union for backend-to-frontend websocket messages.
- [x] Decide the canonical event names and remove naming drift across backend and frontend.
- [x] Pick one patch dialect and use it consistently.
- [x] Define one auth/session bootstrap shape.
- [x] Keep bootstrap limited to auth/session truth plus authoritative state. Do not add legacy socket-group events back in.
- [x] Define one snapshot shape for frontend consumption.
- [x] Create a dedicated backend protocol area, likely under `backend/protocol/`.
- [x] Prefer Pydantic transport schemas for anything that crosses the websocket boundary.
- [x] Add backend contract tests for auth, snapshot, patch, resync, and error payloads.

Done when:

- The frontend no longer has to guess whether the server will send `snapshot` vs `state_snapshot`.
- There is one documented event vocabulary for every websocket message type.
- Transport schemas are separated from internal backend model implementation details.

## Phase 2: Generate Frontend Types from the Protocol

- [x] Choose the generation path for TS types from backend schemas.
- [x] Generate request and server event shapes from the websocket protocol contract.
- [x] Stop hand-maintaining duplicate websocket event types in frontend feature code.
- [x] Keep generated transport types separate from frontend-only view-model types.
- [x] Document where generated files live and how they are refreshed.

Done when:

- Frontend websocket message shapes come from generation, not handwritten duplication.
- Transport type drift between backend and frontend is structurally harder to introduce.

## Phase 2.5: Move Protocol Truth Toward the Registry

- [x] Extend websocket route registration so each route can declare emitted output/event models.
- [x] Make route declarations the websocket equivalent of HTTP route registration plus response schema declaration.
- [x] Reuse shared output models when multiple routes emit the same event shape.
- [x] Keep distinct named event models when shapes overlap structurally but have different meaning.
- [x] Reduce manual protocol curation where the registry can provide the same truth directly.
- [x] Update generation so request unions and emitted event unions can be derived from registry-backed declarations.
- [x] Extend route declarations with client-generation metadata for future frontend helper generation.
- [x] Replace the narrow DM-only route auth flag with a registry-declared app-role hierarchy (`unauthenticated`, `player`, `dm`).
- [x] Move `authenticate` into the same registry-backed generated app-route contract surface as the other public websocket requests.

Done when:

- Request availability is derived from registered websocket routes.
- Output/event generation no longer depends on scattered handler knowledge.
- Adding a websocket route requires touching one clear registration surface instead of multiple disconnected files.
- Frontend helper generation has a clear metadata home on route declarations when that work starts.
- App-route auth and auth-bootstrap request availability come from the same registry-backed contract surface instead of handwritten websocket exceptions.

## Phase 3: Add a Dedicated WebSocket Wrapper

- [x] Add a narrow websocket client wrapper responsible for connect, disconnect, send, and event subscription.
- [x] Move raw JSON parsing and event normalization into that wrapper.
- [x] Track connection status and last seen state version in the wrapper or closely related transport state.
- [x] Handle auth bootstrap through the wrapper.
- [x] Handle reconnect and `resync_state` flow through the wrapper.
- [x] Reject or surface unknown event shapes explicitly instead of silently accepting them.

Suggested frontend shape:

- `frontend/src/infrastructure/ws/GameClient.ts`
- `frontend/src/infrastructure/ws/protocol.ts`
- `frontend/src/infrastructure/ws/eventAdapters.ts`

Done when:

- React components do not parse arbitrary websocket payloads.
- The app talks to a typed client API instead of a raw `WebSocket`.

## Phase 4: Split Frontend State into `serverState` and `uiState`

- [x] Create a `serverState` slice that is strictly a projection of backend-authoritative state.
- [x] Create or preserve a `uiState` slice for page/view selection, drafts, filters, pending requests, and banners.
- [x] Move auth/session-derived state into `serverState` or a server-derived session slice.
- [x] Ensure only server-originated auth/session events plus snapshot/patch events mutate `serverState`.
- [x] Keep local editing helpers from mutating authoritative state directly.

`serverState` should eventually cover:

- [x] Sheets
- [x] Instanced sheets
- [x] Items
- [x] Actions
- [x] Formulas
- [x] Auth/session info derived from server

Scope note:

- Phase 4 is only about authoritative state coverage and reconciliation.
- For `items`, `actions`, and `formulas`, done means snapshot/patch data lands in
  `serverState` cleanly and the frontend stops treating those domains as local
  source-of-truth state.
- Phase 4 does not require solving full GM authoring ergonomics for actions and
  formulas.
- Action/formula authoring is more complex because it depends on backend-owned
  variables, targets, aliases, and valid path metadata.
- That authoring metadata should come from backend contracts, not handwritten
  frontend path knowledge.

`uiState` should retain:

- [x] Connection status
- [x] Current page/tab
- [x] Active sheet selection
- [x] Search text
- [x] Unsaved form drafts
- [x] Pending request ids
- [x] Toast/banner feedback

Done when:

- The frontend store has a clear boundary between server truth and UI state.
- Local reducers no longer act like a second source of gameplay truth.

## Phase 5: Make Auth Fully Server-Derived

- [x] Remove frontend-local GM authentication as a source of truth.
- [x] Frontend sends `authenticate` as the first application message.
- [x] Backend validates token and assigns websocket session role.
- [x] Frontend derives `role`, auth flags, and gated UI from the auth/session response.
- [x] Keep only token/password inputs local.
- [x] Add frontend tests for successful and failed auth flows.
- [x] Add backend tests for player and GM auth bootstrap behavior.

Done when:

- Entering player or GM mode depends on backend auth/session responses, not local dispatches.
- Refreshing the page or reconnecting does not require frontend-only auth assumptions.

## Phase 6: Move the App to a Backend-Native Patch Model

- [x] Choose whether the backend JSON-pointer-like patch model is the canonical one.
- [x] Remove or adapt frontend-only patch ops like `upsert_sheet` if backend generic ops are the target.
- [x] Build one frontend patch applier for authoritative `serverState`.
- [x] Validate snapshot and incremental patch application against the same state shape.
- [x] Add reducer tests covering initial snapshot, incremental patch, and forced resync.

Done when:

- There is one patch application path for authoritative state.
- Backend patch output can be applied directly by the frontend without feature-specific ad hoc conversions.

## Phase 7: Introduce General Augmentations

- [ ] Replace item-owned `stat_augmentations` as the long-term effect model with
  a general backend-owned augmentation system.
- [ ] Model augmentations as applied, reversible effects rather than as
  item-only stat bonus fields.
- [ ] Give augmentations stable identity plus source metadata so item buffs,
  poison, ally buffs, and future applied effects can share one backend concept.
- [ ] Move augmentation targeting toward validated backend-owned paths or
  references instead of stat-name-only fields.
- [ ] Keep augmentation application, removal, stacking, and recomputation
  backend-authoritative.
- [ ] Add augmentation state to the authoritative frontend/server sync boundary
  once the backend shape is ready.
- [ ] Reserve room for future conditional augmentations without exposing
  unrestricted raw mutation to the frontend.

Examples this phase should support or prepare for:

- [ ] Item-given buffs
- [ ] Poison and other status effects
- [ ] Ally-given buffs
- [ ] Future conditional effects such as "if weapon is fire type, double this
  formula result"

Done when:

- `stat_augmentations` is no longer the conceptual center of effect modeling.
- Backend has one general augmentation concept that can be applied and removed
  across multiple domains.
- Frontend renders augmentation-backed state without inventing its own effect
  rules.

## Phase 8: Migrate Intent Families One by One

Migration order:

- [x] Auth/session
- [ ] Roll submission flow only, with no in-app roll-log authority
- [ ] Sheet create and update
- [ ] Sheet instancing and spawn flows
- [ ] Encounter save and spawn
- [ ] Item management
- [ ] Action and formula state adoption
- [ ] Action and formula authoring metadata (`targets`, variables, aliases, valid paths)
- [ ] Typed action and formula authoring routes

For each family:

- [ ] Frontend sends the request through generated or centralized typed helper functions.
- [ ] Backend validates and mutates canonical state.
- [ ] Backend emits patch or snapshot updates.
- [ ] Frontend reconciles `serverState`.
- [ ] Any optimistic UI remains temporary and is overwritten by server truth.
- [ ] Add backend contract tests.
- [ ] Add frontend reconciliation tests.

Done when:

- The frontend is no longer inventing or finalizing domain outcomes for that intent family.
- The frontend does not need handwritten feature-by-feature websocket request builders for migrated flows.

Authoring note:

- Generic CRUD can remain as a temporary internal bridge for GM authoring while
  typed action/formula authoring contracts are being defined.
- Public action/formula authoring should not depend on frontend-invented path or
  variable catalogs.
- Backend should eventually provide the metadata the frontend needs to author
  formulas and action steps safely.

## Phase 9: Remove Frontend Fake Authority

High-risk cleanup targets:

- [ ] Remove or isolate mock transport behavior that acts like authoritative game state.
- [ ] Remove local sheet equipment mutations as a source of truth.
- [ ] Remove local sheet stat overrides as a source of truth.
- [ ] Remove local runtime values that masquerade as persisted domain state.
- [ ] Keep only UI-local draft state that is explicitly non-authoritative.

Done when:

- Frontend local state cannot silently diverge into its own gameplay authority layer.

## Phase 10: Verification and Hardening

- [ ] Backend websocket contract tests cover auth, snapshot, patch, error, and resync.
- [ ] Backend role-based access tests cover DM-only mutations.
- [ ] Frontend tests cover wrapper parsing, reconnect, and resync behavior.
- [ ] Frontend tests cover optimistic UX being overwritten by authoritative server updates.
- [ ] Update task docs as each migration slice lands.

Done when:

- The transport contract is tested, not just implied.
- Reconnect and state reconciliation behavior is predictable.

## Suggested Session Order

- [x] Session 1: Phase 1 protocol contract
- [x] Session 2: Phase 2 generated TS types
- [x] Session 3: Phase 3 websocket wrapper
- [x] Session 4: Phase 4 state split
- [x] Session 5: Phase 5 auth migration
- [x] Session 6: Phase 6 backend-native patch adoption
- [ ] Session 7: Phase 7 augmentations
- [ ] Session 8+: Phase 8 intent families
- [ ] Final cleanup: Phase 9 and Phase 10

## Immediate Next Step

- [ ] Start Phase 7 by introducing the general augmentation model before deeper item/action feature migration.

## Decision

Yes, add a websocket wrapper.

Yes, use generated TypeScript shapes.

But generate from an explicit websocket protocol contract, not directly from arbitrary backend internal models.
