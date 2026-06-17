# TTRPG System Plan

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.

This is the consolidated working plan for the project. It combines the active planning and task material from:

- `plan/archived/backend_takeover.md`
- `plan/archived/backend_tasks.md`
- `plan/archived/frontend_tasks.md`
- `plan/archived/backend_plan.md`
- `plan/archived/tmp_system_goals_questions.md`
- `plan/archived/backend_completed.md`
- `plan/archived/frontend_completed.md`
- `plan/archived/Completed.md`

Do not delete the source documents just because this file exists. Keep AGENTS, README files, policy docs, and rules/reference documents as source material. The highest rules authority remains `reference-docs/Chip TTRPG System_2-20-26.pdf`; `temp/Chip TTRPG System.md` is useful extracted reference text and should also be preserved.

## 1. Product Goal

Build a backend-authoritative sheet, variable, formula, and action executor for the Chip TTRPG system, with Roll20 remaining the table surface and play log for MVP.

The MVP is a character builder and sheet instancer where:

- GM authors characters, items, conditions, formulas, and actions/macros.
- Players use assigned actions from instanced sheets.
- The app tracks current state such as HP, mana, conditions, overrides, and proficiency changes.
- Roll20 receives chat output through the Firefox extension.
- The app does not take over maps, tokens, initiative, full combat automation, or a second authoritative roll history.

## 2. Non-Goals For MVP

- No full VTT replacement.
- No Roll20 token targeting or selected-token reads.
- No turn counting or automatic round lifecycle.
- No intersheet action execution or intersheet combat automation; cross-sheet combat remains Roll20/manual.
- No backend-owned player-facing roll log; Roll20 chat is the play log.
- No syncing back into Roll20 character sheets.
- No mobile-specific MVP requirement.
- No custom dice-only roller in this app; one-off rolls can happen in Roll20.
- No super advantage or super disadvantage.
- No clickable Roll20 command buttons.

## 3. Architecture Rules

- Backend owns auth/session truth, canonical game state, validation, calculations, mutations, snapshots, and patches.
- Backend is split by feature behind a thin websocket transport layer; feature transport models should live with their feature code.
- Domain models should live under `backend/state/models`, not under admin feature modules.
- Frontend renders authoritative state, submits intents, keeps UI state local, and reconciles to backend output.
- Frontend may own routing/page selection, form drafts, search/filter inputs, pending banners, request lifecycle UX, and display preferences.
- Gameplay math and persisted outcomes must not be finalized in frontend code.
- Only backend snapshot and patch events mutate authoritative frontend server state.
- Active sheet selection is frontend-local; requests should include explicit sheet/instance IDs.
- Raw path mutation helpers are internal backend primitives, not public client APIs.
- Backend transport schemas are the stable API contract; anything crossing the websocket boundary should use explicit transport schemas.
- Public app operations should be typed websocket routes registered through the backend request registry.
- Registry routes declare request model, emitted event models, role requirements, and client-generation metadata.
- Shared event/output models should be reused when routes emit the same shape; semantically different outputs need distinct named event models and `type` discriminants.
- Frontend transport types and future request helpers should be generated from backend route contracts.
- Mock transport may remain for UI work only if it matches the real protocol instead of inventing a separate app contract.

## 4. Current Implemented Baseline

Backend:

- FastAPI websocket transport exists for app clients on `/ws` and Roll20 bridge clients on `/ws/chat`.
- First application message authenticates app sessions as `player` or `dm`; Roll20 bridge authenticates as `service`.
- Canonical websocket request and server-event vocabulary is locked around `state_snapshot`, `state_patch`, `authenticate_response`, `error`, and registered route responses.
- Request registry is the public app websocket contract surface.
- App role hierarchy exists: `unauthenticated`, `player`, `dm`.
- DM and Admin mean the same role in this app.
- `authenticate` is registry-backed.
- Backend protocol code generation emits frontend TypeScript request/event types and a route-contract manifest from backend schemas/registry metadata.
- State sync serializes mutations through a backend-owned lock, sends full snapshots, ordered patches, state versions, replay when possible, and full snapshot fallback.
- State sync keeps bounded patch history and exposes reusable internal mutation primitives: `add`, `set`, `remove`, `increment`, and `decrement`.
- State mutations route through `state_sync` and persist into `state_dumpy.json`.
- Current persisted state roots include `sheets`, `instanced_sheets`, `formulas`, `actions`, `items`, and `proficiencies`.
- Sheet, action, formula, and item admin CRUD flows are registered as public typed websocket routes.
- Internal sheet-admin mutations route through state sync, broadcast patches, use patch-only success responses, and use `error` responses for failures.
- Runtime `perform_action` exists for authored action steps.
- Current action step kinds include `send_message`, `set_value`, `increment_value`, `decrement_value`, `resolve_damage`, `gain_proficiency_use`, `apply_augmentation`, and `apply_condition_preset`.
- Formula expansion is relative to one root object, supports dataclass/dict traversal, and guards against cycles.
- Roll20 chat bridge is fail-fast, does not queue disconnected messages, and consumes bridge `hello` / `chat_delivery` events for logging.

Frontend:

- React/Vite frontend is scaffolded.
- Websocket wrapper handles raw JSON parsing, event normalization, connection status, snapshots, patches, and invalid payload handling.
- Websocket wrapper tracks last seen state versions and can request resync when it detects a state version gap; reconnect/backoff behavior still needs hardening.
- Server-state and UI-state ownership are split.
- Auth/session state is server-derived.
- Backend-native patch applier is the canonical frontend state sync path.
- Player and GM sheet views share UI paths with role-based visibility.
- Template library/create/edit scaffolding exists for name, notes, tags, and core stats, but live backend persistence still depends on unmigrated legacy intents.
- Encounter preset builder scaffolding exists with multi-entry rosters, but it is legacy-intent/mock-heavy.
- Local intent lifecycle feedback banners exist for pending/success/error states.
- Player notes UI, manual level-up/stat override, and resource adjustment UX exist as local scaffolding; equipment inventory and active weapon display now read backend sheet item bridges.
- Shared sheet selectors, resource/stat editor hooks, and feature reducer modules exist to keep the main sheet component smaller.
- Stat metadata is centralized under frontend domain stats and reused by sheet and roll composer UI.
- Frontend styles are split into feature-scoped files with shared tokens/utilities.
- Roll composer scaffolding exists, including advantage/disadvantage controls and quick-roll prefill.
- Generated protocol types/contracts exist, but generated request helpers do not yet exist.
- Live websocket requests use generated protocol for auth/resync and sheet item bridge equipment mutations; sheet create/update/instantiate, encounter save/spawn, and roll submission still use legacy handwritten `ClientIntent` messages that only the mock transport handles.
- The client falls back from websocket to authoritative mock transport when websocket connection fails, which can mask missing backend route coverage during development.
- Frontend-local state still owns note edit drafts, stat overrides, and resource adjustment drafts; sheet equipment and active weapon selection are no longer local sources of truth.
- Item maker currently edits local UI item templates, not backend `ItemDefinition` records.
- Formula/action authoring UI and assigned-action execution UI are not implemented yet.
- Roll composer quick actions are preview/prefill scaffolding; they do not yet select or submit default editable action presets through the normal backend-authored action flow.
- Player entry still lists/selects player instances and can locally request player creation; it is not yet the planned generated sheet access-code flow.
- The existing Roll Log panel is intentionally an empty Roll20 handoff surface; it must not grow into an authoritative in-app player-facing roll history for MVP.
- Encounter preset UI exists but still uses legacy handwritten intents and should be migrated only if encounter convenience remains in scope; otherwise gate it as later/mock-only.
- Health adjustment damage-type UI currently uses stale placeholder categories and needs to align with the canonical damage type list once backend health adjustment schema is finalized.
- Frontend build and tests pass, but lint currently fails on existing unused symbols, explicit `any` in websocket tests, and fast-refresh warnings with `--max-warnings 0`.

## 5. MVP Data Model Direction

### Sheets

- Use one sheet model for players and enemies, distinguished by metadata/access.
- Support template and instance modes.
- Player characters have a base/template sheet and session instances.
- Enemies should be spawned from reusable templates.
- Current HP, current mana, conditions, and temporary overrides live on instances.
- Base stats, proficiencies, equipment, formulas, and permanent values live on base/template state or computed state.
- A sheet should be handled by the DM and one assigned player, not multiple players for MVP.
- GM can roll/use actions from any sheet.
- Sheet generation/assignment should create an access code that can be used to access/control that sheet once the player claim flow exists.
- DM views should be able to see and manage all generated sheet access codes through DM-only routes; access codes must not be part of public snapshots or broadcasts.
- Backend template notes edits are DM-only for MVP; instance notes edits are backend-backed for authenticated players/DMs and narrow to assigned players after ownership enforcement exists.
- Equipment, base stats, substats, max HP, max mana, action authoring, and template note edits are DM-only.
- Current instance resources such as HP and mana may be edited by the assigned player or DM once the direct resource edit intent exists.
- Players may execute assigned actions against their current sheet instance; DMs may execute/admin-test actions from any sheet or instance.
- Player ownership/access-code enforcement is a later slice because assignment state does not exist yet.

### Variables

Canonical variable roots:

- `state`: global/core state outside the caster.
- `sheet`: permanent/base sheet values.
- `instance`: temporary/current instance values.

Variable paths should be stable but authoring UX should guide GMs through dropdown navigation. Common variable paths should also become first-class shortcuts.

Supported variable types:

- number
- percent
- boolean
- text
- enum
- current/max resource
- formula result

Variables should support GM-only visibility, player-editable flags, descriptions/notes, min/max constraints, and units such as feet, percent, HP, mana, and actions.

### Derived Values

Base values and explicit overrides should be persisted. Derived values should be computed by the backend from authoritative formulas, then may be cached/persisted in snapshots for display and sync. Cached derived values are not directly editable and must be recalculated when dependencies change. GM overrides are stored separately and marked as overrides.

Known derived/rule values:

- Mana max: `Arcane * Mana`
- Mana regeneration: 10 percent per hour
- Armor class: `Dexterity * 0.5`
- Action points: Reaction Time threshold table
- Movement: Dexterity threshold table
- Resistance totals: additive by damage type, capped at 100 percent
- Carry weight: Strength-derived, but exact formula is not settled
- HP max: GM-authored/configurable for now; doc examples use `stat * 50` style values but exact governing stat/race behavior is not settled

## 6. Formula And Action Model

Formulas:

- GM-authored only.
- Reference variables by stable and relative paths.
- Can be reusable named records and inline action fields.
- Produce values only; they do not mutate state directly.
- Conditionals are not MVP formula syntax.
- Direct references to equipped item values are not MVP; formulas can reference derived stats/effects caused by items if needed.
- Missing variable references must reject evaluation with an explicit error.
- Formula output should be explainable in GM/debug output.
- Versioning should be added before serious data entry; MVP can use stable IDs and cautious editing.

Formula operations for now:

- arithmetic
- dice expressions
- variable references
- `min(value, max_hp)`
- `max(0, damage)`
- `floor()`
- `ceil()`
- `round()`

Roll20 can handle `floor()`, `ceil()`, and `round()` in chat formulas. Roll20 may express min/max-style dice cases with keep-high/keep-low syntax such as `kh1`/`kl1`. Backend helper-function evaluation for `min/max/floor/ceil/round` is not required for MVP unless an authoritative state mutation later needs backend-side clamping.

Actions:

- Actions, abilities, and macros refer to the same MVP concept unless a later design explicitly separates them.
- GM-authored only.
- Players can execute assigned actions.
- Actions attach to sheets through explicit bridges.
- Actions are ordered step pipelines.
- Actions execute against an explicit owning/current sheet instance; cross-sheet targets are not an app workflow.
- Runtime parameters are allowed for predefined GM-configured options, currently just advantage/disadvantage.
- Selected mode and overload alternatives are later work.
- Current-value changes such as resource costs, resource restores, and healing should be authored through generic bounded mutation steps or reusable action presets, not one hardcoded action step type per resource/stat.
- Damage is not a raw current-value decrement preset; it should use a semantic damage action step that evaluates an authored damage formula, validates damage type, applies target resistance, and then mutates current health.
- Damage/resistance work should land in order: shared formula evaluator, resistance state/metadata, then the semantic damage action step.
- Full attack-specific damage composition, armor derivation, critical rules, and combat modifiers remain later resolver work.
- Proficiency gain and status/augmentation application may remain semantic action steps where they mutate relationship state or lifecycle state rather than a simple numeric path.
- Roll/check variants should be modeled as action steps or sheet presets, not as separate roll-type records.
- Freeform situational modifiers are not MVP; common modifiers should become GM-authored actions/conditions, and one-off adjustments can be manual in Roll20.
- Cooldowns and once-per-turn limits are not MVP because turn tracking is out of scope.

MVP action step types:

- send Roll20 message
- set variable
- increment/decrement variable with optional backend-enforced bounds
- roll dice or emit Roll20 dice expression
- compare against DC when needed
- reusable presets for healing, resource spend, and resource restore composed from generic bounded mutation steps
- semantic damage resolution step that reuses action formula evaluation for amount, then applies damage type and resistance rules before mutating health
- gain proficiency
- apply augmentation/status

Quick actions:

- Attack, dodge, block, and parry should come from sheet presets but be treated like ordinary actions so a specific sheet can edit, replace, remove, or variant them.
- Frontend quick-roll controls should prefill an action/composer flow, not immediately submit without review.

## 7. Roll20 Boundary

- Roll20 integration is output-only chat delivery through the Firefox extension.
- Roll20 never mutates backend state.
- Browser-extension bridge is the long-term Roll20 path for now.
- If the bridge is disconnected, requests fail immediately and the frontend should show a clear failure/toast.
- Do not queue disconnected Roll20 messages.
- Plain text and Roll20 `/r` output are preferred over tightly coupled templates.
- Lightweight prefix wrapping can support advantage/disadvantage and visibility/GM-only output.
- Hidden GM roll support can be handled through that prefixing if needed.

Roll20 output should include enough context to be auditable:

- sheet/character name
- action name
- variables/formula or Roll20 dice expression
- resolved result when backend resolves it
- optional DC/success/mutation details per action

Roll20 output should be compact by default while still showing enough formula detail for GM/player trust. Any non-Roll20 roll/debug metadata should be debug/audit-oriented, not a player-facing app roll history. Formula/action errors should be detailed for GM/debug views and concise for players.

## 8. Rules Captured For MVP

Skill check:

- `(d100 / 100) * Governing Stat`
- `d100` is an integer roll from 1 to 100.
- Advantage: roll two of the same check and take the higher.
- Disadvantage: roll two of the same check and take the lower.

Proficiency:

- First-class model separate from stats.
- Categories: weapon type, specific weapon, skill, spell.
- Range: 0 to 100 percent.
- 100 percent is mastery.
- Increments happen on approved use and are configurable per weapon/spell/skill.
- Downtime training exists in the rules but can stay manual/Roll20 for MVP.
- Mastery can unlock actions/items/spells later; backend enforcement can wait unless easy to model.
- Players cannot manually edit proficiency; GM can manually correct/edit.
- MVP proficiency admin uses sheet proficiency bridge CRUD for GM correction; global proficiency definition CRUD is deferred until the registry shape is needed.

Equipment and items:

- Equipped/active weapon selection exists for attack rolls.
- Equipment is an inventory-list model, not a slot-based layout for MVP; records can still mark active/equipped gear where rules need it.
- Weapons define damage, governing stat, reach, damage type, and proficiency reference.
- Armor adds resistance and does not increase AC; heavy armor AC disadvantage remains unresolved and manual/deferred.
- Shields give advantage on block actions and otherwise do not affect resistance or AC unless specified.
- Consumables are items and using one in battle costs an action point.
- Item records should support World Anvil links.
- Item records should support GM-only notes/special properties for campaign-specific effects that are not player-visible.

Damage and resistance:

- Physical damage types: Piercing, Slashing, Bludgeoning.
- Magical damage types: Arcane, Fire, Water, Earth, Wind, Light, Dark, Lightning, Ice, Time, Gravity, Psychic.
- Resistance is additive and capped at 100 percent.
- Resistance should use a consistent internal numeric convention; prefer fractions where `0.25` means 25 percent.
- Effective resistance should combine total resistance, physical/magical category resistance, and specific damage-type resistance, then cap at 100 percent.
- Damage taken: `Damage Inflicted - (Damage Inflicted * Resistance)`.
- Stacking rules beyond additive resistance are unresolved and deferred.

Physical attacks:

- To hit: `Proficiency * (1d100 / 100) * Attack Stat`
- Damage: `Weapon Damage + Proficiency * (d100 / 100) * Governing Stat`
- Critical 1: GM-determined failure, usually no damage.
- Critical 100: double total damage.
- Critical behavior outside physical attacks is unresolved and deferred.

Magical attacks:

- To hit: `Proficiency * (d100 / 100) * Arcane`
- Damage: `Proficiency * (d100 / 100) * Base Spell Damage`
- Spell ranks: F, F+, E, E+, D, D+, C, C+, B, B+, A, A+, S, S+, SS, SS+.
- Overload is not MVP; exact DC formula is deferred.

Combat automation:

- Turn order, action point reset, reactions, contested reactions, opportunity attacks, flanking, grappling, AOE positioning, and cross-sheet damage application are Roll20/manual.
- The app should not automate cross-sheet combat workflows.
- `slayed_record` remains part of full sheet state for history/bookkeeping, but dedicated semantic slay-record routes are deferred until combat/history automation becomes MVP-relevant.

## 9. Augmentation Direction

Replace item-owned `stat_augmentations` as the long-term center of effect modeling with a general backend-owned augmentation system.

Augmentations should:

- be applied, reversible effects
- have stable IDs
- carry source metadata such as item, action, spell, condition, or other origin
- indicate base-sheet or instance scope
- target validated backend-owned paths or references
- carry formula/effect payloads that the backend can evaluate or apply authoritatively
- support item buffs, poison/status effects, gear/weapon effects, and future conditional effects
- keep application, removal, stacking, and recomputation backend-authoritative
- be directly applied/removed by GM, while players can only apply or adjust them through backend-approved actions for their allowed sheet/instance

MVP can leave duration/expiry manual because turn counting is out of scope, but duration, expiry, and removal conditions should be explicit augmentation semantics later rather than implied by source type. Conditional augmentation logic is not MVP. Ally/other-sheet effects are future-only and must not introduce intersheet action execution or cross-sheet automation.

## 10. Roadmap

### Phase 7: General Augmentations

- [ ] Replace item-owned `stat_augmentations` with a general augmentation model.
- [x] Model augmentations as applied, reversible effects.
- [x] Add stable identity and source metadata.
- [ ] Move augmentation targeting to validated backend paths/references.
- [x] Add backend-evaluable formula/effect payload shape.
- [x] Keep application, removal, stacking, and recomputation backend-authoritative.
- [x] Implement current-instance condition/status augmentation hooks.
- [x] Finalize augmentation attach/update intents for gear and weapon items.
- [x] Reserve explicit duration/expiry/removal-condition fields for later lifecycle support.
- [x] Add augmentation state to authoritative sync once shape is ready.
- [ ] Prepare conditional augmentation support without exposing raw mutation.
- [ ] Add frontend augmentation builder scaffold.
- [ ] Add UI flow to attach augmentations to gear and weapons.

### Phase 8: Intent And Runtime Migration

- [ ] Migrate roll/action submission onto typed backend route/helper paths with backend-authoritative reconciliation only.
- [ ] Replace handwritten frontend websocket builders with generated or centralized typed route helpers.
- [ ] Add generated frontend request helpers for registered backend route contracts.
- [x] Add typed sheet create/update/delete route contracts.
- [x] Add typed action/formula create/update/delete route contracts.
- [x] Add typed item create/update/delete route contracts.
- [x] Add typed sheet action bridge create/update/delete route contracts.
- [x] Add typed sheet item bridge create/update/delete route contracts.
- [x] Add typed sheet proficiency bridge create/update/delete route contracts.
- [x] Audit remaining sheet-admin variable/bridge route contracts and defer non-MVP slay-record routes.
- [x] Add typed condition/status record routes or define conditions as augmentation presets before exposing condition authoring.
- [x] Add typed sheet instancing/spawn route contract.
- [x] Complete backend typed intent families for sheet create/update, sheet instancing/spawn, item management, and action/formula state adoption.
- [x] Implement `sheet_admin/stats`.
- [x] Decide whether proficiencies need dedicated admin CRUD or are managed only through actions plus GM correction.
- [ ] Add global proficiency definition CRUD if/when the proficiency registry needs first-class authoring.
- [x] Add variable registry/path metadata for formula authoring.
- [x] Add action/formula authoring metadata for sheet/instance scopes, aliases, and valid path catalogs from backend contracts.
- [x] Add common variable shortcuts.
- [x] Define baseline sheet checks as default action bridges instead of a dedicated `roll_basic_check` runtime intent.
- [x] Define `attack`, `dodge`, `parry`, and `block` as default editable action presets executed through the normal `perform_action` runtime.
- [x] Add stronger cross-entity validation for sheet/action/item/formula references.
- [x] Add runtime validation for allowed sheet/instance focus and reject `target_sheet_id` intersheet execution.
- [ ] Add runtime validation for player ownership/access-code claim enforcement once assignment state exists.
- [x] Expand runtime steps beyond `send_message` and `set_value`.
- [x] Implement bounded generic mutation options for increment/decrement/set steps, plus gain proficiency.
- [x] Implement augmentation/status action steps.
- [x] Model healing, resource spend, and resource restore as authored generic bounded mutation step patterns.
- [x] Add named reusable action preset templates for healing, resource spend, and resource restore if the authoring UI needs presets beyond raw step composition.
- [x] Centralize backend formula evaluation so action steps, augmentation formulas, and damage resolution use one shared evaluator.
- [x] Add resistance state/metadata for total, physical, magical, and per-damage-type resistance using the shared percent convention.
- [x] Add a semantic damage action step that evaluates an authored damage formula, validates canonical damage type, applies target resistance capped at 100 percent, and mutates current health.
- [ ] Extend damage resolution later for armor derivation, critical rules, weapon/spell-specific damage composition, and other combat modifiers.
- [x] Implement action execution against explicit sheet/instance IDs.
- [ ] Implement backend roll resolution through generic authored action steps for default `attack`, `dodge`, `parry`, and `block` presets once those actions become backend-resolved.
- [ ] Implement weapon/equipment-driven attack modifiers on the backend when attack support is added.
- [ ] Implement advantage/disadvantage as predefined runtime action parameters.
- [ ] Add Roll20 chat prefix wrapping for advantage/disadvantage and visibility/GM-only output.
- [x] Add validation/error responses for invalid action execution payloads and unauthorized actions.
- [x] Finalize websocket request/response types for action execution requests.
- [x] Finalize websocket request/response types for typed template edits, sheet updates, and bridge operations.
- [x] Audit sheet schema and permissions for instance notes, optional GM template notes, inventory-list equipment, and stat/resource adjustments.
- [x] Add backend sheet note schema and DM-only note edit route for optional GM template notes.
- [x] Add backend instance notes for authenticated player/DM editing; ownership enforcement narrows this after access-code claim state exists.
- [x] Replace frontend-local equipment inventory mutations with backend sheet item bridge create/update/delete requests and authoritative patch reconciliation.
- [ ] Add backend direct current instance resource edit routes for health and mana using `resource_edit` permissions, with backend validation and patch-only success.
- [ ] Replace frontend-local stat override behavior with backend-authoritative stat requests or explicitly gate remaining override UI as mock-only.
- [ ] Ensure backend role/permission model supports shared GM/player sheet rendering with restricted player-visible controls.
- [x] Generate and persist sheet access codes for player sheet assignment/access, with DM visibility over all codes.
- [ ] Implement player sheet access-code claim/assignment flow and enforce ownership once assignment state exists.
- [ ] Model relationship/bridge operations as semantic commands such as `attach`, `detach`, `link`, `unlink`, and `instantiate`.
- [ ] Add Roll20 bridge status/send-failure UX.
- [x] Add optional World Anvil link field to item schema and backend protocol/update payloads.
- [x] Add GM-only item notes/special properties to item schema, sync payloads, and role-based redaction.
- [ ] Wire frontend resource adjustment controls to backend resource routes once those route contracts exist.
- [ ] Replace mock transport placeholder roll outputs with backend-authoritative roll/chat handling.
- [ ] Make websocket-to-mock fallback explicit dev-only behavior or remove fallback from normal live mode.
- [ ] Decide whether existing encounter preset save/spawn UI is MVP; migrate it to typed backend routes or clearly gate it as later/mock-only.
- [ ] For each migrated intent family, add backend contract tests and frontend reconciliation tests.
- [ ] Add global sync conflict/recovery UX for snapshot resync and rejected intents.

### Phase 9: Remove Remaining Frontend Fake Authority

- [ ] Remove or isolate mock transport behavior that acts authoritative.
- [x] Remove local sheet equipment mutations as source of truth.
- [ ] Remove local sheet stat/resource overrides as source of truth.
- [ ] Remove local runtime values that masquerade as persisted domain state.
- [ ] Ensure optimistic UI is always pending and overwritten by authoritative patches.
- [ ] Keep only drafts, filters, tabs, active selection, and pending UX local.

### Phase 10: Verification And Hardening

- [ ] Add websocket reliability behavior for reconnect/backoff and explicit snapshot resync recovery.
- [ ] Add idempotency/ordering handling for intent replay or duplicate messages after MVP, unless DM manual correction remains sufficient.
- [ ] Decide whether to keep the HTTP chat debug endpoint long-term.
- [ ] Move auth codes into explicit environment/config management before deployment needs tighten.
- [ ] Continue trimming redundant websocket success payloads where authoritative patches already prove success.
- [ ] Backend websocket contract tests cover auth, snapshot, patch, error, resync, permission failures, action execution, variable mutation, and Roll20 bridge failure.
- [ ] Backend role-based access tests cover DM-only and future typed admin mutations.
- [ ] Backend tests cover generated-helper metadata and typed route/export consistency once generation expands beyond types.
- [ ] Frontend tests cover wrapper parsing, reconnect/resync, state patch reconciliation, optimistic overwrite, reducer behavior, mock transport event handling, and core sheet interactions.
- [ ] Add accessibility pass for focus states, labels, and keyboard navigation, especially sheet/resource editors.
- [ ] Add integration tests for rapid intent sequences and snapshot/patch consistency.
- [ ] Finalize schema for damage-type input on health adjustments.
- [ ] Implement damage-type-aware health adjustment handling.
- [ ] Add schema versions and migration support before serious data entry.
- [ ] Add source request/action metadata to mutations for audit/debugging.
- [ ] Add DM-only undo later; MVP uses manual DM correction for duplicate/incorrect mutations.

## 11. MVP Acceptance Criteria

MVP is done when:

- GM can create/edit a sheet from scratch.
- GM can create/edit formulas and actions with ordered steps.
- GM can attach actions to a sheet.
- GM can instantiate a player/enemy sheet.
- Player can view a simplified assigned sheet instance.
- Player can execute assigned actions.
- Action execution can mutate current instance resources/state through backend-authoritative patches.
- Action execution can emit Roll20 chat through the bridge.
- Bridge disconnected state fails immediately with visible client feedback.
- Player attempting GM-only edits receives a permission rejection.
- Editing a stat/resource produces authoritative patches visible to connected clients.
- State persists across restart through `state_dumpy.json`.
- Required backend and frontend contract/reconciliation tests pass.

## 12. Active Task List

### Backend Now

- [x] Introduce general augmentation model.
- [x] Define backend-evaluable augmentation formula/effect payload shape.
- [x] Reserve duration/expiry/removal-condition fields for later augmentation lifecycle support.
- [x] Implement augmentation application/removal/recomputation.
- [x] Add augmentation sync shape.
- [x] Implement stats/variable authoring route surface.
- [x] Add variable registry and valid path metadata.
- [x] Define condition/status backend shape as records or augmentation presets.
- [x] Implement current-instance condition/status augmentation hooks.
- [x] Finalize augmentation attach/update intents for gear and weapon items.
- [x] Expand action step execution.
- [x] Implement proficiency gain as a backend-authoritative step.
- [x] Replace hardcoded resource/healing action steps with bounded generic mutation options.
- [x] Define role/permission rules for notes, equipment, stat edits, resource edits, and action execution.
- [x] Add generated sheet access codes and DM code visibility to sheet creation/assignment flows.
- [x] Add typed sheet create/update/delete route contracts.
- [x] Add typed action/formula create/update/delete route contracts.
- [x] Add typed item create/update/delete route contracts.
- [x] Add typed sheet action bridge create/update/delete route contracts.
- [x] Add typed sheet item bridge create/update/delete route contracts.
- [x] Add typed sheet proficiency bridge create/update/delete route contracts.
- [x] Add typed route contracts for remaining sheet admin features and semantic bridge operations.
- [x] Add World Anvil item link field.
- [x] Add GM-only item notes/special properties.

### Frontend Now

- [ ] Separate GM creation flows for sheets, items, formulas, and actions.
- [ ] Add formula authoring UI.
- [ ] Add action authoring UI with ordered step editing.
- [ ] Add condition/status authoring UI once the backend shape is settled.
- [ ] Add variable/path browser and shortcut picker UI for formula/action authoring.
- [ ] Add assigned-action execution UI wired to `perform_action`.
- [ ] Provide dedicated sheet viewer mode.
- [ ] Replace player self-create/list-all flow with generated sheet access-code entry/assignment flow.
- [ ] Wire sheet create/edit/spawn flows to backend typed route contracts once available.
- [ ] Wire item maker to backend item records instead of local UI templates.
- [ ] Wire action/formula authoring flows to backend typed route contracts.
- [ ] Add augmentation builder scaffold.
- [ ] Add UI for gear/weapon augmentation attachment.
- [ ] Define frontend augmentation UX boundaries for what is editable versus display-only on weapon/gear augments.
- [ ] Add stat/resource update intent UI wired to backend-authoritative requests.
- [ ] Use roll composer quick controls to prefill or select default editable actions, then submit through the normal backend-authored action/Roll20 flow.
- [ ] Align health/resource adjustment controls with canonical damage types and backend health adjustment schema.
- [ ] Keep the Roll Log panel as Roll20 handoff/status only, or remove it; do not store a player-facing authoritative roll history.
- [ ] Add bridge status and send-failure UX.
- [ ] Add sync conflict/recovery UX for resyncs and rejected intents.
- [ ] Add World Anvil item link entry/display.
- [ ] Add GM-only item notes/special properties entry/display.
- [ ] Fix frontend lint errors and warnings so `npm run lint` passes with `--max-warnings 0`.
- [ ] Add tests for reducer, transport event handling, and core sheet interactions.

### Later

- [ ] GM console overlay mode for fast page switching and encounter spawn actions.
- [ ] Encounter/preset save and spawn convenience flows, without combat automation.
- [ ] Combat/turn tracking.
- [ ] Overload selected mode/alternative handling.
- [ ] Downtime training automation.
- [ ] Mastery unlock enforcement.
- [ ] Level-up policy automation; manual value edits remain enough until rules are settled.
- [ ] Export/import JSON.
- [ ] Multi-campaign support.
- [ ] Mobile layout refinement for player character sheet and GM encounter/template panels.
- [ ] DM-only undo.

## 13. Deferred Rule Decisions

These are not MVP blockers:

- Exact HP max formula and race modifier behavior. Use GM-authored/configurable formula for now.
- Exact Strength-to-carry-weight formula.
- Critical behavior outside physical weapon attacks.
- Heavy armor disadvantage on fixed AC.
- Exact overload DC formula.
- Stacking rules beyond additive resistance capped at 100 percent.
- Level-up policy boundaries beyond manual edits and GM discretion.
- Exact frontend roll composer preview terms for formulas that remain Roll20-resolved.
- Stat/resource adjustment semantics where the answer is not a direct current HP/mana edit: additive, replace-value, or formula-driven.

## 14. Completion History Summary

Completed project/workflow work includes:

- contributor/policy documentation baseline.
- split task tracking into frontend/backend task files before consolidation.
- consolidated active planning into this `plan/active/PLAN.md`; archived source docs remain preserved.

Completed frontend work includes:

- React/Vite scaffolding.
- typed app state, transport abstractions, and mock/ws adapters.
- GM/player console scaffolding.
- session landing, GM/password entry gate, and player entry flow.
- template create/edit library scaffolding.
- encounter preset builder scaffolding.
- shared sheet UI path.
- player notes notepad, original equipment inventory scaffold, active weapon controls, and manual level-up override scaffold; equipment/active weapon state has since been migrated to backend sheet item bridges.
- roll composer scaffold and quick-roll prefill.
- advantage/disadvantage controls and explicit TODO roll-equation previews.
- local intent lifecycle feedback banners.
- server-state/UI-state split.
- reducer, selector, hook, component, and style decomposition.
- websocket wrapper and backend-native patch applier.
- wrapper/sync tests for snapshot, patch, invalid payload handling, incremental patch, and forced resync.
- frontend lint/format scaffolding.

Completed backend work includes:

- canonical websocket protocol envelope/events.
- backend-generated TypeScript protocol types.
- generated route-contract manifest for future frontend helper generation.
- registry-backed route metadata and app-role hierarchy.
- registry-backed authentication.
- backend role/auth bootstrap tests.
- state snapshot/patch/resync/error contract tests.
- removal of the old public generic sheet-admin websocket CRUD surface.

The legacy `plan/archived/Completed.md` is archived; new completion updates should be recorded in this active plan unless the project adopts a separate completion log again.
