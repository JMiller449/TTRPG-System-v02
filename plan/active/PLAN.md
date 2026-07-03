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

Build a backend-authoritative sheet, fact, variable, formula, and action executor for the Chip TTRPG system, with Roll20 remaining the table surface and play log for MVP.

The MVP is a character builder and sheet instancer where:

- GM authors characters, facts, items, conditions, formulas, and actions/macros.
- GM authors mechanically complete items whose carried/equipped behavior, granted actions, quantity consumption, and wearer effects are backend-authoritative.
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
- Current action step kinds include `calculate_value`, `send_message`, `set_value`, `increment_value`, `decrement_value`, `resolve_damage`, `gain_proficiency_use`, `apply_augmentation`, and `apply_condition_preset`.
- XP tracker routes reuse sheet XP thresholds, enemy XP values, and slay records; backend-derived tracker responses expose full X/Y progress only to DMs.
- Formula expansion is relative to one root object, supports dataclass/dict traversal, guards against cycles, and backend numeric evaluation supports arithmetic, dice expressions, `min`, `max`, `floor`, `ceil`, and `round` for authoritative action/stat calculations.
- Semantic damage action steps evaluate authored formulas, apply typed resistance, and mutate instance health through state sync.
- Manual typed damage intake uses `apply_instanced_sheet_damage` to validate a raw amount and canonical damage type, apply backend resistance with one final floor, and patch instance health.
- Roll20 chat bridge is fail-fast, does not queue disconnected messages, and consumes bridge `hello` / `chat_delivery` events for logging.

Frontend:

- Utilize the outline in ".\reference-docs\design_study" as your design bible for UI/UX, use the provided preview as a reference, but not as a concrete design structure.
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
- Player notes use a local edit draft backed by an authoritative save route; equipment inventory, the current legacy single-active-item display, current-resource adjustment, and GM core base stat edits use backend-authoritative routes/state.
- Shared sheet selectors, resource/stat editor hooks, and feature reducer modules exist to keep the main sheet component smaller.
- Stat metadata is centralized under frontend domain stats and reused by sheet and roll composer UI.
- Frontend styles are split into feature-scoped files with shared tokens/utilities.
- Roll composer scaffolding exists, including advantage/disadvantage controls and quick-roll controls that select assigned default authored actions when available.
- Generated protocol types/contracts exist. Centralized request helpers cover the already-live frontend route set; fully generated request helpers for all registered backend routes remain future work.
- Live websocket requests use generated protocol for auth/resync and centralized typed helpers for sheet creation/update/instancing, sheet access claims, sheet item bridge equipment mutations, current-resource adjustment, GM core base stat edits, item maker CRUD, item augmentation template CRUD, action/formula authoring, quick authored action execution, and encounter preset save/spawn.
- The frontend runtime always uses the authoritative websocket backend; connection failure remains disconnected and reports an error.
- Frontend-local state owns note edit drafts and other transient UI controls; sheet equipment, the current legacy active-item state, current-resource values, displayed sheet stats, and level-up changes are not local sources of truth.
- Item maker create/edit/delete sends backend `ItemDefinition` CRUD requests, reconciles through authoritative item state, and exposes World Anvil URL plus GM-only notes/special-properties inputs.
- Formula/action authoring UI and broad assigned-action execution UI exist; roll composer quick actions select assigned default editable action presets and submit them through `perform_action`.
- Player entry now claims a generated sheet access code and uses the backend-validated claimed instance as the active sheet.
- The former Roll Log panel renders the backend-owned redacted action-history/status stream; it is not a frontend-local roll history.
- Encounter preset UI uses typed backend route helpers for lightweight planned encounter collections.
- GM navigation includes an XP Tracker page for thresholds, mob XP values, and backend-calculated level readiness; character sheets include a Kills tab for tracked mob counts.
- GM navigation, active-sheet switching, connection/pending status, and encounter quick-spawn are consolidated into a persistent collapsible toolbar across every GM page.
- Negative health adjustments use backend-authoritative typed damage intake; positive health restoration and mana changes remain direct current-resource adjustments.
- Frontend build, tests, and lint pass.

## 5. MVP Data Model Direction

### Sheets

- Use one sheet model for players and enemies, distinguished by metadata/access.
- Support template and instance modes.
- Player characters have a base/template sheet and session instances.
- Enemies should be spawned from reusable templates.
- Current HP, current mana, conditions, and temporary overrides live on instances.
- Base stats, facts, proficiencies, equipment, formulas, and permanent values live on base/template state or computed state.
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
- reference
- list of validated enum/reference values
- current/max resource
- formula result

Variables should support GM-only visibility, player-editable flags, descriptions/notes, min/max constraints, and units such as feet, percent, HP, mana, and actions.

### Facts

Facts are named, typed values that do not belong in fixed sheet, item, or action schemas and are not mutable instance resources or executable action steps. Numeric Facts may be literal or formula-backed derived values.

- Facts are reusable GM-authored definitions in a global catalog and attach to sheets, items, or actions through explicit stable-ID subject-fact bridges.
- A fact definition carries a stable ID, name, description, allowed subject types (`sheet`, `item`, `action`, or a combination), value type, optional validation choices/reference kind, default value or formula, formula aliases where applicable, optional unit/display hint, visibility (`public` or `gm_only`), and backend-owned required/default metadata.
- Subject-fact bridges own the subject-specific typed value or formula override. This allows reusable definitions such as `level`, `movement`, `base_damage`, `rank`, `range`, `target_count`, or `mana_cost` to vary per subject while retaining a backend-owned default.
- Initial Fact value types must cover numeric/formula, boolean, text, validated enum, validated reference, and validated enum/reference list values. Do not encode governing-stat selections, proficiency links, or damage-type lists as unchecked freeform text.
- Fact formulas use the existing backend formula evaluator and approved variable metadata/path picker. Sheet Facts resolve sheet-relative inputs, item Facts resolve item-relative Facts, and action Facts resolve action-relative Facts. Runtime contexts may expose validated Facts across subject boundaries only through the current action and an eligible explicit source-item relationship. Raw client mutation paths and frontend gameplay evaluation remain prohibited.
- The backend evaluates attached formula Facts authoritatively for sheet/instance, item, and action display. Evaluated results are read-only projections, must report missing references/cycles explicitly, and must update through snapshots/patches when definitions, assignments, or dependencies change.
- Optional facts may be created, edited, deleted, attached, or detached by a GM. Deletion must reject live sheet, item, or action references unless those bridges are removed in the same authoritative operation.
- Required facts are identified by reserved backend IDs and backend-owned subject/profile rules rather than a client-trusted `deletable` flag. Their ID, name, required status, and presence on each matching subject are backend-enforced; they cannot be deleted or detached.
- A GM may edit an allowed required-Fact value/formula and reset it to the backend-owned default. Required defaults are seeded on fresh state, backfilled onto matching existing subjects, preserved through export/import, and restored if omitted by an imported payload.
- The first required fact is `amount_of_reactions`, displayed as `Amount of Reactions`, with the supplied default formula `@registration + @reaction_time` and sheet-relative aliases to `stats.registration` and `stats.reaction_time`.
- `Amount of Reactions` is initially an informational derived fact only. It does not introduce a current reaction pool, turn resets, or automated reaction enforcement; those remain part of later combat/turn tracking.
- Items support a stable backend-owned Fact profile used only to select required Fact sets and validation. The initial `weapon` profile requires Facts for weapon type, base damage, governing stat, physical damage type(s), reach, proficiency reference, and proficiency growth rate; non-weapon items are not forced to provide them.
- Action Facts carry authored configuration/display data such as rank, range, target count, area, mana cost, base spell damage, or a proficiency reference. They do not automatically spend resources, target sheets, change rank, or unlock features.
- Facts provide data and display only. Actions and augmentations remain responsible for rolls, damage, resource changes, passive modifiers, and other behavior.

Fact and execution boundary:

- Backend lifecycle fields remain first-class item fields: interaction type, Fact profile, quantity/equipped relationship state, augmentation templates, and action grants. These are not Facts because backend availability and lifecycle behavior depend directly on them.
- Authored weapon data such as base damage, governing stat, proficiency reference, damage types, reach, and proficiency growth rate use required typed item Facts instead of bespoke weapon fields.
- Every action execution may read its evaluated Action Facts. Equipment-granted actions may also read evaluated source-item Facts and combine them with sheet variables through ordinary formulas and `calculate_value` steps. Stable aliases such as action mana cost, source-item base damage, governing-stat value, and proficiency modifier must reject missing or invalid subject relationships.
- Existing condition, standalone-effect, and equipment augmentation lifecycles remain the only passive modifier engines. Their formulas may read validated owner Item/Action Facts and matched action Facts where the execution context provides them; do not add a separate learned-skill passive or rank-unlock effect engine.
- `calculate_value` is not replaced by Facts. Facts persist authored configuration; `calculate_value` results are immutable, ephemeral values evaluated once during one action execution, including dice results and calculations based on current state. They may feed later message, damage, or mutation steps in that action but must not be persisted back into any Fact or subject definition.
- Range, target count, area, and similar Action Facts are display/manual play data unless a specific authored action step consumes them. Their presence does not add targeting, positioning, or multi-sheet automation.

### Derived Values

Base values and explicit overrides should be persisted. Derived values should be computed by the backend from authoritative formulas, then may be cached/persisted in snapshots for display and sync. Cached derived values are not directly editable and must be recalculated when dependencies change. GM overrides are stored separately and marked as overrides.

Formula-backed named derived values should use Facts instead of adding one-off fields to the fixed sheet schema. System calculations that are not ordinary authored formulas may remain dedicated backend-derived projections.

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
- Carry ordered semantic tags normalized by trimming/collapsing whitespace, case-folding, and removing duplicates; legacy formulas default to no tags.
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
- Runtime parameters are allowed for predefined GM-configured options. Actions explicitly choose `none`, `check`, or `damage` mode behavior: checks allow normal/advantage/disadvantage, damage allows normal/critical, and other actions allow normal only.
- Overload alternatives are later work.
- Advantage/disadvantage applies to hit/check rolls, not damage rolls. If both advantage and disadvantage apply, they cancel to a normal roll; multiples do not stack.
- Current-value changes such as resource costs, resource restores, and healing should be authored through generic bounded mutation steps or reusable action presets, not one hardcoded action step type per resource/stat.
- Damage is not a raw current-value decrement preset; it should use a semantic damage action step that evaluates an authored damage formula, validates damage type, applies target resistance, and then mutates current health.
- Healing is a separate semantic healing model or bounded HP mutation pattern, not negative damage; resistance does not affect healing unless a specific effect says so.
- Damage/resistance work should land in order: shared formula evaluator, resistance state/metadata, then the semantic damage action step.
- Weapon/spell-specific damage composition remains later resolver work; hit and damage stay independent authored actions. Authored Roll20 damage actions already support explicit critical mode after formula and augmentation composition.
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

- Dodge and Block are ordinary default sheet actions. Their Roll20 formulas are `FLOOR(Dexterity * (d100 / 100))` and `FLOOR(Strength * (d100 / 100))` respectively.
- Weapon Attack, Weapon Damage, weapon Parry, and weapon Contest are ordinary backend-seeded action definitions available for equippable items to grant. They are not automatically attached to every sheet because their proficiency and governing values come from the explicit source equipment relationship.
- The spreadsheet Weapon Parry default intentionally uses `Weapon Proficiency * (d100 / 100) * Dexterity`. This differs from the prose Parry rule's `(1 + Chosen Proficiency) * (d100 / 100) * Weapon Governing Stat`; the seeded spreadsheet action remains an editable authored default rather than replacing the prose rule globally.
- Spell To-Hit and Spell Damage are separate authored presets. The spreadsheet formula labeled `Spell Attack` includes Base Spell Damage and is therefore represented as Spell Damage; the independent Spell To-Hit preset omits Base Spell Damage.
- Default/preset actions remain editable authored actions rather than hardcoded runtime commands. Backend execution still emits Roll20 formulas and does not perform cross-sheet hit/defense resolution.
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
- Future proficiency thresholds may unlock higher-ranked spells, skills, weapons, or authored modifiers, but MVP does not automatically mutate an Action `rank` Fact or hide/reveal features as proficiency changes.
- Until concrete thresholds and unlock behavior are supplied, proficiency-improvement notes such as lower mana cost, more healing, range, or secondary features remain GM-managed/RP data. A later unlock model must use explicit thresholds and explicit `all`/AND or `any`/OR grouping rather than inferred behavior.
- Players cannot manually edit proficiency; GM can manually correct/edit.
- DM-authored global proficiency definitions are the registry of available proficiencies.
- Sheet proficiency bridges are per-sheet progress records that point at a global proficiency definition.
- Strict mode for MVP: sheets/actions must reference existing proficiency definitions and existing sheet bridges; missing links should return clear backend errors rather than silently creating progress.
- Action authoring should make proficiency gains feel self-feeding: an action can declare which proficiency/proficiencies it trains, and multiple actions can feed the same proficiency.

Equipment and items:

- Equipment is an inventory-list model, not a slot-based layout for MVP. Each equippable inventory relationship may independently be equipped or unequipped.
- Every MVP item has exactly one backend-authoritative interaction type: `equippable`, `consumable`, or `inventory_only`. Hybrid interaction types are outside MVP.
- `equippable` items may be worn/unworn, grant equipped-only actions, and apply reversible wearer augmentations while equipped and quantity is positive.
- `consumable` items are used through carried item actions, consume a positive configured quantity only after successful execution, and may produce immediate resource/state effects or apply temporary conditions/augmentations through normal authored action steps.
- `inventory_only` items represent currency, materials, keys, quest objects, and similar records. They retain quantity and reference/GM metadata but cannot be equipped, used, grant actions, or apply mechanical effects.
- Reuse existing primitives for every item type: actions are triggers/ordered orchestration, augmentations are mechanical modifiers, and conditions are named status records that bundle augmentations. Do not add separate item-effect, consumable-effect, or equipment-modifier engines.
- Equippable wearer effects are item-owned augmentation templates tied directly to equip/unequip lifecycle. Ordinary equipment bonuses should not be wrapped in conditions merely to gain lifecycle behavior.
- Consumables contain no standalone effect payload beyond their granted action references and consumption metadata. Immediate effects are normal action mutation/damage/healing steps; temporary named statuses use `apply_condition_preset`, while non-status mechanical modifiers use `apply_augmentation`.
- MVP has no global active-weapon selection and no equipped-item count, slot, hand, one-handed/two-handed, or weapon-combination restrictions. Trust players to equip any number of equippable items; those restrictions and effects that change equip capacity remain later rules.
- Item definitions store interaction type, Fact profile, category/type label, rank, and reference description as first-class fields instead of packing mechanical-looking labels into one description string.
- Item action grants define whether an action is available while carried or only while equipped and how much authoritative quantity a successful execution consumes.
- Quantity zero represents a depleted stack: carried/equipped actions and item effects are unavailable, but the bridge remains until explicitly removed.
- Evaluation-time numeric and roll-mode augmentation templates apply automatically from equipped items when their selectors match.
- Direct wearer stat/resistance/resource effects require a backend-owned equip/unequip lifecycle with stable source identity and deterministic recomputation from authored base state; repeated equip, reconnect, template edits, quantity changes, and removal must not double-apply or drift values.
- Direct item effects must be reversible when unequipped or removed. Unsupported irreversible operations, including unsafe `set` removal semantics, must be rejected at authoring/validation time unless the backend stores enough prior/base state to restore deterministically.
- An item-granted action carries its source item relationship when the backend needs to identify which equipped item supplied it. Reusable attacks that require a specific item must receive an explicit source relationship rather than reading a global active weapon.
- Items using the backend-owned `weapon` Fact profile require typed item Facts for weapon type, base damage, governing stat, one or more physical damage types, reach, proficiency reference, and proficiency growth rate.
- Optional weapon properties such as stat bonuses, traits, prerequisites, and tags may use optional item Facts; attached skills/actions remain action grants, mechanical wearer effects remain augmentation templates, and prose remains description/notes.
- Campaign-specific item data such as a Fire attribute, mana efficiency, flat effect bonus, or mana-regeneration modifier should use optional typed item Facts. A Fact records the value; an authored action or augmentation with explicit tags/selectors consumes it when the value has mechanical behavior.
- Weapon reach is stored/shown for Roll20/manual reference only and does not affect app-side mechanics, formulas, targeting, or positioning.
- Offhand, two-handed, thrown, ranged, and improvised weapon modes are represented as tags/reference metadata unless a future resolver requires first-class fields.
- Equipment mechanical effects should use generic augmentation templates wherever possible instead of bespoke per-equipment-type rules.
- Armor, shields, and other gear can provide resistance, penalties, advantage/disadvantage sources, or other modifiers through augmentations or authored actions unless a future core resolver requires a first-class field.
- Armor grants resistance rather than AC. Heavy armor must impose disadvantage on Dodge, ideally through a standard attached augmentation/template.
- Shields normally grant advantage on Block attempts, do not automatically increase AC or resistance, and may be required for some Block actions.
- Consumables are items and using one in battle costs an action point; action-point enforcement remains tied to the later turn/action-pool implementation, while successful-use quantity consumption is MVP.
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
- carry source metadata such as item, action, spell, condition, or other origin, including the concrete source relationship/application identity needed to distinguish repeated or duplicate sources
- carry backend-owned lifecycle ownership that distinguishes source-managed equipment and condition effects from action-controlled standalone applications
- indicate base-sheet or instance scope
- target validated backend-owned paths or references
- carry formula/effect payloads that the backend can evaluate or apply authoritatively
- support item buffs, poison/status effects, gear/weapon effects, and future conditional effects
- keep application, removal, stacking, and recomputation backend-authoritative
- change effects only through their owning lifecycle: equip/unequip or detach for equipment, whole-condition removal for condition effects, and the corresponding backend-approved action for standalone applications

An augmentation is not inherently permanent or temporary. It is the generic mechanical effect record; its owner determines its lifecycle. Equipment effects last while their source relationship is equipped, condition effects last until that applied condition is removed, and action-applied standalone effects remain until an approved action removes them. MVP leaves duration/expiry manual because turn counting is out of scope. Duration, expiry, and removal-condition fields are descriptive lifecycle notes only; they are not executable predicates, formulas, raw paths, or scripts. Future conditional augmentation logic requires a validated backend-owned condition/effect expression model before any automatic lifecycle evaluation. Ally/other-sheet effects are future-only and must not introduce intersheet action execution or cross-sheet automation.

The UI calls reusable non-condition records `Standalone effects` or `Action-controlled effects`. They are applied or removed through approved actions; there is no global direct-manual effect workflow.

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
    - The former mock `submit_roll` path only emitted a snapshot acknowledgement while presenting itself as an app roll flow, despite the MVP boundary that one-off dice rolls belong in Roll20.
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
- [x] Add manual typed damage intake for an affected instance.
  - `apply_instanced_sheet_damage` accepts raw amount plus canonical damage type, applies template and instance resistance with one final floor, clamps health at zero, and emits an authoritative patch.
  - Players may submit damage only to their assigned instance; DMs may submit it to any instance.
  - Backend route, permission, generated-contract, resistance/floor, and health-patch behavior are covered; frontend request routing distinguishes typed damage from healing and mana edits.
- [ ] Extend damage resolution later for weapon/spell-specific damage composition and defense-derived reductions.
  - Critical damage order is defined: calculate damage, double total damage for qualifying natural 100 outcomes, then apply defense-based reductions and resistance.
  - Physical and spell attacks roll hit and damage separately; advantage/disadvantage affects hit/check rolls only, not damage.
- [ ] Implement weapon resolver inputs and augmentation-derived attack modifiers on the backend when attack support is added.
  - Required weapon resolver fields: weapon type, base damage, governing stat, damage type(s), reach, proficiency reference, and proficiency growth rate.
  - Reach remains stored/displayed reference metadata unless a specific future resolver rule needs it.
- [x] Implement action execution against explicit sheet/instance IDs.
- [x] Do not implement backend roll resolution for default `attack`, `dodge`, `parry`, and `block` presets.
  - Decision: these remain editable authored actions that emit Roll20 chat roll commands through normal `perform_action`; backend-authoritative dice/combat roll resolution is out of scope.
- [x] Implement advantage/disadvantage as predefined runtime action parameters.
  - Check-mode actions accept `normal`, `advantage`, or `disadvantage`, defaulting to normal for existing callers.
  - Quick Actions and assigned sheet Actions expose action-specific segmented controls and submit the generated backend contract.
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
- [x] Replace frontend-local stat override behavior with backend-authoritative stat requests: GM core base stat edits submit `set_sheet_base_stat`, formula/substat edits stay read-only here, and the unused manual level-up override UI was removed.
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
  - The runtime mock backend and its mock-only action behavior were removed in Phase 9 Slice 1.
- [x] Remove websocket-to-mock fallback and runtime mock selection.
  - Removed silent websocket-to-mock fallback from `ManagedGameClient`; failed websocket connects now remain disconnected with an error.
  - The application runtime now constructs only `WebSocketGameTransport`; tests use injected inert transports without domain state.
  - Added focused frontend coverage for websocket failure and reconnect behavior.
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
    - Covered by frontend reconciliation tests today: protocol snapshot/patch projection (`eventAdapters.test.ts`, `SocketProtocolClient.test.ts`), reducer snapshot hydration for primary roots (`syncReducer.test.ts`), item CRUD patches, formula CRUD patches, action CRUD patches, encounter preset patches, sheet item bridge add/equipment projection, current instance resource patches, base stat patches, forced resync overwrite, Roll20 bridge status events, and sheet access claim events.
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

- [x] Complete the remaining frontend fake-authority cleanup through the slices below.
  - Removed the legacy frontend-only `ClientIntent` path so app transports now submit only generated/backend-owned protocol requests.
  - Removed the runtime mock backend, mock-era presentation state, misleading scaffold UI, and stale generated build outputs.
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
  - The audit identified the explicit mock transport and its mock-only projection model; Slice 1 removed the transport, leaving presentation cleanup in Slice 2.
- [x] Slice 1: remove the runtime mock backend.
  - Deleted `MockGameTransport`, its mutable seeded snapshot behavior, and its mock-only test suite.
  - Removed `VITE_TRANSPORT`, transport mode unions, runtime mode selection, and the redundant transport badge/state.
  - Managed-client tests remain isolated with injected non-authoritative request/event fakes.
  - Verified with 224 frontend tests, ESLint, and the production TypeScript/Vite build.
- [x] Slice 2: remove mock-only sheet presentation state.
  - Deleted `sheetPresentation` and `persistentSheetPresentation` from frontend snapshots, normalized server state, selectors, domain models, and transport tests.
  - Template kind now derives from backend `dm_only`; names, notes, and resources come only from authoritative `Sheet` and `PersistentSheet` records.
  - Removed mock-only tags, names, timestamps, fallback logic, and the dead presentation conversion helper.
  - Verified with 224 frontend tests, ESLint, and the production TypeScript/Vite build.
- [x] Slice 3: remove misleading gameplay and scaffold UI.
  - Replaced the placeholder health damage-type selector with canonical backend damage types and wired negative health modifiers through `apply_instanced_sheet_damage`; positive health and mana modifiers continue through direct resource adjustment.
  - Removed visible developer TODO/scaffold copy from template and item authoring screens without removing either authoring workflow.
  - Corrected template search copy to name-only until backend-owned tags exist.
  - Verified with 255 frontend tests, ESLint, and the production TypeScript/Vite build.
- [x] Slice 4: finish the dead-code pass and verify the boundary.
  - Removed the stale presentation-era test label and tracked `vite.config.js`/`vite.config.d.ts` compiler outputs; node-config emissions now stay under ignored `.vite/`.
  - Found no remaining mock/presentation authority symbols, orphaned production modules, visible TODO/scaffold text, or frontend-owned domain mutations. The remaining legacy item-description reference is tested backward compatibility.
  - Verified backend-owned state enters reducers only through authentication events and projected snapshots/patches.
  - Verified with 255 frontend tests, ESLint, and the production TypeScript/Vite build.

### Phase 10: Verification And Hardening

- [x] Make backend test discovery independent of the invocation directory.
  - Root pytest configuration establishes the repository import path and backend test path, so the complete suite can run from either the repository root or `backend/`.
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
- [x] Frontend tests cover wrapper parsing, reconnect/resync, state patch reconciliation, optimistic overwrite, reducer behavior, and core sheet interactions.
  - Socket protocol/event-adapter tests cover parsing, invalid payloads, snapshots, and patches.
  - Managed-client tests cover reconnect/backoff, re-authentication, deliberate disconnect, and version-gap resync.
  - Sync reducer tests cover backend-authoritative snapshots/patches, forced-snapshot overwrite, resources, notes, equipment, stats, and migrated entity families.
  - Reducer, managed-client, sheet selector, quick-action, and request/editor-value suites cover local lifecycle behavior and core sheet workflows.
  - The complete frontend set passes: 32 files and 224 tests; TypeScript build and ESLint also pass.
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
- GM can create/edit/delete optional Fact definitions and attach/detach them from sheets, items, and actions allowed by the definition's subject type.
- Every sheet and profiled item contains its backend-required Facts; required Facts cannot be deleted or detached, and editable values/formulas can be reset to backend defaults.
- GM and permitted players can view backend-evaluated attached Facts on character sheets, item displays, and available action displays without the frontend calculating or directly editing derived results.
- Sheet users can see the active conditions they are permitted to view; the GM can explicitly remove an applied condition from that sheet without deleting its reusable preset.
- GM can create and edit each supported item interaction type in one coherent workflow: equippable wearer effects/actions, consumable immediate/temporary use effects, or inventory-only reference records.
- GM can assign an item Fact profile and edit its required/optional typed Facts in Item Maker; source-item actions can consume validated item Fact values authoritatively.
- GM can attach typed Action Facts in Action Authoring; action steps and existing modifier engines can consume validated current-action/source-item Facts without replacing execution-local calculated values.
- GM can attach inventory, change quantity, and independently equip or unequip any number of equippable items through backend-authoritative requests.
- Carried/equipped item actions and quantity consumption are enforced by the backend, and equipped roll/formula modifiers affect only matching actions.
- Direct wearer effects apply and reverse deterministically on equip/unequip without corrupting authored base stats or duplicating effects.
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
- [x] Add active-condition management to the character sheet.
  - Added persisted `ActiveCondition` application records with schema-v5 migration, stable application IDs, preset/source metadata, visibility, target instance, and owned concrete augmentation IDs.
  - Condition application is idempotent per preset/instance, supports conditions with no augmentation templates, and preserves condition ownership on every generated augmentation. Generic augmentation removal continues to reject condition-managed children.
  - Added DM-only typed `remove_active_condition`; removal reverses and deletes all owned concrete effects and bridges while preserving the reusable preset. Players can only remove conditions through an assigned backend action using the condition step's remove operation.
  - State snapshots and patches now expose public conditions only to the assigned player and expose `gm_only` conditions only to the GM, including visibility changes and reconnect reconciliation.
  - Added a Conditions tab to the authoritative instance-sheet view. It groups effects by condition application and gives only the GM a Remove command.
  - Preset deletion is rejected while applications remain; preset edits propagate display metadata and visibility to active applications.
  - Covered duplicate and zero-effect applications, visibility and assignment filtering, permissions, cleanup, migration, snapshot/patch reconciliation, preset preservation, and action-driven application. Repository verification passes: 390 backend tests, 270 frontend tests, frontend lint, and production build.
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
    - Action step editing now supports safe message, calculation, instance-resource increment, damage, and proficiency steps; other raw mutation/path step editing remains deferred until validated picker UX exists.
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
- [x] Wire current HP/mana resource adjustment and GM core base stat edits to backend-authoritative requests; formula/substat editing remains read-only here, and unused manual level-up drafts were removed.
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
    - Frontend-local roll submission no longer exists or creates local roll history entries.
- [x] Fix frontend lint errors and warnings so `npm run lint` passes with `--max-warnings 0`.
  - Removed unused frontend imports/variables and explicit `any` in websocket tests.
  - Split fast-refresh-sensitive hooks/constants out of component files.
  - `npm run lint` now passes with `--max-warnings 0`.
- [x] Add tests for reducer, transport event handling, and core sheet interactions.
  - Existing reducer tests cover intent, UI, and authoritative sync reducers.
  - Existing transport tests cover websocket parsing/adaptation, socket client behavior, managed client behavior through injected inert transports, and request builders.
  - Added dedicated sheet selector tests for template/instance view projection, active sheet detail, current resource display, equipment bridge lookup, active weapon labels, available items, and player instance filtering.

### Frontend Backend-Access Gaps

- [x] Add GM sheet-access management UI that consumes `sheet_access_codes`, lists active codes, and supports generating/replacing a code for a selected player instance.
  - The GM panel automatically loads the private code list, offers authoritative player instances only, shows the current active code for the selection, and submits the existing typed generation request with the matching template and instance IDs.
  - Generating for an instance now rotates its code: the backend creates a unique replacement, deactivates prior active codes for that instance, preserves unrelated/template-only codes, persists privately, and returns the complete private list without broadcasting codes in public state.
  - Existing list/copy and manual refresh controls remain available. Verified with 361 backend tests, 244 frontend tests, ESLint, and the production TypeScript/Vite build.
- [x] Add GM action assignment controls to the active sheet Actions tab using sheet action bridge create/update/delete routes.
  - The GM Actions tab can attach unassigned authoritative global actions with generated stable relationship IDs, replace an explicit assignment without changing its relationship ID, and remove explicit bridges through the existing typed requests.
  - Add/replacement options prevent duplicate explicit assignments while still allowing an item-granted action to be assigned explicitly. Item-granted entries remain inventory-owned and therefore are not editable from action assignment controls.
  - Player mode remains execution-only. Focused selector/payload tests cover ordered options, explicit-vs-item ownership, and stable replacement IDs. Verified with 361 backend tests, 247 frontend tests, ESLint, and the production TypeScript/Vite build.
- [x] Complete sheet definition editing for backend formula stats and resistance values.
  - The GM Stats tab now edits every backend formula stat with formula text, normalized tags, and metadata-driven sheet-variable aliases. Alias paths are stored relative to the sheet root, and the backend rejects unsupported instance paths and direct self-references.
  - Added the typed, DM-only `set_sheet_resistances` route so total, category, and specific resistance values are validated as fractional values and replaced atomically. The UI presents these values as percentages and converts them at the request boundary.
  - Verified with 364 backend tests, 250 frontend tests, ESLint, protocol code generation, and the production TypeScript/Vite build.
- [x] Make global formula definitions reusable from action-step authoring through stable formula ID selection/reference rather than leaving Formula Authoring as an isolated CRUD catalog.
  - Added a persisted `formula_reference` value source for message, calculation, numeric mutation, damage, proficiency-use, and bound formulas while preserving inline formulas and action-local calculated-value references.
  - Action creation/update validates referenced IDs, runtime resolution always reads the current global definition, and evaluation contexts retain the global formula ID for selector matching. Referenced formulas can be updated but cannot be deleted until dependent actions are changed.
  - Action Authoring now offers inline/global/calculated source selection where applicable and clearly identifies the selected global formula. Verified with 368 backend tests, 251 frontend tests, ESLint, protocol code generation, and the production TypeScript/Vite build.
- [x] Complete Action Authoring controls for backend-supported `set_value`, `increment_value`, `decrement_value`, `apply_augmentation`, and `apply_condition_preset` steps.
  - Set/increment/decrement steps share a metadata-backed instance mutation-path editor with inline/global/calculated primary values, optional minimum and maximum formulas, and independent clamp/reject behavior. No unrestricted mutation-path input is exposed.
  - Runtime augmentation records are now preserved in authoritative frontend state so augmentation and condition steps use record selectors plus apply/remove controls instead of raw IDs. The backend validates record existence and instance-target compatibility, and condition presets referenced by actions cannot be deleted.
  - Verified with 371 backend tests, 253 frontend tests, ESLint, protocol code generation, and the production TypeScript/Vite build.
- [x] Add template deletion controls to Template Library using the existing typed `delete_sheet` route, with dependency errors surfaced through normal intent feedback.
  - GM template rows now offer a destructive confirmation before submitting the typed delete request. The frontend does not remove or close an edited template until the authoritative sheet-removal patch arrives; backend errors continue through standard intent feedback.
  - The backend rejects deletion while any live instances or encounter presets reference the template and returns the complete blocking IDs in one deterministic error.
  - Verified with 372 backend tests, 254 frontend tests, ESLint, and the production TypeScript/Vite build.
- [x] Add encounter preset edit and delete controls using stable encounter IDs plus the existing save/delete routes.
  - Saved encounter rows now support editing names and roster entries while resubmitting the original encounter ID through `save_encounter_preset`; backend coverage verifies the existing record is replaced rather than duplicated.
  - Deletion requires explicit confirmation and uses `delete_encounter_preset`. Lists remain backend-authoritative, and an open editor is cleared only when its preset disappears in an authoritative patch or the user explicitly saves/cancels.
  - Verified with 373 backend tests, 255 frontend tests, ESLint, and the production TypeScript/Vite build.
- [x] Add equipment quantity editing through sheet item bridge updates instead of limiting inventory changes to add-one, active toggle, and remove.
  - The GM Equipment tab now provides a stable minus/count/plus stepper for each attached item and submits the existing typed `update_sheet_item_bridge` request.
  - Quantity updates preserve bridge identity, item reference, and active state; zero is a valid depleted quantity, while removal remains a separate explicit command.
  - Invalid negative, fractional, infinite, and unsafe-integer quantities are rejected before request submission.
  - Added focused payload coverage. Verified with 261 frontend tests, ESLint, the production TypeScript/Vite build, and 10 backend item-bridge contract tests.

### MVP Item And Equipment Completion

This is the next MVP implementation track and must be completed before work in `Later`.

- [x] Backend slice 1: add and enforce the three MVP item interaction types.
  - Added required `interaction_type` values `equippable`, `consumable`, and `inventory_only`, plus first-class category and rank fields; `description` remains the plain reference description.
  - Enforced cross-type authoring rules: inventory-only items reject actions/augmentations, consumables require a positive-quantity carried action and reject item augmentations/equipped actions, and only equippable items may receive augmentation templates or be equipped.
  - Replaced item-bridge `active` with independent `equipped` state throughout backend runtime, snapshots, requests, generated protocol compatibility, and frontend consumers. Multiple positive-quantity equippable relationships may remain equipped; no global active weapon exists.
  - Depleting an equipped item through action consumption now atomically clears its equipped state. Inventory-only records are excluded from runtime and frontend action resolution even if malformed persisted data bypasses authoring validation.
  - Added persisted-state schema v2 migration. It maps legacy active bridges to equipped, extracts packed Type/Rank metadata, preserves legacy effect text, infers interaction type from structural mechanics, and adds private GM review notes to ambiguous records.
  - Item updates cannot change an equipped item to a non-equippable type, and item deletion is rejected while any sheet relationship still references it.
  - Updated frontend contract compatibility and removed the legacy single-active-item selector/UI behavior; quantity zero also submits an unequipped bridge.
  - Verified with 379 backend tests, 261 frontend tests, ESLint, protocol generation, and the production TypeScript/Vite build.
- [x] Backend slice 2: complete equipped-item effect and action lifecycle semantics.
  - Reused the existing augmentation evaluator and action/condition paths; equipment now generates deterministic concrete augmentations with item, relationship, and application source identity.
  - Added backend-owned lifecycle metadata. Generic augmentation removal rejects equipment- and condition-managed effects, leaving their owning unequip, depletion, detach, template, or condition operation responsible for removal.
  - Matching roll/formula effects remain limited to equipped, positive-quantity equippable relationships. Consumable and inventory-only records cannot enter equipment effect resolution.
  - Added a private effective-value projection for direct sheet/instance effects. It preserves externally edited base values, deterministically recomputes stacked effects, and restores the current base without double application or inverse-operation drift.
  - Equipment effects synchronize after authoritative mutations, before action execution, on startup, and during backup import, covering equipment, quantity, item/template, attachment, and sheet/instance changes with rollback on invalid formulas.
  - Preserved source-item action disambiguation, successful consumable quantity use, zero-quantity disabling, and unrestricted multiple equipped items.
  - Verified with 382 backend tests, 261 frontend tests, protocol generation, ESLint, and the production TypeScript/Vite build.
- [x] Frontend slice 1: replace the misleading Item Maker form with type-driven authoring.
  - Replaced the `Immediate Effects` and `Non-Immediate Effects` textareas with one plain reference description. Persisted-state schema v4 migrates packed descriptions into clearly marked legacy-reference text before they reach the frontend.
  - Added an explicit Equippable, Consumable, and Inventory Only segmented mode control with backend-valid type-specific payload conversion and validation.
  - Equippable mode now exposes Details, grouped Wearer Effects and Roll / Formula Effects, and Equipped Actions. It uses the existing augmentation evaluator contract and action definitions.
  - Consumable mode exposes Use Actions with authoritative quantity consumption and a direct route to normal Action Authoring; it does not duplicate action-step or condition controls.
  - Inventory Only mode renders reference details without effect, use-action, or hidden mechanical-property controls and strips those mechanics from submitted definitions.
  - Augmentation templates are held in the editor draft and included in the initial create request, eliminating the save/reselect workflow. Existing items submit the complete authoritative definition on update.
  - Item summaries distinguish direct wearer effects, roll/formula effects, equipped/use actions, and named conditions reached through those actions.
  - Verified with 264 frontend tests, ESLint, and the production TypeScript/Vite build.
- [x] Frontend slice 2: complete inventory and equipment interaction.
  - The sheet now presents one Inventory & Equipment list with independent GM-only equip/unequip controls for every positive-quantity equippable relationship; it adds no slots, hand limits, or active-weapon selector.
  - Consumable and equippable action grants show their authored carried/equipped requirement, quantity consumed, and current availability. Eligible actions continue executing through the normal action list with source-item identity; depleted or otherwise ineligible grants remain visibly unavailable in inventory and are not executable.
  - Inventory-only records show quantity, carried/depleted state, value, weight, and reference description without equip, use-action, or effect controls.
  - Every inventory record shows interaction type, authoritative quantity, carried/equipped/depleted state, configured effect counts, and concrete active equipment effects where applicable.
  - Player inventory remains read-only under the backend's DM-only equipment permission, while both roles receive status changes exclusively from snapshots and patches.
  - Added pure authoritative display projections plus reconciliation coverage for bridge creation, quantity/equip changes, and concrete equipment-effect add/remove patches.
  - Verified with 267 frontend tests, ESLint, and the production TypeScript/Vite build.
- [x] Item/equipment completion verification.
  - Regenerated protocol output with no contract drift and completed migration, backend contract/runtime, frontend request/reconciliation, authoring, and interaction coverage.
  - Added persisted-state schema v4 to normalize legacy packed item descriptions and item-template source/lifecycle ownership. Removed the obsolete frontend description parser and the final unused active-weapon quick-roll helpers.
  - Verified reload idempotence and backup import recovery for equipped direct effects, including concrete source identity, private base projection, and no double application. The import test now remains isolated from the repository checkpoint.
  - Verified with 383 backend tests, 267 frontend tests, protocol generation, ESLint, and the production TypeScript/Vite build.

Manual amount/type damage intake was pulled forward from the later hit/damage checklist and is now implemented through the sheet resource editor.

### Active TODO
- [ ] Add typed Facts for sheets, items, and actions with backend-required defaults.
  - [x] Deliver the first end-to-end required sheet-Fact slice with `amount_of_reactions`.
    - Added persisted typed Fact definitions/values and sheet-Fact bridges, schema-v7 initialization/backfill, and backend restoration of the reserved required definition/bridge on load and sheet creation.
    - The backend evaluates `@registration + @reaction_time`, stores the authoritative evaluated value or explicit evaluation error, and refreshes affected Fact projections after sheet-stat mutations, equipment projection changes, imports, and undo.
    - Added DM-only typed set/reset routes with generated protocol/request helpers. Required metadata/defaults remain backend-owned, players cannot edit, and public/GM-only Fact visibility participates in snapshot/patch redaction.
    - Added frontend authoritative Fact reconciliation and a character-sheet Facts section. Both roles see the evaluated value; GMs can edit the required formula text while preserving validated aliases or reset it to the backend default.
    - Covered required seeding, migration, evaluation, dependency refresh, permission enforcement, reset behavior, protocol generation, request construction, snapshot reconciliation, and role-specific rendering.
    - Verified with 387 backend tests, 301 frontend tests, frontend lint, protocol generation, changed-file formatting, and the production TypeScript/Vite build.
  - [x] Deliver optional Fact definitions and sheet/item/action assignment.
    - Added DM-only optional Fact definition create/update/delete and subject attach/set/reset/detach routes, stable bridges on sheets, items, and actions, generated protocol/request helpers, and backend preservation of item/action Facts when their definitions are edited.
    - Added typed literal/formula, boolean, text, validated enum, validated reference, and validated list values. Constrained types require allowed values; references also require a reference kind; definition edits reject incompatible live bridges.
    - Added subject-relative Fact dependencies and explicit cycle/evaluation errors, authoritative evaluated values, schema/load/import support, and public/GM-only snapshot and patch redaction. Visibility changes now remove or republish every affected subject bridge for connected players.
    - Added a GM Fact Builder with subject scope, defaults, formula aliases, units, validation metadata, and visibility. Added optional Fact assignment/edit/reset/detach to the character-sheet view and persisted Item Maker and Action Authoring records.
    - Added frontend authoritative reconciliation plus constrained-value editors; the frontend never evaluates Fact formulas.
    - Verified with 393 backend tests, 303 frontend tests, frontend lint, protocol generation, changed-file formatting, and the production TypeScript/Vite build.
  - [x] Deliver the backend-owned weapon Item Fact profile.
    - Added reserved required weapon Facts for weapon type, base damage, governing stat, physical damage types, reach, proficiency definition reference, and proficiency growth rate. Required definitions expose their `weapon` profile scope and cannot be renamed, deleted, or detached.
    - Added a first-class item `fact_profile` plus complete Fact bridges to item create/update payloads. The backend restores stable required bridges, rejects incompatible profile/interaction combinations, validates nonnegative numeric weapon values and physical damage choices, and resolves proficiency references against authoritative proficiency definitions.
    - Added schema-v8 initialization for the reserved definitions and explicit `fact_profile: null` on existing items without inferring profiles from prototype data. Proficiency deletion now rejects live Fact references.
    - Item Maker now selects the backend-declared profile, authors required and optional Facts during initial creation or editing, validates required values before submission, and sends the item plus bridges atomically. It no longer requires creating the item and attaching Facts afterward.
    - Added read-only item Facts to GM item records and shared GM/player equipment displays, with backend-evaluated values and visibility redaction preserved.
    - Verified with 397 backend tests, 305 frontend tests, frontend lint, protocol generation, changed-file formatting, and the production TypeScript/Vite build.
  - [x] Deliver canonical Action Facts and reusable Fact presets.
    - Added backend-owned optional Action Fact definitions for rank, range, target count, area, mana cost, base spell damage, and proficiency reference. They remain optional configuration and cannot be edited or deleted from the global Fact catalog.
    - Added schema-v9 initialization plus complete Action Fact bridges in create/update payloads. The backend validates subject compatibility, stable bridge identity, constrained ranks, nonnegative range/cost/damage, positive whole target counts, and authoritative proficiency references.
    - Added backend Action Fact preset metadata for `General Action Details` and `Spell Details`. Presets attach default Fact bridges only and explicitly do not execute resource, targeting, or damage behavior.
    - Action Authoring now applies Fact presets, attaches optional Facts, edits/reset/detaches values before initial creation, validates references before submission, and saves the Action plus Facts atomically instead of requiring post-create attachment.
    - Added read-only Action Facts to GM Action records and shared GM/player available-action cards. Backend-owned optional definitions display as locked Preset records in Fact Builder.
    - Moved shared Fact protocol payloads into the Facts feature so state, item, and action contracts use one generated schema without circular dependencies.
    - Verified with 400 backend tests, 307 frontend tests, frontend lint, protocol generation, changed-file formatting, and the production TypeScript/Vite build.
  - [x] Deliver Action/source-item Facts in action formula execution.
    - Extended backend-provided formula metadata and generated protocol roots with read-only `action` and `source_item` variables. Numeric Action/Item Fact definitions are exposed dynamically, including stable shortcuts for mana cost, base spell damage, weapon base damage, weapon governing-stat value, and action/weapon proficiency modifiers.
    - Fixed the existing picker/runtime mismatch by accepting both explicit rooted authoring paths and established subject-relative paths. Runtime formula contexts now expose explicit `sheet`, `instance`, current-Action, and eligible source-item projections without widening action mutation paths.
    - Action create/update rejects current-Action Fact aliases when the required Fact is not attached, including referenced global formulas. Runtime rejects missing, malformed, wrong-profile, nonnumeric, or failed Fact projections before applying mutations.
    - Source-item formula values require the `perform_action` request to provide an explicit relationship that passes the existing quantity/equipped/action-grant eligibility checks. Weapon projections resolve the selected governing core-stat value and the sheet's capped proficiency modifier from authoritative relationships.
    - Added backend metadata, rooted-path validation, action-authoring, invalid-Fact, explicit-source, wrong-profile, and resolved-weapon execution coverage plus frontend picker coverage. Verified with 404 backend tests, 308 frontend tests, frontend lint, protocol generation, and the production TypeScript/Vite build.
  - [x] Deliver executable spreadsheet action defaults and authoring presets.
    - Added one canonical backend preset catalog shared by state seeding and Action Authoring metadata. New sheets receive only Dexterity-based Dodge and Strength-based Block; generic Attack and Parry are no longer created or attached.
    - Seeded editable global Weapon Attack, Weapon Damage, Weapon Parry, and Weapon Contest definitions for Item Maker equipment grants. Their formulas consume only an explicit eligible source weapon, and hit, damage, defense, and contest remain independently invoked Roll20 actions.
    - Added separate Spell To-Hit and Spell Damage authoring presets. Applying either creates a normal editable draft, sets the correct roll-mode kind and semantic tags, and attaches the spell Action Facts that must be configured before saving.
    - Wired backend action-step presets into Action Authoring, exposed weapon definitions in Item Maker grants, and updated Quick Actions to resolve Weapon Attack/Parry through eligible item relationships while retaining sheet Dodge/Block.
    - Added schema-v10 canonical-data initialization that removes only untouched prototype generic Attack/Parry defaults and bridges, corrects untouched Dodge/Block definitions, seeds equipment actions, and preserves unrelated/customized records.
    - Added exact Roll20 expansion coverage for every supplied spreadsheet formula, equipment `calculate_value` reuse coverage, migration/default-bridge tests, Action preset/Fact draft tests, item-grant rendering, quick-action source tests, and standardized tag suggestions including `stealth`, `parry`, and `mana_regeneration`.
    - Verified with 408 backend tests, 311 frontend tests, frontend lint, protocol generation, and the production TypeScript/Vite build.
  - [x] Add persisted global `facts` definitions plus stable sheet-fact, item-fact, and action-fact bridges under the shared domain model, checkpoint schema, private/public serialization, export/import, and authoritative snapshot/patch state.
  - [x] Define typed Fact payloads for numeric/formula, boolean, text, validated enum, validated reference, and validated enum/reference list values. Fact definitions declare allowed subject types (`sheet`, `item`, `action`, or a combination), validation metadata, default payload, unit/display hint, and visibility; subject bridges carry subject-specific values or formula overrides.
  - [x] Add the backend-owned required-Fact registry and subject/profile rules. Seed/backfill `amount_of_reactions` on every sheet with default formula `@registration + @reaction_time`; reject required-definition deletion, reserved metadata changes, and required bridge detachment.
  - [x] Add a first-class item Fact profile selector and an initial backend-owned `weapon` profile. It requires item Facts for weapon type, base damage, governing stat, physical damage type(s), reach, proficiency definition reference, and proficiency growth rate without imposing them on non-weapons.
  - [x] Allow GM edits to permitted required-Fact values/formulas plus an explicit reset-to-default route; required status, profile membership, validation metadata, and default payload must never be accepted as client authority.
  - [x] Add DM-only typed Fact definition CRUD plus sheet-Fact, item-Fact, and action-Fact attach/update/detach routes through the request registry, including role checks, subject compatibility, reference validation, dependency errors, generated protocol types, and centralized frontend request helpers.
  - [ ] Extend formula authoring metadata and validation for Fact formulas, including sheet-relative aliases, item-relative Fact aliases, action-relative Fact aliases, missing-reference errors, cycle detection across formula stats/Facts, and explicit backend evaluation failures.
  - [x] Define authoritative evaluated-Fact projection and invalidation behavior so definition edits, subject assignment/value changes, sheet stat changes, item/action Fact changes, imports, and reconnects produce consistent snapshot/patch results without frontend calculation.
  - [ ] Build a GM Fact Builder for optional definition CRUD and required Fact editing/reset. Required records must show their subject/profile scope and a clear Required badge while omitting rename/delete controls.
    - [x] Optional definition CRUD, typed defaults, validation options, units, visibility, subject scope, manual relative formula aliases, and locked Required records are implemented. Moving required value editing/reset into this page remains open; it currently lives on each sheet.
  - [x] Add a Facts section to Template Builder for attaching optional definitions and displaying locked required assignments; create/update must submit stable bridges in the complete sheet payload.
    - Sheet create/update payloads now carry complete sheet Fact bridges. The backend validates sheet-compatible Fact definitions, values, and relationship identity, then restores/evaluates required sheet Facts authoritatively. Template Builder hydrates, edits, resets, detaches optional Facts, and preserves stable bridge IDs through full template saves.
  - [x] Add an Item Maker Facts section for selecting the Fact profile, editing required values, attaching optional item Facts, and showing validation errors before submission.
  - [x] Add an Action Authoring Facts section for rank, range, target count, area, mana cost, base spell damage, proficiency references, and other optional typed configuration without turning those values into executable behavior.
  - [x] Add read-only Facts sections to the shared GM/player character sheet, item displays, and available-action displays, respecting visibility and showing name, evaluated/typed value, unit, description, and a clear unavailable/error state when backend evaluation fails.
  - [x] Expose validated current-Action Facts to its action-step formulas and validated source-item Facts only through an eligible explicit source-item relationship. Reject aliases for missing, ineligible, wrong-profile, or invalid Fact data.
  - [x] Allow existing item augmentation formulas to read their owning Item Facts and matching evaluation-time modifiers to read validated matched-Action Facts. Preserve existing equipment, condition, and standalone-effect lifecycle ownership; do not add a skill-passive lifecycle or automatic rank/feature unlock engine.
    - Added shared built-formula alias path validation and item-context validation for item augmentation formulas. Direct wearer effects can read validated owning `source_item.facts.*` values and reject action-context aliases; evaluation-time item modifiers can validate owning source-item Facts while matched Action Facts remain runtime-authoritative.
    - Runtime action evaluation now validates matched evaluation-formula modifiers against the same action/source-item formula context before applying them, producing explicit Fact/context errors for missing, invalid, or ineligible Action and Source Item Fact aliases.
    - Equipment direct-effect recomputation now exposes the owning item as `source_item.facts` without adding a new lifecycle engine, automatic rank unlocks, turn tracking, or cross-sheet execution.
    - Item Maker now loads the existing backend formula authoring metadata and reuses the variable picker for equipment-effect formulas. A case-only GM toolbar helper collision was renamed so the frontend production build remains portable.
    - Verified with 73 focused backend tests, focused frontend Vitest coverage, frontend ESLint, protocol generation, and the production TypeScript/Vite build.
  - [x] Keep `calculate_value` as the execution-local evaluation-once mechanism for dice and current-state calculations. Fact values are persistent authored inputs and must not be used as writable execution scratch space.
  - [ ] Add checkpoint migration/backfill, backend CRUD/permission/type/evaluation/required-invariant tests, protocol/codegen checks, and frontend authoring/assignment/snapshot/patch/reconciliation tests for sheet, item, and action subjects.
  - [ ] Keep current reaction counts, turn resets, spending, and combat enforcement out of this track; the `amount_of_reactions` Fact is display-only until combat/turn tracking is implemented.
  - [ ] Keep range, target count, and area as display/manual Facts unless a specific action step consumes them; do not add targeting or cross-sheet execution.
- [x] Complete default action coverage for the supplied spreadsheet roll formulas on the typed item-Fact foundation.
  - [x] Replace the current placeholder defaults: keep Dodge as Dexterity-based, change Block from Constitution to Strength, and stop automatically attaching generic Attack and Parry actions to every sheet.
  - [x] Extend resolved action execution and formula context with evaluated current-Action Facts plus, when explicitly supplied, the source item bridge, source item definition, evaluated required weapon Facts, resolved governing-stat value, resolved sheet proficiency modifier, and base damage.
  - [x] Let equipment-granted actions use `calculate_value` for reusable intermediate attack/damage values while keeping those values execution-local and non-persistent.
  - [x] Seed editable equipment-grantable Weapon Attack, Weapon Damage, Weapon Parry, and Weapon Contest action definitions; expose them in Item Maker action grants without attaching them to sheets automatically.
  - [x] Represent Weapon Attack as `FLOOR((1 + Weapon Proficiency) * (d100 / 100) * Weapon Governing Stat)`.
  - [x] Represent Weapon Damage as `FLOOR(Weapon Base Damage + (1 + Weapon Proficiency) * (d100 / 100) * Weapon Governing Stat)` and keep it separate from the to-hit action.
  - [x] Represent the supplied Weapon Parry attempt as `FLOOR(Weapon Proficiency * (d100 / 100) * Dexterity)` and Weapon Contest as `FLOOR(Weapon Proficiency * (d100 / 100) * Weapon Governing Stat)`. Record that these spreadsheet defaults intentionally differ from the current prose Parry rule, which uses `(1 + proficiency)` and the weapon governing stat, and update the active rules text when the default is implemented.
  - [x] Represent Dodge as `FLOOR(Dexterity * (d100 / 100))` and Block as `FLOOR(Strength * (d100 / 100))`; keep advantage/disadvantage transformation on the standalone `1d100` term.
  - [x] Add separate editable Spell To-Hit and Spell Damage presets. Spell To-Hit is `FLOOR((1 + Spell Proficiency) * (d100 / 100) * Arcane)`; Spell Damage preserves the spreadsheet expression as `FLOOR((1 + Spell Proficiency) * (d100 / 100) * Arcane + Base Spell Damage)`.
  - [x] Add action-authoring support for attaching validated proficiency-reference and base-spell-damage Action Facts when instantiating spell presets; do not hide spell-specific values in freeform notes.
    - [x] The backend-provided `Spell Details` Fact preset attaches validated proficiency, mana-cost, and base-spell-damage bridges during initial Action authoring. Executable Spell To-Hit/Damage step presets remain open until Action Facts enter formula context.
  - [x] Wire the backend-provided action preset templates into Action Authoring—the metadata exists today, but the frontend does not currently consume it—and add categories for weapon, defense, contest, spell to-hit, and spell damage.
    - [x] Backend Action Fact preset metadata is consumed by Action Authoring. Existing action-step preset templates and the weapon/defense/contest/spell executable categories remain open.
  - [x] Treat Stealth and other skill checks as ordinary authored actions using the existing skill-check formula shape. Standardize formula-tag suggestions such as `check`, `stealth`, `parry`, `damage`, `fire`, and `mana_regeneration` so existing augmentation selectors can match them; do not add a separate skill-check runtime engine.
  - [x] Keep hit, damage, and defense as independently invoked Roll20 actions. Do not add automatic targeting, contested-result comparison, hit-to-damage chaining, or cross-sheet mutation.
  - [x] Add backend default-seeding/source-validation/runtime-output tests and frontend preset/item-grant/quick-action tests proving every spreadsheet formula has an executable authored representation.
  - [x] Treat `NON LISTED = DND` as reference-only until a concrete calculation or fallback behavior is supplied; do not invent a generic D&D resolver.
- [ ] Seed canonical authoring data and prove the `dm_examples.md` examples through normal system primitives.
  - [ ] Move the standard substat default formulas into backend-provided authoring metadata and make new Template Builder drafts consume that metadata instead of owning a second frontend rules table.
  - [ ] Seed reusable optional sheet Fact definitions for `level`, `movement`, and `mana_regeneration`; mana regeneration remains informational/manual and does not add a time-advancement engine.
  - [x] Seed reusable optional Action Fact definitions for rank, range, target count, area, mana cost, base spell damage, and proficiency reference. These values remain display/manual unless an authored action formula or step consumes them.
  - [ ] Seed reusable optional item Fact definitions needed by the examples, including attribute, mana efficiency, flat effect bonus, and mana-regeneration modifier, alongside the backend-owned required weapon Fact definitions.
  - [ ] Add proficiency category metadata and seed the supplied weapon-family definitions: Long Swords, Short Swords, Spears, Shields, Pugilists, Staffs, Bows, Throwing, Knives, and Axes. Specific weapon names remain item records that reference the applicable proficiency rather than separate hardcoded resolvers.
  - [ ] Add same-source-item evaluation context/selector support for modifiers such as `+50 to effects applied to this sword`; category-wide effects such as Fire Shard's `+10` fire damage continue to use ordinary semantic tags.
  - [ ] Represent Parry advantage and Mana Manipulation bonuses with the existing roll-mode/numeric augmentation effects, selectors, and condition or standalone-effect application paths. Action Facts provide their authored values, but owning an action does not create a second automatic passive-effect lifecycle.
  - [ ] Build backend/frontend acceptance fixtures that author, persist, reload, display, equip, and execute the six supplied equipment examples and the Parry, Flames of Life, and Mana Manipulation actions using Facts, existing actions, and existing augmentation/condition/standalone-effect lifecycles. Keep these as fixtures/sample data rather than forcing campaign-specific records into every live state.
  - [ ] Verify the fixed Flames of Life example can reject insufficient mana and exchange `100` mana for `10` health through existing ordered bounded-mutation steps. Limb/injury restoration remains RP-only.
  - [ ] Keep weapon sharpness/dulling out of scope. Treat descriptive mana conductivity and unspecified proficiency improvements as displayed Facts/notes until concrete executable rules are supplied.
  - [ ] Do not add automatic rank progression, proficiency-threshold feature hiding, timed regeneration, range enforcement, target-count enforcement, positioning, or multi-sheet targeting in this track.
- [x] Seed new template drafts with the standard substat formula set.
  - New drafts start with authored formulas and sheet-relative aliases for lifting, carry weight, acrobatics, stamina, reaction time, health, endurance, pain tolerance, sight distance, intuition, registration, mana, control, sensitivity, charisma, mental fortitude, and courage.
  - Existing templates retain their authored formulas. `Amount of Reactions` is intentionally not a formula stat; it belongs to the planned required Facts model above.
  - Verified with 298 frontend tests, frontend lint, changed-file formatting, and the production build.
- [x] Overhaul Template Builder into the primary complete sheet-authoring workflow.
  - Replaced the metadata-only create form and inline library editor with one full-width create/edit workspace that does not depend on an active instance.
  - Added responsive tabs for Details, Stats, Resistances, Actions, Proficiencies, and Starting Inventory/Equipment, with `Player-controlled` and `GM-controlled` labels mapped to the existing shared sheet schema.
  - The frontend-local draft now contains all core values, every formula/substat and alias/tag, all resistance percentages, stable action/proficiency/item relationships, equipped state, and preserved slay records.
  - Formula editing reuses backend metadata and the searchable variable picker. Action, proficiency, and item assignment use the same searchable popover control without duplicating global definition authoring.
  - Create and update each send one complete typed `SheetDefinitionPayload`; existing template edits preserve sheet and relationship IDs. The builder remains pending until the authoritative request feedback resolves and only then returns to the library.
  - Added section error counts, a compact validation summary, and disabled invalid Save/Create commands for names, XP, core values, formulas, aliases, resistance ranges, missing/duplicate references, proficiency values, quantities, and equipped-item constraints.
  - Kept backend default-action attachment and item/equipment lifecycle behavior unchanged. No slot, hand-limit, active-weapon, gameplay-calculation, or backend contract was added.
  - Added draft hydration, complete payload, bridge preservation, control-mode, validation, local edit-selection, and rendered workflow tests. Verified with 288 frontend tests, ESLint, and the production TypeScript/Vite build.
- [x] Replace expanded variable-card browsers with a reusable searchable popover picker.
  - Added a generic typed search-popover control accepting stable IDs, labels, compact secondary metadata, keywords, disabled reasons, and a selection callback; variable token/path/alias behavior remains in a thin metadata adapter.
  - Results render as compact listbox rows in a body portal with a fixed 320px maximum height, internal scrolling, viewport-clamped width/position, above-anchor fallback, and resize/capture-scroll repositioning.
  - The picker opens from focus, click, or typing and closes after selection, on `Escape`, focus departure, or outside pointer interaction without treating its portal as outside content.
  - Added combobox/listbox/option semantics with expanded/controls/active-descendant state, disabled state, and visible active-row treatment.
  - Added `ArrowUp`, `ArrowDown`, `Home`, `End`, and `Enter` handling with disabled-option skipping and wraparound. Keyboard/pointer navigation shares one active index, and active rows use nearest-edge `scrollIntoView` as navigation moves through the popup.
  - Preserved backend metadata filtering, search across labels/paths/descriptions/shortcuts/types/tokens, inserted formula tokens, alias paths, and formula-versus-mutation availability.
  - Migrated Formula Authoring plus calculation, message, damage, proficiency, and bounded-mutation Action Authoring consumers. Deleted the expanded `VariablePathBrowser`; large pages no longer render every variable as a card with an Insert button.
  - The generic picker remains available for later large action, formula, proficiency, item, condition, and template selectors while small fixed sets continue using native controls.
  - Added focused filtering, compact option adaptation, disabled navigation, wraparound, viewport placement, and semantic rendering coverage. Verified with 284 frontend tests, frontend lint, and the production build.
- [x] Replace global single-target manual augmentations with authored standalone-effect definitions and per-instance applications.
  - [x] Backend definition/application foundation.
    - Added reusable `standalone_effects` definitions with no global applied state plus idempotent `standalone_effect_applications` keyed per definition and instance, carrying stable action/step source identity.
    - Added DM-only typed create/update/delete routes and generated frontend request contracts. Deletion rejects action references and active applications; updates authoritatively recompute active direct effects.
    - Action validation/runtime now resolves `apply_augmentation` steps strictly through standalone definitions. Action Authoring receives and selects only standalone definitions instead of equipment- or condition-managed concrete augmentations.
    - Direct-value applications share the existing private base/effective projection machinery with equipment, including `set`, multiple instances, definition updates, external base edits, independent removal, and reload-safe persistence. Evaluation-formula and roll-mode effects resolve from the acting instance's active applications.
    - Added schema-v6 initialization for standalone definitions and applications. The prototype does not preserve or convert hypothetical pre-production global-manual records.
    - Added role-redacted application snapshots/patches: DMs receive all applications and players receive only their assigned instance's applications. Definitions and applications now reconcile into dedicated frontend server-state collections.
    - Covered CRUD permissions/contracts, definition/application round trips, two-instance concurrency, idempotence, direct/evaluation/set behavior, source identity, projection recomputation, migration, action integration, and snapshot redaction. Verified with 401 backend tests, 289 frontend tests, frontend lint, protocol generation, and the production build.
  - [x] Build the DM Effect Authoring workflow on the new standalone definition CRUD, reusing the existing target, formula, selector, and lifecycle-note controls. Use `Standalone effect` or `Action-controlled effect` in GM-facing UI; keep `manual` internal only.
    - Added a dedicated GM `Effect Authoring` route backed only by the authoritative standalone-definition collections and typed create/update/delete requests.
    - Reused the existing augmentation target catalog, formula representation, searchable formula-variable picker, formula/roll selector editor, operation modes, and lifecycle-note fields. Runtime metadata is filtered to instance targets so the UI cannot submit sheet/global definitions rejected by the backend's strict action-controlled contract.
    - The editor supports direct instance values, matching formula values, and matching roll modes; normalized aliases/tags/selectors and stable IDs round-trip through the same effect model used by actions.
    - New definitions remain in the draft until their authoritative patch arrives and are then selected from server state. Authoritative removal clears an open editor, while rejected deletes remain visible and surface through normal request feedback.
    - Added explicit deletion confirmation noting action-reference and active-application constraints, compact authoritative definition summaries, active/disabled state, and a GM navigation entry without exposing legacy global-manual terminology.
    - Covered strict instance validation, definition hydration, payload normalization, CRUD and metadata submissions, authoritative ordering, and rendered required controls. Verified with 295 frontend tests, frontend lint, and the production TypeScript/Vite build.
  - [x] Show permitted active standalone applications and their action/step source on the character sheet; keep them non-removable except through their approved action.
    - The Conditions tab now includes an Active Effects section joined from authoritative per-instance applications to their definitions and originating action/step.
    - Player visibility relies on the backend-redacted assigned-instance application collection; the display has no direct removal control.
  - [x] Remove the unused global-manual compatibility behavior instead of building a legacy conversion workflow.
    - Schema v6 now only initializes the standalone definition/application collections.
    - Removed the obsolete direct global augmentation apply/remove/recompute entry points and their legacy-only tests. Concrete condition effects remain condition-owned, equipment effects remain projection-managed, and standalone effects use definition/application APIs.
    - Current verification passes with 382 backend tests and 297 frontend tests, plus frontend lint, changed-file formatting, and the production build.
- [x] Refine Condition Authoring into a complete effect-authoring workflow.
  - Condition metadata and effects now share one frontend-local draft. Create and Save submit the complete condition payload through the existing backend contract, eliminating per-effect update requests and the create/reselect/Edit workflow.
  - The Effects section is visible during initial creation with an explicit Add Effect command. Direct sheet-value, matching-formula, and matching-roll effects continue to reuse the augmentation model and metadata-backed target/selector controls internally.
  - Effect add/edit/remove operations stay in the draft with stable IDs. Final payload conversion normalizes every effect's condition ID/name ownership, instance scope, and unapplied template state before submission.
  - A newly created condition remains in context and becomes the selected edit record when its authoritative patch arrives; deletion keeps the selected record until authoritative removal and now requires confirmation.
  - Lifecycle fields are grouped as `Manual lifecycle notes` with duration, expiration, and removal-note labels; no automatic expiry behavior is implied or added.
  - Required condition/effect fields show visible validation. Condition Create/Save is disabled while an effect editor has unsaved work so partially entered effects cannot be silently omitted.
  - Condition summaries report configured effect counts and names, and all user-facing `Condition Augmentations` terminology was replaced with `Effects`.
  - Covered complete create payloads, stable effect replacement/removal, source normalization, visible creation workflow, lifecycle labels, validation, deletion confirmation, and existing authoritative patch reconciliation. Verified with 273 frontend tests, 19 backend condition/protocol tests, frontend lint, and the production build.
- [x] Overhaul Action Authoring into a focused step-building workflow.
  - Removed the visible `Action Step Metadata` diagnostic panel while retaining backend metadata as the internal source for formula fields, variable paths, mutation targets, and request payloads.
  - Replaced the overflowing nine-button row with one grouped Add Step selector covering calculation/output, state changes, and rules/effects. Dependency-backed options remain visible with concise reasons when proficiencies, standalone effects, conditions, or mutation targets are unavailable.
  - Added a compact ordered step list with stable type/ID labels and centralized Up, Down, Duplicate, and Remove commands. Only the selected step expands its existing specialized field editor.
  - Safe duplication assigns a new step ID, inserts immediately after the source, and gives duplicated calculation steps a unique variable ID without changing references or backend semantics.
  - Action name and roll mode share a compact row, GM notes use less vertical space, and Create/Save is disabled with visible validation until a name is present.
  - Added scoped responsive layout rules for the picker, step headers, commands, and editors so they remain within the Action Authoring column and reflow to one column on narrow screens.
  - Made the sticky GM toolbar fully opaque so scrolled authoring fields no longer show through it.
  - Preserved backend-authoritative action records, generated contracts, metadata-backed paths, formula sources, ordered-step payloads, and every existing specialized step editor.
  - Added focused step-menu, insertion, dependency, duplication, validation, and rendered-workflow coverage. Verified with 279 frontend tests, frontend lint, and the production build.
- [x] Add formula-tag augmentation matching and independent Roll20 hit/damage actions.
  - [x] Add normalized tags to backend formula models, typed protocol payloads, persistence, and generated frontend types, defaulting existing formulas to no tags.
    - Shared `Formula` values now normalize ordered tags by trimming/collapsing whitespace, case-folding, and removing duplicates, so global, stat, action-step, and augmentation formulas use one representation.
    - Missing tags deserialize as `[]`; persisted state and generated authoring/snapshot payloads carry the tag list without requiring a schema migration.
    - Verified with 328 backend tests, 229 frontend tests, ESLint, and the production TypeScript/Vite build.
  - [x] Extend the existing GM Formula Authoring screen with controlled/common tag suggestions, normalized custom tag entry, tag display, and create/update preservation.
    - Formula drafts support removable selected-tag chips, toggleable semantic/damage-type suggestions, and comma-separated custom tags.
    - Create/update payloads normalize and preserve tags, and authoritative formula cards display the stored tag set.
    - Verified with 233 frontend tests, ESLint, and the production TypeScript/Vite build.
  - [x] Add the same tag controls to inline formulas authored inside action steps so middleware is not limited to global formula definitions.
    - Message, damage-amount, and proficiency-use formulas reuse the shared removable chips, common suggestions, and custom tag input.
    - Text, alias, damage-type, and proficiency edits preserve existing formula tags; tag edits normalize before submission.
    - Verified with 234 frontend tests, ESLint, and the production TypeScript/Vite build.
  - [x] Add formula-modifier selectors for required/excluded tags and optional direct action/formula/step IDs; every populated selector constraint must match.
    - Selectors normalize required/excluded tags, reject overlap, and support optional exact `action_id`, `formula_id`, and `step_id` constraints.
    - Matching requires all required tags, no excluded tags, and equality for every populated direct-ID constraint; legacy effects default to an unconstrained selector.
    - Selector metadata is persisted and generated through authoring/snapshot contracts and is consumed by the completed evaluation-time modifier runtime below.
    - Verified with 333 backend tests, 234 frontend tests, ESLint, and the production TypeScript/Vite build.
  - [x] Extend augmentation authoring with metadata-backed controls for tag and direct-ID selectors.
    - Item and condition augmentation editors share required/excluded tag controls plus exact action/formula/step ID inputs.
    - Suggestions derive from authoritative global actions/formulas, their steps, common semantic tags, and tags already present on authored formulas; free exact IDs remain preservable through datalist inputs.
    - Conflicting required/excluded tags block submission, and saved augmentation cards summarize selector constraints; the editor now distinguishes runtime evaluation selectors from direct-state modifiers that ignore them.
    - Verified with 235 frontend tests, ESLint, and the production TypeScript/Vite build.
  - [x] Add typed evaluation-time modifier effects, initially numeric formula operations and advantage/disadvantage grants, without rewriting authored formulas or duplicating state.
    - Added discriminated `evaluation_formula_modifier` and `roll_mode_modifier` effects beside the existing direct-state `formula_modifier`; numeric evaluation effects carry an operation/formula/selector, while roll-mode effects carry advantage or disadvantage plus a selector.
    - Applying or removing either evaluation-time effect updates only the augmentation lifecycle marker and target association. It does not rewrite the authored formula or mutate the selected numeric target; the execution-context runtime below consumes it only when a matching formula runs.
    - Item and condition augmentation authoring now expose the effect type, numeric operation/formula or roll-mode grant as appropriate, and preserve the shared selector metadata through typed generated protocol payloads.
    - Verified with 339 backend tests, 236 frontend tests, ESLint, protocol code generation, and the production TypeScript/Vite build.
  - [x] Add formula-execution context carrying stable `action_id`, `step_id`, optional `formula_id`, and normalized semantic tags, then apply matching active/equipped modifiers during evaluation.
    - Tags are the default for category-wide effects, such as `damage + fire` or `check + perspective`; direct IDs handle deliberate one-action/one-roll exceptions.
    - Example: a helmet requiring `damage + fire` adds `2` only to matching fire-damage formulas, while a hat requiring `check + perspective` modifies all matching perspective checks.
    - Action formula contexts combine normalized authored tags with stable action/step IDs; semantic damage steps also contribute `damage` plus their canonical damage type. The context supports an optional global formula ID for formula-definition execution paths.
    - Matching concrete effects must be active, applied, and associated with the acting sheet/instance. Matching item templates are read directly from active sheet-item bridges, so equipped effects work without creating duplicate augmentation records.
    - Numeric operations apply in deterministic resolved order to backend-evaluated formulas and compose around emitted Roll20 `/r` expressions without changing their authored text. Non-roll chat text is left untouched.
    - Matching roll-mode grants combine with the requested action mode; opposing advantage/disadvantage sources cancel to normal and multiple same-side sources do not stack.
    - Verified with 350 backend tests, 236 frontend tests, ESLint, and the production TypeScript/Vite build.
  - [x] Add immutable action-local calculated values for reuse across later action steps.
    - Add a typed `calculate_value` action step containing a stable `step_id`, unique action-local `variable_id`, and authored formula. Evaluate it exactly once when reached in the ordered action pipeline.
    - Keep calculated values in an ephemeral execution map for the current `perform_action` call only. Do not persist them, emit them as authoritative state, or make them available to later action executions.
    - Only `calculate_value` steps create referenceable action-local values. Mutation, damage, proficiency, augmentation, and message steps must not expose implicit result variables.
    - Variables are immutable: reject duplicate `variable_id` declarations, reassignment, forward references, unknown references, and nonnumeric values where a numeric input is required.
    - Downstream numeric step inputs may explicitly choose an authored formula or a previously calculated value reference. A calculated reference consumes the stored value directly without rerunning its formula or applying evaluation-time modifiers a second time.
    - Message formulas may safely interpolate previously calculated values alongside authoritative sheet/instance aliases, allowing one backend-calculated value to drive both a mutation and its Roll20 message.
    - Extend action authoring with a Calculate Value step editor, safe instance-resource Increase controls, formula-or-calculated-value source selectors, and metadata-backed previous-variable pickers; do not expose raw execution-map paths.
    - Cover dice evaluation-once behavior, ordered availability, selector/tag modifiers at the calculation step, mutation reuse, message reuse, and execution-to-execution isolation.
    - Implemented through generated authoring/snapshot protocol unions while preserving legacy formula-shaped numeric inputs. Verified with 354 backend tests, 238 frontend tests, ESLint, protocol code generation, and the production TypeScript/Vite build.
  - [x] Add item-granted action availability before mode-specific action controls.
    - Item definitions may reference authored actions through grant records containing `action_id`, an availability policy (`carried` for inventory actions such as drinking a potion or `equipped` for active gear), and optional authoritative quantity consumption on successful use.
    - Resolve effective actions dynamically from explicit sheet-action bridges plus qualifying item grants. Do not copy item-granted actions into the sheet action map or leave stale action bridges behind when equipment changes.
    - Backend action execution must validate the source item bridge, positive quantity, and carried/equipped policy. Include the source item relationship in the request when multiple inventory entries could grant the same action.
    - Consumable actions must decrement the authoritative item-bridge quantity through state sync and become unavailable at zero; carrying a consumable does not require marking it equipped.
    - Ordinary hit/damage actions may remain reusable, but any execution that needs a particular item must carry that equipped source-item relationship. Item-specific attacks or special abilities may be granted directly by each equipped item; no global active-weapon selection is used.
    - Frontend action lists and quick controls render the backend-valid effective action set and identify the granting item; unavailable item actions must not remain executable after inventory/equipment changes.
    - Implemented typed item action grants through the domain, authoring, snapshot, and generated request contracts. Item Maker can select an authored action, carried/equipped availability, and a nonnegative quantity consumed per successful execution.
    - Runtime resolution combines explicit sheet bridges with currently eligible item bridges without copying actions. It revalidates source relationship, quantity, equipment state, and consumption inside the authoritative mutation; ambiguous inventory grants require an explicit source relationship.
    - Player action lists identify the granting item and send its relationship ID. Canonical quick actions can also resolve through one eligible item source, while ambiguous sources remain disabled for explicit selection in the action list.
    - Verified with 358 backend tests, 242 frontend tests, ESLint, protocol code generation, and the production TypeScript/Vite build.
  - [x] Add independent authored Roll20 hit and damage action behavior: hit/check actions use normal/advantage/disadvantage, while damage actions use normal/critical.
    - Hit and damage are invoked separately. Do not add a combined attack composer, automatic hit-to-damage chaining, or inferred hit resolution.
    - Weapon/spell inputs and source-sheet augmentations contribute only to the emitted formula for the independently invoked action; neither action targets or mutates another sheet.
    - Actions now author an explicit roll-mode kind: `none`, `check`, or `damage`. Backend execution rejects modes outside that policy; legacy actions default to `none`, while seeded baseline/default check actions are explicitly `check`.
    - Critical mode is selected manually on damage actions and publicly prefixes the Roll20 message with `[Critical]`. It doubles the entire composed damage expression after aliases and matching numeric augmentation modifiers, without inferring state from a preceding hit action.
    - Assigned-action cards render their own valid mode controls, and Quick Actions reconcile their control to the selected action policy. Normal-only actions do not expose irrelevant mode choices.
    - Implemented through generated authoring, snapshot, and execution contracts. Verified with 360 backend tests, 244 frontend tests, ESLint, protocol code generation, and the production TypeScript/Vite build.
  - [x] Add manual typed damage intake on an affected sheet: raw amount plus damage type, backend resistance calculation, one final floor operation, and authoritative health patch.
    - Players may submit damage only to their assigned instance; DMs may submit it to any instance. No attacker/source relationship is stored or required.
  - Conservative project defaults are recorded for criticals, resistance bounds, rounding, minimum damage, spell composition, and augmentation order; rule-author response is no longer a blocker.

### Recently Completed

- [x] Apply the design-study System Glass direction to the landing and player shell.
  - Added the scoped R6 theme import and system mark asset from `reference-docs/design_study`.
  - Updated unauthenticated code entry, player sheet-claim entry, and the authenticated player/GM shell header to use the status-window visual language while preserving existing websocket auth, sheet-claim, and runtime request flows.
  - Follow-up readability pass darkened legacy stat, quick-action, GM toolbar, intent, and empty-page surfaces so the themed UI no longer exposes white-on-light text or old beige page backgrounds.
  - Reworked authenticated pages around a three-panel frame: top header, left navigation/status panel, and main content panel. Player sheet tabs now live in the left nav, GM pages use vertical navigation buttons, and quick-action debug request IDs were replaced with a lower-emphasis action summary.
  - Compact player Stats tab removes explanatory text and sheet IDs, presents derived Facts as small value rows, constrains the Stats panel to avoid an inner scrollbar on desktop, adds themed scrollbars where scrolling is appropriate, and changes themed buttons from gradients to solid fills.
  - Verified with frontend build, lint, and the full Vitest suite.
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
- [x] Mobile layout refinement for player character sheet and GM encounter/template panels.
  - Added a compact app shell and single-column mobile grids for player resources, core stats, equipment, encounter roster entries, and template editor fields.
  - Added horizontally scrollable sheet/navigation tabs, 44px touch targets, wrapping/full-width action controls, and stacked encounter/template list cards.
  - The persistent GM toolbar collapses and stacks its controls on narrow viewports.
- [x] DM-only undo.
  - Added a bounded backend inverse-patch stack and DM-only typed undo request.
  - Added a GM-facing Undo Last Change visual control.
  - Undo emits normal authoritative patches; it is not a replay system and does not duplicate side-effect state.
- [x] Fix the sheet-access-code side-effect request loop.
  - `useGameClient` now retains one facade object for the hook lifetime, so store-driven rerenders do not retrigger effects that depend on the client.
  - `SheetAccessCodesPanel` independently guards its automatic initial load, preventing duplicate requests under React Strict Mode or a future facade-identity regression while preserving manual refresh.
  - Added regression coverage for stable client facade identity across rerenders.
  - Deleted the completed `plan/active/side_effect_bug.md` report.
  - Verified with 256 frontend tests, ESLint, and the production TypeScript/Vite build.

### Later

- [ ] Combat/turn tracking.
- [ ] Overload selected mode/alternative handling.
- [ ] Mastery unlock enforcement.
- [ ] Multi-campaign support.

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
- Equipment-capacity rules, including slots, hand limits, one-handed/two-handed classification, valid weapon combinations, and modifiers that increase how much a character may equip.
- Overload mode automation and overload explosion resolution.
- Mastery unlock enforcement and visibility for disabled/hidden content.
- Frontend formula previews for formulas that remain Roll20-resolved.
- Stat/resource adjustment semantics where the answer is not a direct current HP/mana edit: additive, replace-value, formula-driven, or rule-specific.

## 14. Historical Sources

- Section 4 is the authoritative current implementation baseline.
- Sections 10 and 12 hold detailed completion records and remaining work; do not duplicate completed tasks in a separate summary.
- Earlier completion history remains archived in `plan/archived/Completed.md` and the source plans listed at the top of this document.
- BUG-001 through BUG-009 were resolved and archived in `plan/archived/resolved_bugs_2026-06-25.md`.
