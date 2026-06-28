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

Do not delete the source documents just because this file exists. Keep AGENTS, README files, policy docs, and rules/reference documents as source material. The highest rules authority for the active rules text is `reference-docs/Chip_TTRPG_System.md`; answered implementation rulings live in `reference-docs/rule-decisions-needed-answered.md`. Archived PDFs remain preserved for history.

## 1. Product Goal

Build a backend-authoritative sheet, variable, formula, and action executor for the Chip TTRPG system, with Roll20 remaining the table surface and play log for MVP.

The MVP is a character builder and sheet instancer where:

- GM authors characters, items, conditions, formulas, and actions/macros.
- GM saves planned encounter presets as lightweight collections of sheet templates plus counts, then spawns them into backend-owned sheet instances.
- Players use assigned actions from instanced sheets.
- The app tracks current state such as HP, mana, conditions, overrides, and proficiency changes.
- Roll20 receives chat output through the Firefox extension.
- The app does not take over maps, tokens, initiative, full combat automation, or a second authoritative roll history.

## 2. Non-Goals For MVP

- No full VTT replacement.
- No Roll20 token targeting or selected-token reads.
- No turn counting or automatic round lifecycle.
- No intersheet action execution or intersheet combat automation; cross-sheet combat remains Roll20/manual.
- No backend-owned player-facing roll log; Roll20 chat is the table play log.
- Backend-owned action history may exist as a redacted audit/status stream, but it must not duplicate authoritative side-effect state or expose hidden formulas/stats to players.
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
- Do not retain a frontend mock transport that owns mutable game state or acts as a parallel backend. Transport tests may use injected inert fakes, but application runtime state must come from backend snapshots and patches.

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
- XP tracker routes reuse sheet XP thresholds, enemy XP values, and slay records; backend-derived tracker responses expose full X/Y progress only to DMs.
- Formula expansion is relative to one root object, supports dataclass/dict traversal, guards against cycles, and backend numeric evaluation supports arithmetic, dice expressions, `min`, `max`, `floor`, `ceil`, and `round` for authoritative action/stat calculations.
- Semantic damage action steps evaluate authored formulas, apply typed resistance, and mutate instance health through state sync.
- Roll20 chat bridge is fail-fast, does not queue disconnected messages, and consumes bridge `hello` / `chat_delivery` events for logging.

Frontend:

- React/Vite frontend is scaffolded.
- Websocket wrapper handles raw JSON parsing, event normalization, connection status, snapshots, patches, and invalid payload handling.
- Websocket wrapper tracks last seen state versions, can request resync when it detects a state version gap, and reconnects with bounded backoff after dropped websocket connections.
- Server-state and UI-state ownership are split.
- Auth/session state is server-derived.
- Backend-native patch applier is the canonical frontend state sync path.
- Player and GM sheet views share UI paths with role-based visibility.
- Template library/create/edit/spawn UI exists for name, notes, kind, core stats, and template spawning; these sheet flows now use typed backend routes.
- Encounter preset builder scaffolding exists with multi-entry rosters and uses typed backend routes for save/spawn.
- Local intent lifecycle feedback banners exist for pending/success/error states.
- Player notes use a local edit draft backed by an authoritative save route; equipment inventory, active weapon display, current-resource adjustment, and GM core base stat edits use backend-authoritative routes/state.
- Shared sheet selectors, resource/stat editor hooks, and feature reducer modules exist to keep the main sheet component smaller.
- Stat metadata is centralized under frontend domain stats and reused by sheet and roll composer UI.
- Frontend styles are split into feature-scoped files with shared tokens/utilities.
- Roll composer scaffolding exists, including advantage/disadvantage controls and quick-roll controls that select assigned default authored actions when available.
- Generated protocol types/contracts exist. Centralized request helpers cover the already-live frontend route set; fully generated request helpers for all registered backend routes remain future work.
- Live websocket requests use generated protocol for auth/resync and centralized typed helpers for sheet creation/update/instancing, sheet access claims, sheet item bridge equipment mutations, current-resource adjustment, GM core base stat edits, item maker CRUD, item augmentation template CRUD, action/formula authoring, quick authored action execution, and encounter preset save/spawn.
- Normal live mode no longer falls back from websocket to mock transport on connection failure; mock transport is explicit dev-only selection.
- Frontend-local state owns note edit drafts and other transient UI controls; sheet equipment, active weapon selection, current-resource values, displayed sheet stats, and level-up changes are not local sources of truth.
- Item maker create/edit/delete sends backend `ItemDefinition` CRUD requests, reconciles through authoritative item state, and exposes World Anvil URL plus GM-only notes/special-properties inputs.
- Formula/action authoring UI and broad assigned-action execution UI exist; roll composer quick actions select assigned default editable action presets and submit them through `perform_action`.
- Player entry now claims a generated sheet access code and uses the backend-validated claimed instance as the active sheet.
- The former Roll Log panel renders the backend-owned redacted action-history/status stream; it is not a frontend-local roll history.
- Encounter preset UI uses typed backend route helpers for lightweight planned encounter collections.
- GM navigation includes an XP Tracker page for thresholds, mob XP values, and backend-calculated level readiness; character sheets include a Kills tab for tracked mob counts.
- GM navigation, active-sheet switching, connection/pending status, and encounter quick-spawn are consolidated into a persistent collapsible toolbar across every GM page.
- Direct health/resource adjustment is a current-value HP/mana edit without damage semantics; damage type belongs to semantic damage action steps.
- Frontend build, tests, and lint pass.

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
- Sheet generation/assignment creates an access code that can be claimed by a player session to access/control that sheet instance.
- DM views should be able to see and manage all generated sheet access codes through DM-only routes; access codes must not be part of public snapshots or broadcasts.
- Backend template notes edits are DM-only for MVP and are redacted from player snapshots/patches; instance notes edits are backend-backed for DMs and the assigned player session.
- Equipment, base stats, substats, max HP, max mana, action authoring, and template note edits are DM-only.
- Current instance resources such as HP and mana may be edited by the assigned player session or DM.
- Players may execute assigned actions against their current sheet instance; DMs may execute/admin-test actions from any sheet or instance.
- Player ownership/access-code enforcement is session-local for MVP; durable player identity/account binding remains later.

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
- Carry weight: `FLOOR(Strength)`
- HP max: `Health * Racial HP Multiplier`, with the multiplier authored on the race or creature template approved by the GM

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
- Advantage/disadvantage applies to hit/check rolls, not damage rolls. If both advantage and disadvantage apply, they cancel to a normal roll; multiples do not stack.
- Current-value changes such as resource costs, resource restores, and healing should be authored through generic bounded mutation steps or reusable action presets, not one hardcoded action step type per resource/stat.
- Damage is not a raw current-value decrement preset; it should use a semantic damage action step that evaluates an authored damage formula, validates damage type, applies target resistance, and then mutates current health.
- Healing is a separate semantic healing model or bounded HP mutation pattern, not negative damage; resistance does not affect healing unless a specific effect says so.
- Damage/resistance work should land in order: shared formula evaluator, resistance state/metadata, then the semantic damage action step.
- Full attack-specific damage composition, critical rules, and augmentation-derived combat modifiers remain later resolver work.
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
- Roll20 roll/action chat output is public by default.
- Lightweight prefix wrapping can support public advantage/disadvantage mode labels.

Roll20 output should include enough context to be auditable:

- sheet/character name
- action name
- variables/formula or Roll20 dice expression
- resolved result when backend resolves it
- optional DC/success/mutation details per action

Roll20 output should be compact by default while still showing enough formula detail for GM/player trust. Any non-Roll20 roll/debug metadata should be debug/audit-oriented, not a player-facing app roll history. Roll/action calculation failures emitted to Roll20 should use concise public error text.

## 7A. Action History Boundary

Action history should be a single backend-owned stream that serializes differently per viewer. Store one canonical action-history record, then redact at serialization time based on role/session.

Action history may record:

- event id, request id, action id/name, actor sheet/instance id, target id when targets become supported, actor role, timestamp, and state version
- status (`success` or `failed`) and concise error category/message
- emitted Roll20 messages
- backend-produced mutation summaries, such as damage/resource summaries, for GM/audit views
- backend-generated action summary text derived from authored steps/results

Action history must not record or imply a second source of truth for side effects:

- no persisted duplicate current HP/mana/stat/proficiency values beyond concise mutation summaries
- no replay semantics for MVP
- no frontend-local action history authority
- no player-visible hidden formulas, hidden stats, target internals, resistance math, GM-only item/action notes, or mutation summaries unless explicitly public

Default redaction:

- DM view can see full action summary, emitted messages, mutation summaries, formulas/macros, and failures.
- Player view can see only allowed action status for their permitted sheet/instance, public action name, public emitted Roll20 messages, and concise success/failure. Hidden mechanical details stay redacted.

## 8. Rules Captured For MVP

Skill check:

- `FLOOR((1 + Skill Proficiency) * (d100 / 100) * Governing Stat)`
- `d100` is an integer roll from 1 to 100.
- Runtime roll modes apply only to authored Roll20 messages containing a standalone `1d100` check expression: normal keeps `1d100`, advantage emits `2d100kh1`, and disadvantage emits `2d100kl1`.
- Advantage/disadvantage output is publicly prefixed with `[Advantage]` or `[Disadvantage]`; semantic damage steps are not transformed.
- Advantage: replace the `1d100` check die with `2d100kh1` and take the higher kept die.
- Disadvantage: replace the `1d100` check die with `2d100kl1` and take the lower kept die.
- Only the kept die determines natural 1 or natural 100.
- Advantage/disadvantage applies to hit/check rolls, not damage rolls. Opposing advantage and disadvantage cancel to normal; multiple sources do not stack.

Proficiency:

- First-class model separate from stats.
- Categories: weapon type, specific weapon, skill, spell.
- Display range: 0 to 100 percent; formula value: `0.00` to `1.00`.
- 100 percent is mastery.
- Increments happen on meaningful approved use even if the action fails.
- Per-use formula: `New Proficiency = MIN(1.00, Current Proficiency + Growth Rate)`.
- Growth rate is the configured per-use increase for that weapon, skill, or spell, such as `0.01` for 1 percent or `0.001` for 0.1 percent.
- Downtime training is manual DM adjudication for MVP; the DM may decide that a character practiced/activated something a number of times and award a specific proficiency/XP amount.
- Mastery can unlock higher-ranked spells, higher-ranked skills, powerful weapons, and authored modifiers such as lower mana cost, more damage, range, or secondary features.
- Unlock prerequisites can require one or multiple proficiency thresholds using explicit `all`/AND or `any`/OR grouping; do not infer grouping.
- Players cannot manually edit proficiency; GM can manually correct/edit.
- DM-authored global proficiency definitions are the registry of available proficiencies.
- Sheet proficiency bridges are per-sheet progress records that point at a global proficiency definition.
- Strict mode for MVP: sheets/actions must reference existing proficiency definitions and existing sheet bridges; missing links should return clear backend errors rather than silently creating progress.
- Action authoring should make proficiency gains feel self-feeding: an action can declare which proficiency/proficiencies it trains, and multiple actions can feed the same proficiency.

Equipment and items:

- Equipped/active weapon selection exists for attack rolls.
- Equipment is an inventory-list model, not a slot-based layout for MVP; records can still mark active/equipped gear where rules need it.
- Each attack action selects exactly one active weapon for the resolution; dual-wield or multi-weapon actions must be authored explicitly.
- Weapons require name, weapon type, base damage, governing stat, one or more physical damage types, reach, proficiency reference, and proficiency growth rate.
- Optional weapon fields include stat bonuses, attached skills, traits, special effects, prerequisites, tags, and notes.
- Weapon reach is stored/shown for Roll20/manual reference only and does not affect app-side mechanics, formulas, targeting, or positioning.
- Offhand, two-handed, thrown, ranged, and improvised weapon modes are represented as tags/reference metadata unless a future resolver requires first-class fields.
- Equipment mechanical effects should use generic augmentation templates wherever possible instead of bespoke per-equipment-type rules.
- Armor, shields, and other gear can provide resistance, penalties, advantage/disadvantage sources, or other modifiers through augmentations or authored actions unless a future core resolver requires a first-class field.
- Armor grants resistance rather than AC. Heavy armor must impose disadvantage on Dodge, ideally through a standard attached augmentation/template.
- Shields normally grant advantage on Block attempts, do not automatically increase AC or resistance, and may be required for some Block actions.
- Consumables are items and using one in battle costs an action point.
- Item records should support World Anvil links.
- Item records should support GM-only notes/special properties for campaign-specific effects that are not player-visible.

Damage and resistance:

- Physical damage types: Piercing, Slashing, Bludgeoning.
- Magical damage types: Fire, Water, Earth, Wind, Light, Dark, Lightning, Ice, Time, Gravity, Psychic; spells may define additional types.
- Resistance is additive and capped at 100 percent.
- Resistance should use a consistent internal numeric convention; prefer fractions where `0.25` means 25 percent.
- Effective resistance should combine total resistance, physical/magical category resistance, and specific damage-type resistance, then cap at 100 percent.
- Damage taken: `FLOOR(Damage Inflicted * (1 - Resistance))`.
- Damage may be reduced to 0; 100 percent resistance means immunity unless a special rule bypasses it.
- Resistance is clamped to `0.00..1.00`; vulnerability or bonus damage must be modeled as a separate explicit effect unless future rules define negative resistance.
- When an effect halves damage, halve the damage first, then apply resistance.

Physical attacks:

- To hit: `FLOOR((1 + Weapon Proficiency) * (d100 / 100) * Weapon Governing Stat)`.
- If the defender has no reaction available or chooses not to react, compare the attack roll against AC.
- If the defender chooses a reaction, compare against Dodge, Block, or Parry; the defender wins ties.
- Damage is a separate roll: `FLOOR(Weapon Base Damage + (1 + Weapon Proficiency) * (d100 / 100) * Weapon Governing Stat)`.
- Critical 1: automatic miss regardless of modifiers; any additional physical-attack consequence is GM-determined.
- Critical 100: roll damage normally, double total damage, then apply defense-based reductions and resistance.
- Attack and damage are separate rolls.

Magical attacks:

- To hit: `FLOOR((1 + Spell Proficiency) * (d100 / 100) * Arcane)`.
- Damage: `FLOOR((1 + Spell Proficiency) * (d100 / 100) * Arcane + Base Spell Damage)`.
- Spell damage is a separate roll from spell to-hit.
- Spell to-hit natural 1 automatically misses, requires no defense roll, and still spends mana unless the spell says otherwise.
- Spell to-hit natural 100 is critical; if not successfully defended, roll damage normally and double total damage before defense reduction and resistance.
- Each individual spell has its own proficiency.
- Spell ranks: F, F+, E, E+, D, D+, C, C+, B, B+, A, A+, S, S+, SS, SS+.
- Base spell damage is authored per spell, not derived from rank by a universal formula.
- Overload is not MVP; it is a selectable spell-cast mode with known data requirements and GM-assigned DCs.

Combat automation:

- Turn order, action point reset, reactions, contested reactions, opportunity attacks, flanking, grappling, AOE positioning, and cross-sheet damage application are Roll20/manual.
- The app should not automate cross-sheet combat workflows.
- Hit and damage remain separate Roll20 chat actions. Damage is applied only through a later manual amount/type submission on the affected sheet, never through an attacker-to-defender relationship.
- `slayed_record` stores manually reported per-mob kill counts for XP tracking. Combat does not increment it automatically.
- Action points use the Reaction Time threshold table from `reference-docs/Chip_TTRPG_System.md`.
- There is no separate reaction pool; reactions spend normal action points outside the character's turn.
- Action points reset at the start of that character's own turn and do not carry over.
- Consumable use in combat normally costs one action point.

XP and level-up:

- MVP should track level-up readiness through a DM-configured XP tracker.
- DM defines XP needed for next level and mob/enemy XP values.
- Players can mark/count how many tracked mobs they killed.
- Aggregate XP tracker/progression is DM-facing only; players do not see XP progress.
- DM reviews XP at end of session and applies level-up changes manually through normal sheet edits.
- Automated stat distribution and level-up mutation workflows are deferred.

## 9. Augmentation Direction

Item-owned `stat_augmentations` has been replaced as the effect modeling surface by the general backend-owned augmentation system.

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

MVP leaves duration/expiry manual because turn counting is out of scope. Duration, expiry, and removal-condition fields are descriptive lifecycle notes only; they are not executable predicates, formulas, raw paths, or scripts. Future conditional augmentation logic requires a validated backend-owned condition/effect expression model before any automatic lifecycle evaluation. Ally/other-sheet effects are future-only and must not introduce intersheet action execution or cross-sheet automation.

Frontend augmentation UX boundary:

- GM item authoring may edit item augmentation template fields: name, description, active flag, validated metadata-backed target, operation, formula text/aliases when exposed, and explicit lifecycle notes (`duration`, `expires_at`, `removal_condition`).
- The frontend may display item template source metadata, target summary, formula/effect summary, active state, and lifecycle notes from authoritative snapshots.
- Runtime/applied augmentation state is display-only in frontend item authoring: `applied`, `applied_target_id`, concrete instance bridges, recomputed values, stacking outcomes, and application/removal results remain backend-authoritative.
- Players do not directly create, edit, attach, or remove item augmentation templates. Player-facing adjustment must go through backend-approved actions/intents for their allowed sheet or instance.
- Frontend target editing uses backend-provided metadata and must not expose raw JSON pointers, arbitrary state-root targets, intersheet targets, cross-sheet automation, or executable condition expressions.
- Item effects use `augmentation_templates`; legacy `stat_augmentations` is no longer part of the live item model, request payloads, frontend domain type, or item equipment display.

## 10. Roadmap

### Phase 7: General Augmentations

- [x] Replace item-owned `stat_augmentations` with a general augmentation model.
  - Removed `stat_augmentations` from item state models, item create/update payloads, protocol snapshots, generated frontend protocol types, frontend item domain types, and equipment display.
  - Existing legacy dumped `stat_augmentations` keys are ignored on item load; new item effects should use `augmentation_templates`.
- [x] Model augmentations as applied, reversible effects.
- [x] Add stable identity and source metadata.
- [x] Move augmentation targeting to validated backend paths/references.
  - [x] Audit current augmentation target validation and call sites for item templates, condition templates, direct runtime augmentation application, and frontend target inputs.
    - Item augmentation upsert rejects `state` root and scope/root mismatch, but still accepts arbitrary non-empty `sheet` or `instance` path segments and does not validate against a backend target catalog.
    - Full item create/update can carry `augmentation_templates` through `_build_item` without running the item augmentation template validator.
    - Condition preset create/update accepts `augmentation_templates` without authoring-time target validation; runtime condition application later rejects non-instance templates.
    - Runtime augmentation apply/remove validates root/scope, target ID existence, target path existence, and numeric leaf type at mutation time, but it is still late dynamic validation rather than catalog-backed authoring validation.
    - Action `apply_augmentation` execution is current-instance only and rejects target runtime/cross-sheet paths, but it relies on the stored augmentation record's target path being valid at execution time.
    - Frontend item and condition augmentation panels currently expose free target path segment inputs; item templates allow `sheet` or `instance`, condition templates display instance-only root.
    - Existing variable/action authoring metadata already exposes numeric/resource/percent paths with `action_mutation_allowed`; this is the best candidate source for the allowed augmentation target catalog.
  - [x] Define the allowed augmentation target catalog from backend-owned metadata, reusing variable/path registry concepts where practical.
    - Added backend `AugmentationTargetMetadata` and `build_augmentation_target_catalog()` derived from the canonical variable registry.
    - Catalog includes only mutation-safe numeric/resource/percent paths and excludes formula-backed stats, raw paths, global state, sheet items, and other non-catalog paths.
    - Item-template context allows sheet and instance targets; condition-template context allows instance targets only; runtime context keeps sheet/instance targets available for backend application flows.
    - Added focused backend tests for catalog membership, context filtering, and exclusion rules.
  - [x] Enforce backend target root/path validation when creating or updating item augmentation templates.
    - Item template upsert and full item create/update now validate augmentation targets against the backend `item_template` catalog.
    - Legacy/shared item update service path validates after merge before replacing the item record.
    - Added focused tests for accepted instance health, sheet stat, and resistance targets, plus rejected global, arbitrary, and formula-backed paths.
  - [x] Enforce backend target root/path validation when creating or updating condition augmentation templates.
    - Condition preset create/update now validates augmentation templates against the backend `condition_template` catalog.
    - Condition templates remain instance-only and reject sheet, state, arbitrary, and non-catalog paths before persistence.
    - Added focused tests for accepted instance health/fire resistance targets and rejected sheet/arbitrary update/create targets.
  - [x] Enforce backend target validation before runtime augmentation apply/recompute mutates state.
    - Runtime augmentation apply/remove now validates the stored root/path against the backend `runtime` augmentation target catalog before resolving and mutating sheet or instance state.
    - Runtime validation still rejects global state targets explicitly and preserves sheet/instance scope and target ID checks.
    - Recompute now preflights targeted augmentations that need apply/remove work before mutating, so invalid catalog paths fail the recompute pass without partial runtime changes.
    - Added focused runtime tests for accepted instance and sheet targets, rejected arbitrary/global/formula-backed targets, and recompute skip/preflight behavior.
  - [x] Add backend tests for accepted targets, rejected arbitrary paths, rejected global/intersheet targets, and stale/deleted target metadata.
    - Consolidated backend coverage across catalog metadata, item templates, condition templates, and runtime apply/recompute.
    - Added missing tests for item scope/root mismatch, condition global targets, runtime sheet/instance scope mismatch, and stale/deleted catalog targets rejecting before mutation.
  - [x] Expose augmentation target metadata to the frontend authoring flow without exposing raw mutation paths.
    - Added typed `get_augmentation_target_metadata` websocket route with optional `item_template`, `condition_template`, or `runtime` context filtering.
    - Backend response exposes catalog metadata only: target key, label, relative root/path segments, value type, description, and allowed contexts; it does not expose JSON pointers or freeform state mutation paths.
    - Regenerated frontend protocol types and route contract metadata for the new request/event.
    - Added frontend request builder, protocol parser, event adapter, and UI-state storage for augmentation target metadata.
  - [x] Replace frontend free segment target input with metadata-driven target selection where metadata exists.
    - Item and condition augmentation panels now use metadata-driven target selects instead of free path segment inputs.
    - Item authoring requests `item_template` target metadata; condition authoring requests `condition_template` target metadata.
    - Submit buttons require the selected target to exist in the loaded metadata, preventing stale or arbitrary frontend-authored paths from being submitted through normal UI controls.
    - Added frontend helper tests for metadata target application and metadata load request construction.
- [x] Add backend-evaluable formula/effect payload shape.
- [x] Keep application, removal, stacking, and recomputation backend-authoritative.
- [x] Implement current-instance condition/status augmentation hooks.
- [x] Finalize augmentation attach/update intents for gear and weapon items.
- [x] Reserve explicit duration/expiry/removal-condition fields for later lifecycle support.
- [x] Add augmentation state to authoritative sync once shape is ready.
- [x] Prepare conditional augmentation support without exposing raw mutation.
  - Documented lifecycle fields as inert descriptive notes for MVP, not executable predicates, formulas, raw paths, or scripts.
  - Added backend regression tests proving `duration`, `expires_at`, and `removal_condition` do not automatically apply, remove, or recompute augmentations.
  - Future automatic conditional logic remains deferred until there is a validated backend-owned condition/effect expression model.

### Phase 8: Intent And Runtime Migration

- [x] Migrate roll/action submission onto typed backend route/helper paths with backend-authoritative reconciliation only.
  - [x] Audit current roll/action submission paths before changing behavior.
    - Authored quick actions in `frontend/src/features/rolls/RollPanel.tsx` already submit through the typed `perform_action` request helper.
    - Legacy plain stat/dice rolls still call `client.submitRoll`, which emits a `submit_roll` `ClientIntent` from `frontend/src/hooks/useGameClient.ts`.
    - Mock `submit_roll` currently only emits an authoritative snapshot ack, but the UI path still presents it as an app roll flow despite the MVP boundary that one-off dice rolls belong in Roll20.
  - [x] Remove or gate legacy `submit_roll` so the frontend no longer exposes a local/app-authoritative plain roll path.
    - Fully removed the frontend `submit_roll` intent variant, `GameClient.submitRoll`, mock transport branch, and plain stat/dice roll request model types.
  - [x] Keep authored action execution on the normal editable action path by using `perform_action`; do not add quick-action-only routes or hardcoded action execution shortcuts.
    - Roll quick controls now build typed `perform_action` requests for resolved sheet action bridges.
  - [x] Convert remaining roll composer controls to either select backend-authored default actions or clearly hand off unsupported one-off stat/dice rolls to Roll20.
    - Removed simple dice/stat-only composer controls from the app surface; remaining quick controls only execute assigned backend-authored actions.
  - [x] Add focused frontend coverage proving assigned/default actions send typed `perform_action` requests and unsupported plain rolls do not create local authoritative roll results.
    - Added quick-action execution helper coverage and verified no `submit_roll`/plain roll request types remain in frontend source.
- [x] Replace handwritten frontend websocket builders with centralized typed route helpers for the already-live route set.
  - [x] Inventory current frontend request construction and classify each call site as live backend route, legacy/mock-only, or not ready.
    - Live backend routes with inline/local request construction:
      - `claim_sheet_access_code` in `frontend/src/features/auth/PlayerEntry.tsx`.
      - `adjust_instanced_sheet_resource` in `frontend/src/features/sheets/hooks/useResourceEditor.ts`.
      - `set_sheet_base_stat` in `frontend/src/features/sheets/hooks/useStatModifierEditor.ts`.
      - `create_sheet_item_bridge`, `update_sheet_item_bridge`, and `delete_sheet_item_bridge` in `frontend/src/features/sheets/PlayerCharacterSheet.tsx`.
    - Legacy/mock-only `ClientIntent` builders still in use:
      - sheet `create_sheet`, `update_sheet`, and `instantiate_sheet` legacy builders have been removed after typed route migration.
      - `save_encounter` and `spawn_encounter` in `frontend/src/features/encounters/intentBuilders.ts`.
      - `submit_roll` in `frontend/src/hooks/useGameClient.ts`.
    - Generated protocol route shapes already exist for the live helper migration targets in `frontend/src/generated/backendProtocol.ts` and are re-exported through `frontend/src/infrastructure/ws/protocol.ts`.
  - [x] Add a centralized frontend request helper module for already-live backend routes.
  - [x] Migrate sheet access-code claim request construction to the helper.
  - [x] Migrate current resource set/adjust request construction to helpers; current UI uses adjust, and the centralized set helper is available for future direct set callers.
  - [x] Migrate GM core base stat request construction to a helper.
  - [x] Migrate sheet item bridge equipment request construction to helpers.
  - [x] Add focused helper tests for migrated live routes.
  - [x] Update plan wording after helper coverage is in place, leaving item maker, action/formula authoring, and roll/action submission as separate migration work.
- [x] Add generated frontend request helpers for registered backend route contracts.
  - Added centralized typed frontend request helpers for every generated `ProtocolApplicationRequest` route not already covered.
  - Switched existing inline `authenticate` and `resync_state` client requests to those helpers.
  - Added request-builder coverage that compares helper coverage against generated `protocolRouteContracts` so new registered routes expose a missing-helper test failure.
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
  - Decision: add dedicated DM-authored global proficiency definition CRUD now; keep sheet proficiency bridges as per-sheet progress/correction records.
- [x] Add global proficiency definition CRUD.
  - Added DM-only backend websocket create/update/delete routes for `/proficiencies/{proficiency_id}`.
  - Added generated frontend protocol/request helpers and frontend authoritative state reconciliation for global proficiency definitions.
  - Added GM Proficiency Authoring UI for creating, editing, and deleting global proficiency definitions.
- [x] Validate sheet proficiency bridges against existing global proficiency definitions.
  - Sheet create/update and sheet proficiency bridge create/update now reject missing global `prof_id` references.
- [x] Add GM sheet proficiency assignment UI.
  - Sheet Viewer now has a Proficiencies tab for viewing sheet progress bridges and GM-only create/update/delete controls backed by global proficiency definitions.
- [x] Keep MVP strict for action proficiency references: do not auto-create sheet progress bridges at runtime when an action references a proficiency the sheet does not have.
  - Action create/update validates `gain_proficiency_use.proficiency_id` against global proficiency definitions, while runtime still rejects missing sheet progress bridges.
- [x] Add action-level proficiency gain authoring.
  - Action authoring can add/edit/remove/reorder proficiency gain steps using global proficiency definitions and an amount formula.
  - Multiple actions may feed the same proficiency definition.
- [x] Add variable registry/path metadata for formula authoring.
- [x] Add action/formula authoring metadata for sheet/instance scopes, aliases, and valid path catalogs from backend contracts.
- [x] Add common variable shortcuts.
- [x] Define baseline sheet checks as default action bridges instead of a dedicated `roll_basic_check` runtime intent.
- [x] Define `attack`, `dodge`, `parry`, and `block` as default editable action presets executed through the normal `perform_action` runtime.
- [x] Add stronger cross-entity validation for sheet/action/item/formula references.
- [x] Add runtime validation for allowed sheet/instance focus and reject `target_sheet_id` intersheet execution.
- [x] Add runtime validation for player ownership/access-code claim enforcement with session assignment state.
- [x] Expand runtime steps beyond `send_message` and `set_value`.
- [x] Implement bounded generic mutation options for increment/decrement/set steps, plus gain proficiency.
- [x] Implement augmentation/status action steps.
- [x] Model healing, resource spend, and resource restore as authored generic bounded mutation step patterns.
- [x] Add named reusable action preset templates for healing, resource spend, and resource restore if the authoring UI needs presets beyond raw step composition.
- [x] Centralize backend formula evaluation so action steps, augmentation formulas, and damage resolution use one shared evaluator.
- [x] Add resistance state/metadata for total, physical, magical, and per-damage-type resistance using the shared percent convention.
- [x] Add a semantic damage action step that evaluates an authored damage formula, validates canonical damage type, applies target resistance capped at 100 percent, and mutates current health.
- [ ] Extend damage resolution later for critical rules, weapon/spell-specific damage composition, and augmentation-derived combat modifiers.
  - Critical damage order is defined: calculate damage, double total damage for qualifying natural 100 outcomes, then apply defense-based reductions and resistance.
  - Physical and spell attacks roll hit and damage separately; advantage/disadvantage affects hit/check rolls only, not damage.
- [ ] Implement weapon resolver inputs and augmentation-derived attack modifiers on the backend when attack support is added.
  - Required weapon resolver fields: weapon type, base damage, governing stat, damage type(s), reach, proficiency reference, and proficiency growth rate.
  - Reach remains stored/displayed reference metadata unless a specific future resolver rule needs it.
- [x] Implement action execution against explicit sheet/instance IDs.
- [x] Do not implement backend roll resolution for default `attack`, `dodge`, `parry`, and `block` presets.
  - Decision: these remain editable authored actions that emit Roll20 chat roll commands through normal `perform_action`; backend-authoritative dice/combat roll resolution is out of scope.
- [x] Implement advantage/disadvantage as predefined runtime action parameters.
  - `perform_action.roll_mode` accepts `normal`, `advantage`, or `disadvantage`, defaulting to normal for existing callers.
  - Quick Actions and assigned sheet Actions expose the same segmented mode control and submit the generated backend contract.
  - The backend transforms standalone authored `1d100` Roll20 check expressions to `2d100kh1` or `2d100kl1`; non-normal mode requests without an eligible expression are rejected.
- [x] Add public Roll20 chat prefix wrapping for advantage/disadvantage output.
  - Transformed messages are prefixed with `[Advantage]` or `[Disadvantage]`; normal messages remain unchanged.
- [x] Add validation/error responses for invalid action execution payloads and unauthorized actions.
- [x] Finalize websocket request/response types for action execution requests.
- [x] Finalize websocket request/response types for typed template edits, sheet updates, and bridge operations.
- [x] Audit sheet schema and permissions for instance notes, optional GM template notes, inventory-list equipment, and stat/resource adjustments.
- [x] Add backend sheet note schema and DM-only note edit route for optional GM template notes.
- [x] Add backend instance notes for assigned player/DM editing.
- [x] Replace frontend-local equipment inventory mutations with backend sheet item bridge create/update/delete requests and authoritative patch reconciliation.
- [x] Add backend direct current instance resource edit routes for health and mana using `resource_edit` permissions, with backend validation and patch-only success: `set_instanced_sheet_resource` and `adjust_instanced_sheet_resource`.
- [x] Replace frontend-local stat override behavior with backend-authoritative stat requests or explicitly gate remaining override UI as mock-only: GM core base stat edits submit `set_sheet_base_stat`, formula/substat edits stay read-only here, and manual level-up overrides are mock-only.
- [x] Ensure backend role/permission model supports shared GM/player sheet rendering with restricted player-visible controls: player snapshots/patches redact GM template notes and GM-only item fields, while player-visible controls remain limited to authenticated instance notes/resources/actions.
- [x] Generate and persist sheet access codes for player sheet assignment/access, with DM visibility over all codes.
- [x] Implement player sheet access-code claim/assignment flow and enforce ownership: `claim_sheet_access_code` binds the player websocket session to one instance; notes, resources, and action execution enforce that assignment.
- [x] Keep relationship/bridge operations as simple explicit add/update/remove flows.
  - The stable websocket contract continues to use direct bridge create/update/delete operations for sheet actions, equipment, and proficiencies.
  - Internal service/helper names may describe intent, but do not create a second transport command vocabulary for MVP.
- [x] Add Roll20 bridge status/send-failure UX.
  - Added a typed backend `get_roll20_bridge_status` request and `roll20_bridge_status` event.
  - Frontend roll/action panel can refresh and display Roll20 bridge connected/disconnected/unknown state.
  - Roll20 bridge send failures update UI bridge status and show a targeted failure banner.
- [x] Add optional World Anvil link field to item schema and backend protocol/update payloads.
- [x] Add GM-only item notes/special properties to item schema, sync payloads, and role-based redaction.
- [x] Wire frontend resource adjustment controls to backend resource routes once those route contracts exist.
- [x] Replace mock transport placeholder roll outputs with backend-authoritative roll/chat handling.
  - Live action execution already uses typed backend `perform_action` handling and the Roll20 bridge.
  - Explicit mock mode no longer acknowledges action execution as successful; it returns a clear backend-required error instead of inventing roll/chat outcomes.
  - Added mock transport regression coverage for the authority boundary.
- [x] Make websocket-to-mock fallback explicit dev-only behavior or remove fallback from normal live mode.
  - Removed silent websocket-to-mock fallback from `ManagedGameClient`; failed websocket connects now remain disconnected with an error.
  - Mock transport is still available only when explicitly selected through mock transport mode.
  - Added focused frontend tests for websocket failure and explicit mock mode.
- [x] Migrate encounter preset save/spawn UI to typed backend routes as MVP.
  - Encounter presets are lightweight planned encounter collections: sheet template IDs plus counts, not combat automation.
  - Spawning an encounter creates backend-owned sheet instances from the saved collection and emits authoritative patches.
  - Replace legacy `save_encounter` / `spawn_encounter` frontend intents with typed backend route contracts and request helpers.
  - [x] Add backend typed route contracts for `save_encounter_preset`, `delete_encounter_preset`, and `spawn_encounter_preset`.
    - Added persisted backend `encounter_presets` state, snapshot protocol payloads, generated frontend protocol types, and request helpers.
    - Backend spawn creates current sheet instances from saved template/count collections and derives initial health/mana from backend formula evaluation.
  - [x] Migrate existing frontend encounter preset UI off legacy `ClientIntent` and onto typed request helpers.
    - Encounter preset panels now use typed `save_encounter_preset` and `spawn_encounter_preset` request helpers.
    - Removed legacy frontend `save_encounter` / `spawn_encounter` intent builders and mock-local encounter save/spawn behavior.
- [x] For each migrated intent family, add backend contract tests and frontend reconciliation tests.
  - [x] Encounter preset route/reconciliation coverage.
    - Backend websocket contract tests now cover encounter preset save, spawn, delete, DM permission, and missing-preset errors.
    - Frontend sync reducer tests now cover encounter preset snapshots and add/edit/remove patches from backend `encounter_presets`.
  - [x] Audit remaining migrated typed-route families for missing backend contract tests.
    - Covered by dedicated websocket contract tests: auth/session and resync (`test_ws.py`), Roll20 chat/status (`test_ws.py`), sheet access (`test_sheet_access.py`), runtime action execution (`test_sheet_runtime.py`), sheet CRUD/notes/resources/instancing (`test_sheet_admin_sheets.py`), sheet stats (`test_sheet_admin_stats.py`), sheet action/item/proficiency bridges (`test_sheet_admin_action_bridges.py`, `test_sheet_admin_item_bridges.py`, `test_sheet_admin_proficiency_bridges.py`), item CRUD (`test_sheet_admin_items.py`), item augmentation templates (`test_sheet_admin_item_augmentations.py`), formula/action CRUD (`test_sheet_admin_formulas.py`, `test_sheet_admin_actions.py`), condition presets (`test_condition_presets.py`), variable/authoring metadata (`test_variable_registry.py`), and encounter presets (`test_encounters.py`).
    - Registry/codegen contract metadata remains covered by `test_request_registry.py` and `test_protocol_codegen.py`.
    - No missing backend route-family coverage was found in this audit; next testing gap is frontend snapshot/patch reconciliation coverage by migrated family.
  - [x] Audit remaining migrated typed-route families for missing frontend snapshot/patch reconciliation tests.
    - Covered by frontend reconciliation tests today: protocol snapshot/patch projection (`eventAdapters.test.ts`, `SocketProtocolClient.test.ts`), reducer snapshot hydration for primary roots (`syncReducer.test.ts`), item CRUD patches, formula CRUD patches, action CRUD patches, encounter preset patches, sheet item bridge add/equipment projection, current instance resource patches, base stat patches, forced resync overwrite, Roll20 bridge status events, sheet access claim events, and mock transport sheet create/update/instance snapshots.
    - Added focused frontend snapshot/patch reconciliation tests for sheet action bridge create/update/delete patches, sheet item bridge update/delete patches, sheet proficiency bridge create/update/delete patches, condition preset create/update/delete patches, item augmentation template upsert/remove patches, and action-history append/prune patch reconciliation.
    - Request-construction tests still cover request payloads separately; these reducer tests prove authoritative snapshots/patches overwrite frontend state.
  - [x] Add focused frontend reconciliation coverage for sheet root and instanced sheet patches.
    - `syncReducer.test.ts` now covers real adapter/reducer reconciliation for `/sheets/{sheet_id}` add/nested update/remove and `/instanced_sheets/{instance_id}` add/nested update/remove.
    - Coverage verifies authoritative root/order updates and active-sheet normalization when an active instance disappears.
  - [x] Add focused frontend reconciliation coverage for template and instance notes patches.
    - `syncReducer.test.ts` now covers `/sheets/{sheet_id}/notes` and `/instanced_sheets/{instance_id}/notes` patch reconciliation.
    - Coverage verifies player-redacted template notes stay absent when omitted, template notes appear when the backend sends them, and active instance details prefer authoritative instance notes.
  - [x] Add focused frontend reconciliation coverage for formula-stat patches.
    - `syncReducer.test.ts` now covers `/sheets/{sheet_id}/stats/reaction_time` formula object replacement through the real adapter/reducer path.
    - Coverage verifies selector projection uses numeric literal text only and does not evaluate formula expressions on the frontend.
- [x] Add global sync conflict/recovery UX for snapshot resync and rejected intents.
  - Websocket state-version gaps now emit a UI-visible recovery event and request backend `resync_state`.
  - Resync requests show pending feedback and forced snapshots resolve as explicit state-resynced success.
  - Backend validation/permission errors tied to request IDs are presented as rejected intents instead of generic failures.

### Phase 9: Remove Remaining Frontend Fake Authority

- [ ] Complete the remaining frontend fake-authority cleanup through the slices below.
  - Removed the legacy frontend-only `ClientIntent` path so app transports now submit only generated/backend-owned protocol requests.
  - Remaining gap: `MockGameTransport` still owns a mutable `AppSnapshot`, handles sheet/instance mutations locally, and can be selected at runtime with `VITE_TRANSPORT=mock`.
  - Final local-state boundary: only active selection, current tab/page, editor/input drafts, search filters, display preferences, connection status, and request feedback/pending status remain frontend-owned.
- [x] Remove local sheet equipment mutations as source of truth.
- [x] Remove local sheet stat overrides as source of truth.
- [x] Remove local runtime values that masquerade as persisted domain state.
  - Removed UI-state shadow copies for sheet notes and mock-local stat overrides.
  - Deleted the unused mock-only manual level-up override panel rather than leaving a dormant fake-authority path in the codebase.
- [x] Ensure optimistic UI is always pending and overwritten by authoritative patches.
  - Instance notes now use a local draft with explicit backend save; authoritative backend notes remain the rendered source of truth and overwrite the draft when patches land.
  - Frontend authoritative snapshots no longer carry backend-owned `activeSheetId`; active selection stays local and is not projected from transport snapshots.

#### Frontend Legacy-Authority Cleanup Slices

- [x] Audit production frontend state ownership and classify remaining local state.
  - Authoritative application roots are replaced from backend snapshot/patch projection; no production reducer directly mutates sheet, instance, item, proficiency, action, formula, condition, encounter, or action-history records.
  - Editor drafts and navigation state are frontend-owned by design and are not cleanup targets.
  - The remaining parallel-authority path is the explicit mock transport and its mock-only projection model.
- [ ] Slice 1: remove the runtime mock backend.
  - Delete `MockGameTransport` and its mutable seeded snapshot behavior.
  - Remove `VITE_TRANSPORT=mock`, mock transport mode unions, runtime mode selection, and the transport badge that can only report websocket after cleanup.
  - Keep managed-client tests isolated with injected non-authoritative fake transports.
- [ ] Slice 2: remove mock-only sheet presentation state.
  - Delete `sheetPresentation` and `persistentSheetPresentation` from frontend snapshots, normalized server state, selectors, and domain models; real websocket projection always emits both collections empty.
  - Derive template kind from backend `dm_only`, and read names/notes/resources only from authoritative `Sheet` and `PersistentSheet` records.
  - Remove mock-only tags and timestamps plus dead conversion helpers that manufacture presentation metadata locally.
- [ ] Slice 3: remove misleading gameplay and scaffold UI.
  - Remove the health damage-type selector until the planned typed-damage backend route exists; current resource adjustment sends only an authoritative numeric delta.
  - This removes an ignored control only; the later manual typed-damage intake item adds the real backend route, resistance calculation, health mutation, and backend-backed UI.
  - Remove visible developer TODO/scaffold copy from template and item authoring screens.
  - Correct template search copy to name-only until backend-owned tags exist.
- [ ] Slice 4: finish the dead-code pass and verify the boundary.
  - Remove stale mock/presentation tests, exports, imports, README transport documentation, and generated build artifacts that are no longer referenced.
  - Re-run repository searches for mock authority, local domain mutations, visible TODO/scaffold text, and unused legacy model names.
  - Run frontend typecheck/build, lint, and the full frontend test suite.

### Phase 10: Verification And Hardening

- [x] Add websocket reliability behavior for reconnect/backoff and explicit snapshot resync recovery.
  - Socket close events now surface as managed connection-loss signals instead of generic payload errors.
  - Managed websocket clients schedule bounded reconnect/backoff attempts after unexpected disconnects, re-authenticate when an auth token is available, and reset state-version tracking so the next backend snapshot becomes authoritative.
  - Added focused frontend tests for dropped websocket reconnect scheduling, retry backoff after reconnect failure, re-authentication, fresh snapshot/version handling, and intentional disconnect behavior.
- [x] Add idempotency and ordering handling for replayed or duplicate mutation intents.
  - Client-supplied request IDs are now preserved end to end; the backend generates an ID only when the client omits one.
  - State-changing requests remain serialized by the state-sync lock and successful request IDs, including no-op mutations, are retained in a bounded newest-512 in-memory cache.
  - Replaying a retained request ID returns an explicit duplicate-request error without repeating the mutation, incrementing the state version, or broadcasting another patch.
  - The cache intentionally resets with the backend process/state-sync service. Retries after restart or after an ID ages out of the bounded cache are not deduplicated; persisted replay semantics remain out of MVP scope.
- [x] Decide whether to keep the HTTP chat debug endpoint long-term.
  - No HTTP chat debug endpoint remains in the FastAPI app; Roll20 delivery uses the authenticated `/ws/chat` service bridge and app chat intents use the registered `/ws` contract.
- [x] Move auth codes into explicit environment/config management before deployment needs tighten.
  - Backend auth settings now load through `backend/core/config.py`, allow documented defaults only for development/test, require explicit non-empty codes outside those environments, and reject duplicate role codes.
  - Added root and frontend environment examples; `just` loads the root `.env` when present.
  - Removed compiled frontend fallback auth codes. Optional role shortcuts now require Vite environment configuration, while normal code entry continues to submit the user-provided code.
  - Replaced the Firefox bridge's hardcoded service code with an extension options page backed by Firefox local extension storage.
  - Added backend settings tests and frontend coverage for missing auth configuration.
- [x] Continue trimming redundant websocket success payloads where authoritative patches already prove success.
  - Audited registered route contracts and handlers; sheet, item, formula, action, condition, stat, bridge, encounter, and resource mutations are already patch-only.
  - Retained authentication, metadata/status queries, sheet access-code/claim results, and other private/non-state responses because an authoritative patch cannot carry those semantics.
  - Retained `action_executed` because valid actions may emit Roll20 messages without mutating state and therefore produce no `state_patch`; the result event is the request completion signal in that case.
- [x] Backend websocket contract tests cover auth, snapshot, patch, error, resync, permission failures, action execution, variable mutation, and Roll20 bridge failure.
  - `test_ws.py` covers player/DM/service auth, bootstrap snapshots, unknown-request and auth errors, explicit resync, bridge status, successful delivery, and disconnected bridge failure.
  - `test_state_sync.py` covers ordered patch broadcast, increment/decrement mutations, patch replay, redaction during replay, and full-snapshot fallback.
  - `test_sheet_runtime.py` covers action execution plus set/increment/decrement, bounded resources, proficiency, augmentation, condition, damage, healing, and authorization failures.
  - Sheet-admin contract suites cover DM-only mutation rejection and patch-only success across each typed admin family.
- [x] Backend role-based access tests cover DM-only and future typed admin mutations.
  - Added a registry-level invariant that every current and future `minimum_role = "dm"` route rejects player sessions and accepts DM sessions.
  - Existing feature-family suites continue to cover representative DM success and player rejection through the full transport path.
  - Verified by the complete backend suite: 285 tests pass.
- [x] Backend tests cover generated-helper metadata and typed route/export consistency once generation expands beyond types.
  - Added dynamic checks that every public registry route declares client-generation metadata, every registered request/event model is exported, and every generated route-manifest entry exactly matches its registry contract.
  - Verified by the complete backend suite, including current generated TypeScript output: 285 tests pass.
- [x] Frontend tests cover wrapper parsing, reconnect/resync, state patch reconciliation, optimistic overwrite, reducer behavior, mock transport event handling, and core sheet interactions.
  - Socket protocol/event-adapter tests cover parsing, invalid payloads, snapshots, and patches.
  - Managed-client tests cover reconnect/backoff, re-authentication, deliberate disconnect, and version-gap resync.
  - Sync reducer tests cover backend-authoritative snapshots/patches, forced-snapshot overwrite, resources, notes, equipment, stats, and migrated entity families.
  - Reducer, mock transport, sheet selector, quick-action, and request/editor-value suites cover local lifecycle behavior and core sheet workflows.
  - The complete frontend set passes: 32 files and 227 tests; TypeScript build and ESLint also pass.
- [x] Add accessibility pass for focus states, labels, and keyboard navigation, especially sheet/resource editors.
  - Added tablist semantics and arrow/Home/End keyboard handling for character sheet sections, plus explicit active-sheet quick-switch tab states.
  - Added accessible names, expanded states, described hints/errors, alert roles, and visible focus styling for resource/stat editor controls.
  - Fixed a Vite env typing issue surfaced by frontend build verification.
- [x] Add integration tests for rapid intent sequences and snapshot/patch consistency.
  - Added real websocket-dispatch coverage for 24 concurrent resource intents submitted across four DM sessions, proving one ordered patch stream with monotonic versions and a final snapshot matching canonical state.
  - Added reconnect coverage proving a client can resume from its last seen version and receive every missing patch in order.
  - Added replay-window exhaustion coverage proving gaps older than the bounded 256-patch history return one authoritative snapshot at the current version.
- [x] Harden state-dump crash recovery with schema versions and migrations.
  - `state_dumpy.json` now uses a versioned checkpoint envelope while treating the existing raw state shape as legacy schema version `0`.
  - Sequential migration registration lives beside the state store so future state-shape changes can upgrade older checkpoints before domain-model loading.
  - Checkpoint writes flush and fsync a temporary file before atomic replacement; only a validated prior primary is rotated to `state_dumpy.json.bak`.
  - Startup falls back to the backup for malformed JSON, structurally invalid state, or unsupported newer schema versions, and defaults to empty state only when neither checkpoint is valid.
  - Recovery artifacts are ignored because persisted private sheet access codes may be present.
- [x] Add source request/action metadata to mutations for audit/debugging.
  - The request registry now establishes a task-local source context from every validated request, including request ID/type, authenticated actor role, and direct or nested entity IDs such as action, sheet, instance, and target IDs.
  - Every successful state-changing patch records its state version, request ID, operation types, paths, and request source in a bounded newest-256 runtime audit trail.
  - Mutation values are intentionally excluded so audit metadata does not duplicate authoritative state or expose hidden values; the trail is backend-runtime diagnostics rather than a player-facing protocol stream.
  - Context isolation, nested action ID extraction, action-execution attribution, concurrent-client attribution, and bounded audit eviction have focused backend coverage.
- [x] Add DM-only undo.
  - `undo_last_state_change` applies the last bounded inverse patch and broadcasts it as a new authoritative patch.
  - Undo history clears on reset or full-state import and the GM control lives on the State Backup page.

## 11. MVP Acceptance Criteria

MVP is done when:

- GM can create/edit a sheet from scratch.
- GM can create/edit formulas and actions with ordered steps.
- GM can attach actions to a sheet.
- GM can save planned encounter presets as collections of sheet templates/counts.
- GM can spawn a saved encounter preset into backend-owned sheet instances.
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

## 12. Implementation And Remaining Work

### Frontend Implementation Record

- [x] Separate GM creation flows for sheets, items, formulas, and actions.
  - GM navigation exposes separate template creation, item authoring, formula authoring, and action authoring views.
  - Template creation is isolated from template library editing.
  - Item, formula, and action authoring panels now expose explicit `New` commands while editing so creation can be restarted without saving over the selected record.
- [x] Add formula authoring UI.
  - Formula authoring reads authoritative backend formula records and submits typed create/update/delete requests.
- [x] Add action authoring UI with ordered step editing.
  - Action authoring reads authoritative backend action records, supports ordered step editing for exposed safe step types, and submits typed create/update/delete requests.
- [x] Add condition/status authoring UI once the backend shape is settled.
  - Frontend app state now normalizes backend `condition_presets` snapshots/patches into authoritative server state.
  - GM navigation includes a Condition Authoring page backed by typed condition preset create/update/delete requests.
  - Condition authoring supports name, description, public/GM-only visibility, and current-instance augmentation templates for backend `apply_condition_preset` action steps.
  - Added focused condition value/request tests and sync coverage for condition preset snapshots.
- [x] Add variable/path browser and shortcut picker UI for formula/action authoring.
  - Added a reusable metadata-driven variable browser for formula references and backend-approved mutation paths.
  - Formula authoring now loads backend action/formula metadata and inserts selected shortcut tokens while preserving alias path metadata.
  - Action authoring can insert selected variables into send-message formulas and damage amount formulas, also preserving alias path metadata.
  - Added focused helper tests for variable filtering/formatting/token insertion and action formula alias updates.
- [x] Add assigned-action execution UI wired to `perform_action`.
  - Added an Actions tab on the active sheet view that lists action bridges resolved from authoritative sheet state.
  - Players and GMs can perform assigned actions through the existing typed `perform_action` request helper using the current instance ID.
  - Execution remains same-sheet/current-instance only; no target picker or intersheet workflow was added.
  - Added focused selector coverage for assigned action resolution and stale bridge filtering.
- [x] Provide dedicated sheet viewer mode.
  - GM navigation now includes a dedicated Sheet Viewer mode separate from the mixed GM console.
  - The page reuses the authoritative active sheet picker and existing GM-mode sheet detail renderer.
  - No new backend state, special routes, or intersheet workflow were added.
- [x] Replace player self-create/list-all flow with generated sheet access-code entry/assignment flow.
- [x] Wire sheet create/edit/spawn flows to backend typed route contracts once available.
  - [x] Inventory current frontend sheet create/edit/spawn call sites and classify each as live route-ready, legacy/mock-only, or blocked by UI shape.
    - `TemplateCreatePage.tsx` previously created a frontend `Sheet` plus frontend-only `SheetPresentation` and sent legacy/mock `buildCreateSheetIntent`; it now maps editor values to backend `SheetDefinitionPayload` and sends typed `create_sheet`.
    - `TemplateLibrary.tsx` edit/save previously sent legacy/mock `buildUpdateSheetIntent` with partial `Sheet` changes plus frontend-only `SheetPresentation`; it now sends typed `update_sheet` with a full `SheetDefinitionPayload`.
    - `TemplateLibrary.tsx` spawn previously sent legacy/mock `buildInstantiateSheetIntent`; it now sends typed `create_instanced_sheet` requests with generated instance IDs, starting resources, empty notes, default resistances, and player-template access-code generation.
    - `features/sheets/intentBuilders.ts` was removed after the sheet create/edit/spawn call sites moved to typed requests.
    - Generated protocol route shapes already exist for `create_sheet`, `update_sheet`, and `create_instanced_sheet`.
  - [x] Map current sheet create/edit/spawn UI payloads to generated backend route contracts.
    - Template create maps `TemplateEditorValues` to `CreateSheet.sheet` / `SheetDefinitionPayload`:
      - `id`: frontend-generated `makeId("template")`.
      - `name`: trimmed editor name.
      - `notes`: trimmed editor notes, stored on backend `sheet.notes` because template notes are now backend-backed and player-redacted.
      - `dm_only`: `values.kind === "enemy"`.
      - `xp_given_when_slayed`: `0` for the current UI.
      - `xp_cap`: `""` for the current UI.
      - `stats`: `createDefaultStats()` plus parsed core stat overrides.
      - `proficiencies`, `items`, `slayed_record`, and `actions`: empty records.
      - `resistances`: omitted until template resistance UI exists, letting backend defaults apply.
    - Template edit maps to `UpdateSheet.sheet` as a full sheet payload, not a partial patch:
      - Start from the current authoritative `Sheet`, apply editor name/notes/kind/core stats, and preserve existing bridge records, XP fields, formulas, resistances, and other sheet fields.
      - Submit the same ID in both `sheet_id` and `sheet.id`.
    - Presentation metadata handling during typed-route migration:
      - `kind` is derived from `dm_only`.
      - template notes move to backend `sheet.notes`.
      - `tags` and `updatedAt` are frontend presentation-only today and are not accepted by backend `create_sheet` / `update_sheet`; hide/drop them for the live typed migration or defer them behind a future backend metadata field/route before preserving them live.
    - Template spawn maps to `CreateInstancedSheet`:
      - `instance_id`: frontend-generated `makeId("instance")`.
      - `parent_sheet_id`: selected template ID.
      - `health`: numeric `sheet.stats.health.text` when finite, otherwise `sheet.stats.constitution`.
      - `mana`: numeric integer `sheet.stats.mana.text` when finite, otherwise `sheet.stats.arcane`.
      - `notes`: `""` for the current spawn UI.
      - `resistances`: omitted until spawn resistance UI exists, letting backend defaults apply.
      - `generate_access_code`: `true` for player templates and `false` for enemy templates.
      - Multiple spawn count should emit one `create_instanced_sheet` request per instance unless/until a backend batch route exists.
  - [x] Add centralized request helpers for sheet create/update/delete and sheet instancing/spawn routes.
  - [x] Migrate template creation flow from legacy `ClientIntent` to typed backend `create_sheet` request.
  - [x] Migrate template edit/save flow from legacy `ClientIntent` to typed backend `update_sheet` request.
  - [x] Migrate template spawn flow from legacy `ClientIntent` to typed backend instancing/spawn request.
  - [x] Remove or isolate migrated sheet legacy intent builders once no live call sites remain.
  - [x] Add focused helper/reconciliation tests for sheet create/edit/spawn migration.
  - [x] Update plan wording after sheet create/edit/spawn live route migration is complete.
- [x] Wire item maker to backend item records instead of local UI templates.
  - [x] Inventory current item maker/local-template shape against backend `ItemDefinition` routes.
    - `ItemMakerPage.tsx` previously read `uiState.itemTemplates` / `itemTemplateOrder` and dispatched local `upsert_item_template` / `remove_item_template`; these records never became backend `items`.
    - `SheetEquipmentSection` already reads authoritative `serverState.items` / `itemOrder`, so item maker output should feed the same backend item records used by equipment attachment.
    - Backend typed item routes already exist: `create_item`, `update_item`, and `delete_item`, gated by `equipment_edit` and emitted through state patches.
  - [x] Map current item editor fields to backend item payload fields and identify gaps.
    - `name` maps directly to `ItemDefinitionPayload.name`.
    - `value` maps to `price`; `weight` maps to `weight`.
    - Current freeform `immediateEffects` / `nonImmediateEffects` are not structured augmentation records; preserve them as labeled public `description` text for the migration, and leave `augmentation_templates` empty until the augmentation builder exists.
    - Current `type`, `rank`, and `updatedAt` have no backend item fields; either fold `type` / `rank` into the public description during migration or defer first-class item metadata fields until the backend schema intentionally supports them.
    - Existing backend fields missing from the current UI are `description`, `world_anvil_url`, `gm_notes`, `gm_special_properties`, and `augmentation_templates`.
  - [x] Add centralized typed request helpers and focused tests for `create_item`, `update_item`, and `delete_item`.
  - [x] Replace item maker local reducer dispatches with typed backend item CRUD requests and pending/ack feedback.
  - [x] Update item maker editor/list components to read/write `ItemDefinition` records from authoritative server state.
  - [x] Add World Anvil URL, GM notes, and GM special properties fields to the item maker UI.
  - [x] Remove or isolate local `ItemTemplate` seed/reducer state once no live UI depends on it.
    - [x] Audit remaining `ItemTemplate`, `itemTemplates`, `itemTemplateOrder`, `upsert_item_template`, and `remove_item_template` references and classify live vs dead code.
      - Local item-template authority has been removed from frontend state, reducer actions, domain models, seed files, item maker components, and equipment selection naming.
    - [x] Remove default local item library seeding from frontend initial UI state once authoritative item seeding is confirmed elsewhere or intentionally deferred.
      - Authoritative item records now come only from backend snapshots/patches; reference item seeding is deferred to a backend seed/migration path instead of frontend UI state.
    - [x] Remove local item template UI-state fields and reducer actions when no live component reads or dispatches them.
    - [x] Remove the frontend `ItemTemplate` domain type and old mapper names once all item maker/list code uses `ItemDefinition`.
    - [x] Update plan wording to state item records are backend-authoritative and no local item template authority remains.
  - [x] Add item maker reconciliation tests covering create/edit/delete against authoritative item snapshots or patches.
    - [x] Add focused item editor mapping tests for authoritative `ItemDefinition` create/update payloads and backend-to-editor value loading.
    - [x] Add item maker request/reconciliation tests for create/edit/delete UI submission against backend snapshot or patch state.
- [x] Wire action/formula authoring flows to backend typed route contracts.
  - [x] Inventory current action/formula authoring shape against backend route contracts.
    - Backend typed CRUD routes already exist and are DM-only patch emitters: `create_formula`, `update_formula`, `delete_formula`, `create_action`, `update_action`, and `delete_action`.
    - Generated frontend protocol types and route metadata already include those CRUD routes under `sheetAdminFormulas` and `sheetAdminActions`.
    - Authoring metadata route exists as `get_action_formula_authoring_metadata`; it is player-accessible and returns formula alias/path metadata, action step metadata, and default action preset templates for authoring UI.
    - Frontend authoritative state already stores backend `formulas` / `formulaOrder` and `actions` / `actionOrder` from snapshots and patches.
    - Before this migration, the frontend had no dedicated formula/action authoring pages and quick controls were UI-only previews; the completed work below replaced both gaps.
  - [x] Add centralized request helpers and focused tests for formula create/update/delete and action create/update/delete.
  - [x] Add formula authoring value mappers for `FormulaDefinition` payloads, including alias/path preservation.
  - [x] Add formula authoring page/list/editor that reads authoritative `serverState.formulas` and submits typed formula CRUD requests.
  - [x] Add action authoring value mappers for `ActionDefinition` payloads, initially preserving ordered existing steps and supporting basic name/notes editing.
  - [x] Add action authoring page/list/editor that reads authoritative `serverState.actions` and submits typed action CRUD requests.
  - [x] Add action step editing scaffold using authoring metadata, without exposing raw mutation paths before validated picker UX exists.
    - [x] Add request helper, protocol adapter handling, and UI-state storage for `get_action_formula_authoring_metadata` / `action_formula_authoring_metadata`.
    - [x] Add a metadata loader to action authoring and display safe step metadata without raw mutation path editing.
    - [x] Add safe initial `send_message` step creation/editing.
  - [x] Add frontend reconciliation tests for formula/action create/edit/delete snapshots or patches.
  - [x] Update GM navigation once formula/action authoring pages are live.
    - GM navigation now includes Formula Authoring and Action Authoring pages.
    - Current action step editing intentionally supports only safe `send_message` steps; raw mutation/path step editing remains deferred until validated picker UX exists.
- [x] Add augmentation builder scaffold.
  - [x] Add frontend augmentation domain typing for authoritative `augmentation_templates` on item definitions.
  - [x] Add item augmentation template editor value mapping to/from backend `AugmentationPayload`.
  - [x] Add typed request builders/submissions for `upsert_item_augmentation_template` and `remove_item_augmentation_template`.
  - [x] Keep scaffold target selection as structured path segments for future validated picker UI; no raw mutation path editing is exposed.
- [x] Add UI for gear/weapon augmentation attachment.
  - [x] Add item maker augmentation panel for the selected authoritative item.
  - [x] List existing item augmentation templates and support edit/remove actions.
  - [x] Submit create/update/remove through typed backend item augmentation template routes.
  - [x] Keep target editing as structured root plus path segment inputs until validated target picker UX exists.
- [x] Define frontend augmentation UX boundaries for what is editable versus display-only on weapon/gear augments.
  - [x] GM item authoring can edit item augmentation template definition fields only.
  - [x] Runtime/applied augmentation state is display-only in item authoring and remains backend-authoritative.
  - [x] Player-facing augmentation changes must go through backend-approved actions/intents.
  - [x] Raw mutation paths, state-root targets, intersheet targets, and cross-sheet automation remain deferred until validated backend picker UX exists.
- [x] Wire current HP/mana resource adjustment and GM core base stat edits to backend-authoritative requests; formula/substat editing remains read-only here, and manual level-up drafts remain mock-only.
- [x] Use roll composer quick controls to prefill or select default editable actions, then submit through the normal backend-authored action/Roll20 flow.
  - [x] Resolve quick controls through the active sheet's `default_attack`, `default_dodge`, `default_parry`, and `default_block` action bridges.
  - [x] Disable quick controls when the active sheet has removed or lacks that assigned action.
  - [x] Submit selected quick actions through the typed `perform_action` request helper instead of `submit_roll`.
  - [x] Remove the plain dice/stat legacy local path; one-off rolls remain in Roll20 for MVP.
- [x] Add canonical damage type selection to semantic damage action-step authoring UI.
  - [x] Add shared frontend canonical `DAMAGE_TYPES` options beside the `DamageType` union.
  - [x] Add resolve-damage step creation/edit/remove/reorder helpers that preserve unrelated action steps.
  - [x] Add action authoring controls for `resolve_damage` damage type and amount formula text.
  - [x] Keep damage target selection hidden because runtime damage resolution is current-instance only for MVP.
- [x] Replace or remove the Roll Log panel in favor of backend-owned redacted action history/status; do not store frontend-local roll history.
  - [x] Define backend action-history record and redacted protocol shape.
    - Canonical records live as backend state models with visibility-tagged message/detail fields.
    - Snapshot protocol now includes redacted `action_history` payload entries.
    - Player snapshots filter to the assigned instance and omit GM-only formulas, mutation summaries, and private errors.
    - Future action-history patches remain DM-only until session-specific player history delivery exists.
  - [x] Add backend serialization rules for DM/full view vs player/redacted view.
  - [x] Decide MVP retention limit and whether action history is persisted with `state_dumpy.json` or kept in bounded runtime memory.
    - MVP action history is persisted with `state_dumpy.json` as a bounded audit/status stream.
    - Retain the newest 200 canonical history records and prune older entries on state load/dump and helper insertion.
    - Persisted history remains summary/audit metadata only; it is not replayable and does not duplicate authoritative HP/mana/stat/proficiency values.
  - [x] Update frontend panel to render redacted action status/history only after backend shape exists.
    - Frontend app state now carries backend `action_history` snapshot payloads as read-only authoritative state.
    - The former empty Roll Log panel now renders backend-provided action summaries, status, messages, and DM audit details when present.
    - Mock/local roll submission no longer creates frontend-local roll history entries.
- [x] Fix frontend lint errors and warnings so `npm run lint` passes with `--max-warnings 0`.
  - Removed unused frontend imports/variables and explicit `any` in websocket tests.
  - Split fast-refresh-sensitive hooks/constants out of component files.
  - `npm run lint` now passes with `--max-warnings 0`.
- [x] Add tests for reducer, transport event handling, and core sheet interactions.
  - Existing reducer tests cover intent, UI, and authoritative sync reducers.
  - Existing transport tests cover websocket parsing/adaptation, socket client behavior, managed client behavior, request builders, and mock transport events.
  - Added dedicated sheet selector tests for template/instance view projection, active sheet detail, current resource display, equipment bridge lookup, active weapon labels, available items, and player instance filtering.

### Frontend Backend-Access Gaps

- [ ] Add GM sheet-access management UI that consumes `sheet_access_codes`, lists active codes, and supports generating/replacing a code for a selected player instance.
  - Completed: frontend adapter and DM-only UI state retain private code responses, and the GM console lists/copies active codes.
  - Remaining: add selected-instance generation/replacement controls.
- [ ] Add GM action assignment controls to the active sheet Actions tab using sheet action bridge create/update/delete routes.
  - Allow selection from authoritative global actions, preserve stable relationship IDs, and keep player mode execution-only.
- [ ] Complete sheet definition editing for backend formula stats and resistance values.
  - Add validated formula text/alias editing through `set_sheet_formula_stat` or full sheet update and expose total/category/specific resistance inputs already supported by sheet payloads.
- [ ] Make global formula definitions reusable from action-step authoring through stable formula ID selection/reference rather than leaving Formula Authoring as an isolated CRUD catalog.
- [ ] Complete Action Authoring controls for backend-supported `set_value`, `increment_value`, `decrement_value`, `apply_augmentation`, and `apply_condition_preset` steps.
  - Use backend metadata pickers for paths/records and do not expose unrestricted raw mutation paths.
- [ ] Add template deletion controls to Template Library using the existing typed `delete_sheet` route, with dependency errors surfaced through normal intent feedback.
- [ ] Add encounter preset edit and delete controls using stable encounter IDs plus the existing save/delete routes.
- [ ] Add equipment quantity editing through sheet item bridge updates instead of limiting inventory changes to add-one, active toggle, and remove.

Manual amount/type damage intake is already tracked in the later hit/damage checklist and is intentionally not duplicated here.

### Recently Completed

- [x] Add GM console overlay mode for fast page switching and encounter spawn actions.
  - Added a persistent sticky GM toolbar across every GM page with compact page navigation, active-sheet selection, connection/pending status, and encounter preset spawning.
  - The toolbar is collapsible and responsive; it reuses frontend-local page/sheet selection and the existing typed encounter spawn request.
  - Removed the redundant GM navigation, session-status, active-sheet tabs, and encounter quick-select panels from the console and Sheet Viewer.
- [x] Add XP tracker for level-up readiness.
  - DM defines XP needed for next level and mob/enemy XP values.
  - Players can mark/count how many tracked mobs they killed.
  - Aggregate XP tracker/progression is DM-facing only; players do not see XP progress.
  - DM UI shows current XP versus XP needed; DM reviews at end of session.
  - Level-up application remains manual DM sheet edits for MVP.
  - Backend reuses `xp_cap`, `xp_given_when_slayed`, and `slayed_record`, calculates totals authoritatively, and restricts player updates to the claimed sheet instance.
  - Player snapshots and tracker responses redact XP thresholds, mob XP values, earned XP, totals, and readiness while retaining tracked mob names and editable kill counts.
  - Both the dedicated tracker route and the compatible sheet slay-count route mutate authoritative `slayed_record` values with ownership checks.

- [x] Export/import JSON.
  - DM-only export returns the backend private persisted-state envelope, including fields omitted from role-redacted snapshots.
  - Import validates through schema migration and domain loading, atomically replaces state, clears replay/undo history, bumps state version, and broadcasts full role-redacted snapshots.
  - The GM State Backup page supports export/download and paste/file import.

### Later

- [ ] Add separate Roll20 hit/damage composition and manual typed damage intake.
  - [ ] Add normalized tags to backend formula models, typed protocol payloads, persistence, and generated frontend types, defaulting existing formulas to no tags.
  - [ ] Extend the existing GM Formula Authoring screen with controlled/common tag suggestions, normalized custom tag entry, tag display, and create/update preservation.
  - [ ] Add the same tag controls to inline formulas authored inside action steps so middleware is not limited to global formula definitions.
  - [ ] Add formula-modifier selectors for required/excluded tags and optional direct action/formula/step IDs; every populated selector constraint must match.
  - [ ] Extend augmentation authoring with metadata-backed controls for tag and direct-ID selectors.
  - [ ] Add typed evaluation-time modifier effects, initially numeric formula operations and advantage/disadvantage grants, without rewriting authored formulas or duplicating state.
  - [ ] Add formula-execution context carrying stable `action_id`, `step_id`, optional `formula_id`, and normalized semantic tags, then apply matching active/equipped modifiers during evaluation.
    - Tags are the default for category-wide effects, such as `damage + fire` or `check + perspective`; direct IDs handle deliberate one-action/one-roll exceptions.
    - Example: a helmet requiring `damage + fire` adds `2` only to matching fire-damage formulas, while a hat requiring `check + perspective` modifies all matching perspective checks.
  - [ ] Add separate Roll20 hit and damage action behavior: hit uses normal/advantage/disadvantage, while composed weapon/spell damage uses normal/critical.
    - Weapon/spell inputs and source-sheet augmentations contribute only to emitted formulas; an attack never targets or mutates another sheet.
  - [ ] Add manual typed damage intake on an affected sheet: raw amount plus damage type, backend resistance calculation, one final floor operation, and authoritative health patch.
    - Players may submit damage only to their assigned instance; DMs may submit it to any instance. No attacker/source relationship is stored or required.
  - Conservative project defaults are recorded for criticals, resistance bounds, rounding, minimum damage, spell composition, and augmentation order; rule-author response is no longer a blocker.
- [ ] Combat/turn tracking.
- [ ] Overload selected mode/alternative handling.
- [ ] Mastery unlock enforcement.
- [ ] Multi-campaign support.
- [x] Mobile layout refinement for player character sheet and GM encounter/template panels.
  - Added a compact app shell and single-column mobile grids for player resources, core stats, equipment, encounter roster entries, and template editor fields.
  - Added horizontally scrollable sheet/navigation tabs, 44px touch targets, wrapping/full-width action controls, and stacked encounter/template list cards.
  - The persistent GM toolbar collapses and stacks its controls on narrow viewports.
- [x] DM-only undo.
  - Added a bounded backend inverse-patch stack and DM-only typed undo request.
  - Added a GM-facing Undo Last Change visual control.
  - Undo emits normal authoritative patches; it is not a replay system and does not duplicate side-effect state.

## 13. Deferred Rule Decisions

Expanded answered rules and future-automation handoff: `reference-docs/rule-decisions-needed-answered.md`.

Answered rulings now captured in this plan:

- HP max is `Health * Racial HP Multiplier`; the multiplier is authored by race or creature template.
- Carry weight is `FLOOR(Strength)`.
- Resistance is additive, clamped to `0.00..1.00`, capped at 100 percent, and applied as `FLOOR(Damage * (1 - Resistance))`.
- Heavy armor imposes disadvantage on Dodge; shields normally grant advantage on Block.
- Critical behavior is defined for physical attacks, spell to-hit, Dodge, Block, Parry, skill checks, grapple checks, and overload checks.
- Overload has defined tiers, mana costs, check formula, and failure outline; only the DC remains GM-assigned rather than formula-derived.

These remain future implementation or campaign-adjudication boundaries, not MVP blockers:

- Automated level-up stat distribution beyond XP readiness tracking and manual GM edits.
- Backend-owned combat/turn tracking, including action-point reset timing, initiative, reactions, opportunity attacks, AOE positioning, and cross-sheet damage application.
- App-side physical/spell attack resolvers, including criticals, Dodge/Block/Parry reductions, counterattacks, and augmentation-derived modifiers.
- Overload mode automation and overload explosion resolution.
- Mastery unlock enforcement and visibility for disabled/hidden content.
- Frontend formula previews for formulas that remain Roll20-resolved.
- Stat/resource adjustment semantics where the answer is not a direct current HP/mana edit: additive, replace-value, formula-driven, or rule-specific.

## 14. Historical Sources

- Section 4 is the authoritative current implementation baseline.
- Sections 10 and 12 hold detailed completion records and remaining work; do not duplicate completed tasks in a separate summary.
- Earlier completion history remains archived in `plan/archived/Completed.md` and the source plans listed at the top of this document.
- BUG-001 through BUG-009 were resolved and archived in `plan/archived/resolved_bugs_2026-06-25.md`.
