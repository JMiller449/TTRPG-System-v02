# TTRPG System Plan

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.

This is the active plan for the project. It intentionally focuses on what the app is for, what is already implemented, and what remains before it is comfortable to use at the table as a character sheet and authored-action dice roller.

The detailed historical implementation logs are preserved in:

- `plan/archived/backend_takeover.md`
- `plan/archived/backend_tasks.md`
- `plan/archived/frontend_tasks.md`
- `plan/archived/backend_plan.md`
- `plan/archived/tmp_system_goals_questions.md`
- `plan/archived/backend_completed.md`
- `plan/archived/frontend_completed.md`
- `plan/archived/Completed.md`
- `plan/archived/resolved_bugs_2026-06-25.md`

Keep AGENTS, README files, policy docs, and rules/reference documents as source material. The highest rules authority for active rules text is `reference-docs/Chip_TTRPG_System.md`; answered implementation rulings live in `reference-docs/rule-decisions-needed-answered.md`. Archived PDFs remain preserved for history.

## 1. Product Purpose

Build a backend-authoritative Chip TTRPG character sheet and action roller.

The app should be usable for local table play where:

- The GM authors character/enemy templates, attributes, stats, proficiencies, formulas, items, conditions, standalone effects, and actions.
- The GM instantiates templates into playable sheets and assigns player access codes.
- Players view their assigned sheet, track current state, edit permitted notes/resources, and execute assigned actions.
- Frequent low-friction state changes are tracked authoritatively, including HP, mana, conditions, equipment, item quantity, proficiency increases, and other approved action mutations.
- Ability, skill, spell, item, and weapon rolls are represented as authored
  actions, executed through the backend, and emitted to Roll20 chat through the
  Firefox/Violentmonkey userscript.
- Roll20 remains the table surface and play log for MVP.

The app is not a full VTT. Maps, token targeting, initiative, turn automation, cross-sheet attack resolution, and full combat automation remain outside the character-sheet/dice-roller MVP.

## 2. Architecture Rules

- Backend owns auth/session truth, canonical game state, validation, calculations, mutations, snapshots, patches, persistence, and redaction.
- Frontend renders authoritative state, submits intents, keeps UI state local, and reconciles to backend snapshots/patches.
- Gameplay math and persisted outcomes must not be finalized in frontend code.
- Public app operations cross the websocket boundary through explicit backend transport schemas registered in the request registry.
- Frontend protocol types and route-contract metadata are generated from backend route contracts; centralized typed request builders consume that generated contract.
- Raw mutation paths are internal backend primitives. User-facing authoring uses backend metadata, typed payloads, and validated selectors.
- Roll20 integration is output-only chat delivery through the authenticated
  Violentmonkey userscript bridge. Roll20 never mutates backend state.
- Roll20 chat is the table play log. The in-app action history is a bounded backend-owned audit/status stream, not a second authoritative roll log.

## 3. Current Usable Baseline

The core character-sheet and authored-action dice-roller MVP is implemented.

Backend:

- FastAPI websocket app clients connect on `/ws`; the Roll20 bridge connects on `/ws/chat`.
- App sessions authenticate as `player` or `dm`; bridge sessions authenticate as `service`.
- Player-accessible `get_roll20_bridge_sync_config` returns a signed token
  scoped to the requesting DM or claimed player-sheet instance for immediate
  userscript sync.
- `/ws/chat` maintains one active connection per binding. The newest Roll20 tab
  replaces only the prior tab for that binding, while other users remain
  connected.
- State sync sends full snapshots, ordered patches, version tracking, replay where possible, forced resync fallback, and role-based redaction.
- State persists through `state_dumpy.json`, with schema migrations, backup fallback, JSON export/import, and DM-only undo.
- Typed route families exist for auth, resync, sheets, sheet instances, notes, resources, stats, attributes, formulas, actions, proficiencies, items, item bridges, action bridges, proficiency bridges, conditions, standalone effects, encounters, XP tracking, Roll20 bridge status, manual damage intake, and action execution.
- XP tracking is instance-based and registry-backed. DMs manage temporary proximity parties, record or correct historical kills, control which enemy names players may select for final-blow submissions, and apply explicit XP adjustments; equal per-participant awards are snapshotted at kill time with two-decimal precision, while character totals are derived from the registry rather than stored independently.
- Sheet instances now own the spawned copy of template-built content, including stats, resistances, actions, attributes, proficiencies, and inventory. GM instance edits mutate the spawned sheet rather than the source template, and a DM can snapshot an evolved instance back into a new checkpoint template without copying runtime-only health, mana, augments, or active effects.
- Encounter preset counts spawn independent copies through the same canonical instance builder as `create_instanced_sheet`, including actions, proficiencies, attributes, inventory, resistances, custom maximum-resource formulas, racial HP multiplier, stat bonuses, and authoritative starting-resource evaluation. Encounter spawning retains collision-safe IDs and does not generate player access codes.
- `perform_action` executes backend-authored action pipelines against explicit sheet/instance IDs.
- Supported action step behavior includes calculated values, Roll20 messages, bounded set/increment/decrement mutations, semantic damage, proficiency gain, augmentation application/removal, and condition application/removal.
- Each `perform_action` invocation selects public or GM Roll20 visibility. GM
  output uses Roll20 whispers for both plain text and styled/inline dice, and
  remains GM-only in action-history projections.
- Formula evaluation is backend-owned and supports arithmetic, dice expressions, aliases, dataclass/dict traversal, cycle guards, `min`, `max`, `floor`, `ceil`, and `round`.
- Attributes are typed backend records for sheets, items, and actions. Required attributes are backend-owned, backfilled, redacted correctly, and evaluated authoritatively.
- Items support `equippable`, `consumable`, and `inventory_only` interaction types; equipment lifecycle, wearer effects, granted actions, quantity consumption, source-item action context, player catalog visibility, and player-submission approval are backend-authoritative.
- Weapon-profile items automatically grant canonical equipped weapon actions, and equipping a weapon adds the matching sheet proficiency bridge when it is missing so source-item weapon rolls can resolve and advance `weapon_proficiency`.
- Damage/resistance uses canonical damage types, fractional resistance values, cap/clamp rules, one final floor, semantic damage action steps, and manual amount/type damage intake.
- Action history is persisted as a bounded audit/status stream with DM/player redaction.

Frontend:

- React/Vite app uses the authoritative websocket backend only; runtime mock authority has been removed.
- Player and GM views share authoritative sheet rendering with role-specific visibility and controls.
- GM authoring exists for templates/sheets, attributes, formulas, actions, proficiencies, items, conditions, standalone effects, encounters, and XP tracking.
- The GM XP workspace manages temporary parties of spawned player sheets, a filterable/editable kill registry, arbitrary kill entries, manual adjustments, monster XP defaults, player kill-option visibility, and character thresholds. Party identity is never persisted into historical kills; participant instance/name snapshots, party size, percentage, award, and submission attribution are retained.
- Template Builder is the primary complete sheet-authoring workflow, with contextual create dialogs for missing Attributes, Actions, Items, and Proficiencies.
- A generated character code now authenticates a player and selects the backend-validated sheet instance in one step; shared player and GM session codes remain supported.
- Character sheets display stats, resources, attributes, actions, conditions, equipment, proficiencies, standalone effects, notes, and kill tracking where permitted.
- Character kill history and XP progress are projections filtered from the authoritative registry for the selected spawned instance. Players may record a final blow only against a DM-exposed enemy name; the backend derives the submitting character, canonical XP, and current party participants. Ungrouped kills record one participant at 100 percent credit; grouped kills include every current party member, and later party or visibility changes do not rewrite history.
- Player sheets show read-only current resistances and an XP progress bar for their assigned sheet. The GM spawned-sheet workspace is clearly separated from template authoring and includes a snapshot-as-template action.
- GM Characters can despawn spawned sheet instances through a backend-authoritative delete-instance request that also clears runtime conditions/effects and player access codes tied to that instance.
- GM Characters can grant arbitrary unassigned stat points to a spawned sheet instance; assigned players can stage them across core stats or individual substats, undo only staged additions, and lock them in through a backend-authoritative allocation request. Direct substat allocations persist as permanent bonuses and feed downstream formulas.
- GM and assigned players can edit permitted current resources/notes; GM-only edits remain gated.
- Health and Mana expose their entire summary cards as accessible editor triggers
  rather than limiting activation to the numeric values; their editors dismiss on
  outside click or Escape without a redundant Cancel action.
- Action controls execute assigned explicit actions and item-granted actions through typed `perform_action` requests.
- Weapon action controls resolve through item-granted source items rather than direct sheet action bridges.
- Frontend shell and navigation have been reorganized for table use: persistent session status, task-oriented player tabs, compact searchable action commands, and grouped GM workspaces.
- Player navigation presents exactly one active destination: opening the Extension
  tool clears the visual selection from the remembered character-sheet tab.
- Character resistance tabs use a full-width responsive summary with separate
  core and damage-type groups instead of inheriting the generic horizontal form columns.
- Character inventory tabs keep the equipment list and item-proposal form in
  stable responsive work areas, with desktop scrolling isolated to the owned-item
  catalog instead of moving the add controls and proposal form with the list.
- Attributes, Proficiencies, and Kills are separate full-width character-sheet
  destinations instead of nested disclosures inside a generic Details tab, with
  one page-level heading per destination rather than repeated section titles;
  authoritative attributes use a bounded responsive card grid instead of stretched
  compact Overview rows.
- Player kill history relies on pushed websocket tracker updates after its
  initial load and presents records in a compact responsive card grid without a manual refresh control.
- Character notes use a full-width responsive writing workspace with an explicit
  saved/pending state instead of inheriting the generic horizontal column layout.
- The frontend visual system now follows the dense R6 console reference layout: an edge-to-edge status header, grouped GM rail, reserved feedback strip, compact authoritative character workspace, vertical template section rail, and reusable catalog/editor authoring pages. This was a presentation-only pivot and did not add or remove application capabilities.
- Quick action controls resolve assigned default authored actions such as Dodge, Block, weapon actions, and spell actions when present.
- Roll modes are action-specific: check actions support normal/advantage/disadvantage; damage actions support normal/critical.
- Roll20 bridge disconnected state fails fast with visible client feedback.
- The DM and player **Extension** workspace stages Violentmonkey installation, installs
  the hosted userscript, automatically detects its version on navigation without
  an intermediate Continue gate, synchronizes the current
  development or production endpoint, refreshes status, and sends a
  best-effort test message without persisting the signed bridge token in
  frontend state. Its discovery/sync handshake supports Violentmonkey's
  isolated content context; scoped bindings require userscript 1.1.0 or newer.
  Discovery retries during its bounded timeout so page/userscript startup
  ordering cannot force a refresh for an already-installed bridge.
  Configuration sync is independent of the live Roll20 editor connection;
  disconnected status is represented as state rather than a failed request.
  The installation checklist uses responsive, self-contained step cards so its
  controls remain separated from their labels while the workflow makes balanced
  use of the available workspace.
  The application status bar reports live userscript discovery as Extension
  Connected or Extension Not Detected instead of presenting backend state sync
  as a generic Synced badge.
  Every authenticated workspace requests its binding-specific bridge status
  immediately, then receives per-session broadcasts for connection changes.
- GM console navigation, persistent toolbar, state backup UI, mobile layout refinement, and request feedback are implemented.
- Frontend build, lint, and test suites were recorded as passing after the completed implementation tracks.
- GM/player console panels keep a fixed remaining-height workspace across navigation tabs, and HP/mana editing opens as an anchored overlay instead of resizing the sheet.
- GM dashboard hosts session-level active sheet selection, player access codes, and quick actions without embedding the character sheet; GM Action History owns the global actor-labelled audit stream, while GM Characters owns sheet detail plus filtered per-sheet history, formula-stat, and resistance tabs.
- GM sheet Actions uses the player-style searchable command grid for execution while retaining GM assignment management below it.
- Frontend theme tokens now centralize the active dark console palette, and legacy white/light component surfaces in authoring, picker, roll, XP, item, template, and sheet CSS have been replaced with semantic theme variables.
- Frontend readability/compactness pass (2026-07-04): raw IDs removed from all user-facing surfaces (access codes, sheet headers, proficiency/selector editors now use names with auto-derived IDs), builder pages gained plain-language subtitles and rewritten helper copy, radius tokens sharpened with nested boxed rows flattened to dividers, and overflowing panel content (authoring editors, catalog lists, non-overview sheet tabs) now flows into horizontal swipe columns instead of vertical scrolling. Presentation-only; no capability or protocol changes.
- Template Builder newcomer pass (2026-07-04): sections are grouped into core setup, optional starting content, advanced customization, and final review; validation is deferred until review; empty states explain safe defaults; derived formulas and the full resistance matrix are progressively disclosed; and contextual creation dialogs now identify the quickest valid path in table-facing language. Presentation-only; backend validation and authoring contracts are unchanged.

Repository documentation:

- `architecture/README.md` indexes current platform and feature architecture in independent documents verified against backend routes/services, state models, frontend flows, and focused tests. `AGENTS.md` directs future work to those documents and requires them to be updated when a material architecture or feature change would make them inaccurate.

## 4. MVP Character Sheet And Dice Roller Acceptance

For the MVP to be considered usable at the table:

- GM can create a complete player or enemy template with stats, derived attributes, proficiencies, item inventory, conditions/effects, and assigned actions.
- GM can instantiate a template into a backend-owned sheet instance.
- GM can generate or rotate a player access code for an instance.
- Player can claim the code and see only their permitted sheet data.
- Player can adjust permitted current resources/notes and see authoritative updates.
- GM can edit base/template data, current resources, inventory, equipment, proficiencies, notes, and conditions with authoritative patch updates.
- Player can execute assigned actions and item-granted actions.
- Ability/skill/spell/weapon rolls emit auditable Roll20 chat output with sheet/action context and roll mode labels where relevant.
- Authored Roll20 output can be sent publicly or whispered to the GM, including
  both dice rolls and non-roll messages.
- Authored actions can mutate current sheet state for common table needs, including resource changes, healing, damage, condition/effect application, and proficiency gains.
- Equipment effects and consumable quantity changes are enforced by the backend.
- Manual damage intake can apply typed resistance and update current health.
- Roll20 bridge failure is visible immediately instead of silently queueing or losing actions.
- State survives restart and can be exported/imported by the DM.
- Permission failures and validation errors are surfaced to the acting user.

## 5. Remaining Work Before First Table Use

No large architecture feature is currently missing for the stated character-sheet and authored-action dice-roller goal. The remaining work is a readiness pass: content, smoke testing, and any defects found while using the real table workflow.

- [x] Deploy the production application at `https://bossadapt.org/ttrpg/`:
  - Cloudflare and Nginx serve the Vite frontend under `/ttrpg/`.
  - Nginx proxies `/ttrpg/ws` and `/ttrpg/ws/chat` to loopback Uvicorn.
  - `ttrpg.service` runs as `www-data` from `/srv/ttrpg` with generated
    production authentication codes and private checkpoint permissions.
  - `just bootstrap` handles first installation; `just deploy-all` performs
    tested maintenance-mode routine deployments and reinstalls backend
    dependencies from `backend/requirements.txt`.
  - Production started with fresh default state, and a second deployment
    preserved the generated production checkpoint.
  - Direct readiness, public HTTPS, SPA fallback, production-default rejection,
    and both authenticated public WebSockets were verified on 2026-07-04.
- [ ] Complete the final hosted Roll20 browser smoke test by installing
  Violentmonkey and the production-hosted userscript from both the DM and a
  claimed player's **Extension** page, running **Sync Bridge** in each browser,
  opening active Roll20 editor tabs, and confirming each authored action reaches
  Roll20 exactly once through its originating user's connection.

- [x] Resolve the 2026-07-05 builder and table-readiness defects:
  - Template Builder footer actions now walk through sections with destination-specific
    labels and provide an explicit early-review option throughout optional content.
  - The Actions section lists mandatory system checks, Dodge, and Block as locked defaults;
    backend create/update paths enforce them so they cannot be duplicated or removed.
  - Formula-backed sheet stats are evaluated by the backend and projected through
    snapshots and patches instead of being parsed as numeric formula text by the frontend.
  - Default instance Health, Mana, and resistances are initialized from the template by
    the backend when the DM does not explicitly override them.
  - The Extension workspace presents the Violentmonkey/userscript setup as an ordered
    install, reload, and re-login sequence.
  - Successful authored actions populate the persisted, bounded action-history audit
    stream through non-undoable authoritative patches; live patches use the same
    role-filtered string payloads as snapshots for both DMs and assigned players. The
    GM has a global actor-labelled history page, and character history tabs filter by
    their selected sheet and instance.
  - Template inventory bridges now define spawn defaults while character instances own
    live item quantities, equipped state, and runtime stats. Item use and equipment
    effects are isolated per instance; assigned players may add visible catalog items,
    remove or equip their own items, and propose mundane items for DM review. Quantity,
    containment, and mechanical item authoring remain DM-owned.

- [x] Resolve the 2026-07-11 QC mechanical-accuracy and navigation findings:
  - Sheet formula defaults now match the active rules document, including whole-number floors,
    Dexterity-based Reaction Time, Health-based Endurance, and Perception-based Intuition.
  - Current HP/Mana are independent from formula-backed Health/Mana substats. Maximum HP and
    Mana are backend-authored formulas, projected separately, and current resources are clamped
    to authoritative bounds after mutations. Mana remains whole-numbered.
  - New templates require a positive racial HP multiplier and expose editable maximum-resource
    formulas. Persisted schema v23 migrates legacy pools and action formula aliases.
  - Resistance input is restricted to finite `0..1` fractions and runtime effective resistance
    is clamped at both bounds before damage is floored.
  - Character codes authenticate and select their instance in one step; landing-page copy now
    explains character, shared-player, and GM codes.
  - Player stat allocation supports permanent direct substat bonuses as well as core stats.
  - The Actions catalog uses a responsive vertical grid with conventional vertical scrolling,
    and request-scoped Roll20 failures no longer produce duplicate persistent error banners.
  - Protocol types, starter examples, focused regression tests, production build, and backend
    suite were updated together. Automated turn/round behavior remains explicitly out of scope.

- [x] Resolve the 2026-07-12 builder and inventory findings:
  - Long Action Builder drafts now use one vertical editor scroll region with a sticky final
    action footer, keeping Save Action keyboard- and pointer-reachable at constrained heights.
  - Item proficiency references are sourced only from the authoritative proficiency registry;
    stale IDs are shown as invalid and rejected independently by backend validation.
  - Item create/edit authoring uses one local draft and one complete final item request, including
    attributes, action grants, effects, numeric weight, and storage configuration.
  - Persisted schema v25 migrates legacy pound strings to finite nonnegative numeric pounds,
    defaults existing items to non-storage, and defaults inventory entries to root containment.
  - Backend-authoritative carried-weight projections count quantities and equipped items, honor
    weight-negating containment, and reconcile through snapshots and patches.
  - Inventory containment supports accessible root/container moves, nesting, read-only display,
    and validation against self/cycles/missing or stacked destinations, equipped moves, and
    nonempty-container removal.

- [x] Resolve the 2026-07-12 interaction coverage and Roll20 accuracy findings:
  - Active rules authority is `reference-docs/Chip_TTRPG_System.md`, followed by
    `reference-docs/rule-decisions-needed-answered.md`; archived PDFs are historical references.
  - Canonical weapon Parry and Contest rolls use the documented `1 + Proficiency` multiplier,
    with a guarded migration that preserves customized campaign actions.
  - Player proficiency gains mutate the acting instance without changing its template or siblings.
  - Action mutations commit only after correlated Roll20 delivery acknowledgement; delivery
    failure, timeout, disconnect, or bridge replacement returns a request-scoped error and rolls
    backend state back before persistence or patch broadcast.
  - Userscript delivery preserves exact message text, reports bounded failure reasons, and drops
    queued work from stale bridge generations.
  - A multi-message action can still partially reach Roll20 if an early message succeeds and a
    later message fails; Roll20 provides no deletion transaction for retracting the earlier chat.

- [x] Resolve the 2026-07-13 per-user Roll20 extension ticket:
  - Extension setup is available to both DMs and players after a player claims a sheet.
  - Sync issues a signed DM- or instance-scoped bridge token without exposing the service secret.
  - Backend bridge connections, status events, sends, and delivery acknowledgements are isolated
    by binding; no message falls back to another user's browser.
  - The userscript stores and reports its binding label, detects mismatched character sync, and
    migrates legacy service-code configuration to a DM-only binding.
  - Same-binding Roll20 tabs retain newest-wins behavior while different users coexist.

- [x] Resolve the 2026-07-13 player inventory and item-approval ticket:
  - DMs can publish or hide item definitions from the player add-item catalog; hidden
    definitions are redacted unless the assigned character already carries the item.
  - Assigned players can add one copy of a published item or remove an item from their
    own inventory through instance-derived, backend-authoritative requests.
  - Players can propose non-mechanical equippable or inventory-only items. Proposals are
    visible only to the submitting character and DM while pending.
  - DM approval atomically publishes the definition and grants one copy to the submitter;
    denial deletes the proposal. Persisted schema v28 publishes existing items to preserve
    the pre-ticket catalog behavior and backfills approval metadata.

- [x] Add per-invocation Roll20 visibility to action execution:
  - Character action runners offer Public and GM Only beside the roll-mode controls;
    the choice applies to that execution without rewriting the authored action.
  - The backend formats GM invocations as `/w gm` after inline-roll and roll-mode
    processing, covering every styled roll and ordinary message step uniformly.
  - GM-directed output is retained as GM-only action-history text.
  - Persisted schema v31 removes the superseded per-step visibility introduced by v29.

- [x] Add native styled Roll20 roll output to authored actions:
  - `send_roll` steps author a title, simple/damage/default card presentation, and one or
    two labeled formula results without raw template syntax; visibility is chosen at execution.
  - Backend composition owns formula expansion, modifiers, roll modes, actor labels,
    template safety, native Roll20 formatting, and GM whispers.
  - Baseline stat checks, Dodge, Block, weapon actions, and spell presets use styled cards.
  - Persisted schema v30 upgrades exact built-in defaults while preserving customized actions.

- [x] Fix Action Authoring save lifecycle feedback:
  - Create/update keeps the current draft visible and disables conflicting editor controls while
    the correlated request is pending.
  - A rejected save retains the draft for correction or retry; a successful save selects the
    authoritative action and shows an inline created/saved confirmation.
  - A pristine new-action draft no longer displays `Name is required` as though a save failed.

- [x] Replace separate formula variable insertion fields with inline `@` autocomplete:
  - Formula-bearing action, formula, attribute, sheet, item, condition, and effect editors search
    their backend-provided variable catalogs when an author types `@` in the formula itself.
  - Keyboard or pointer selection replaces the active mention at the cursor and upserts the
    correct canonical, sheet-relative, attribute-relative, or action-scoped alias.
  - Earlier calculated action values participate in the same search instead of requiring a second
    calculated-value insertion control.
  - Formula tags use a single chip-and-search field across the same editors: typing filters common
    tags, custom tags remain available, and no separate suggestion field or Add Tags step is shown.

- [x] Create or verify the starter campaign data needed for an actual session:
  - player templates
  - enemy templates
  - core required Attributes and campaign-specific optional Attributes
  - proficiency definitions and sheet proficiency bridges
  - common items, equipment, consumables, and inventory-only records
  - common conditions and standalone effects
  - default and campaign-specific actions for checks, spells, weapons, resource costs, healing, damage, and proficiency gain
  - encounter presets for expected sessions
  - Covered by reusable `backend/dev/dm_examples.py` seed content,
    `backend/dev/seed.py`, and `backend/tests/test_dm_examples_acceptance.py`.
    `just seed` atomically installs the validated starter campaign for UI and
    table smoke testing. The acceptance test authors the starter data through
    websocket routes, persists/reloads it, executes representative actions,
    applies/removes a condition, consumes an item, gains proficiency use, and
    spawns an encounter preset.
- [ ] Run an end-to-end local table smoke test:
  - start backend and frontend
  - install Violentmonkey and the userscript through both DM and player Extension pages
  - run Sync Bridge in each browser and reload each Roll20 editor page
  - authenticate as GM
  - create or import a complete player template
  - instantiate it and generate a player access code
  - authenticate as player and claim that code
  - adjust HP/mana/notes from the permitted role
  - equip an item with a wearer effect
  - use a consumable action and confirm quantity consumption
  - execute a check action with normal, advantage, and disadvantage where allowed
  - execute a damage action with normal and critical where allowed
  - apply manual typed damage and confirm resistance math
  - apply and remove a condition/effect through approved actions or GM controls
  - confirm DM and player actions reach only their respective Roll20 connections and
    disconnected per-user bridge failures are visible
  - export state, restart, and confirm state reloads correctly
- [ ] Fix any defects found by that smoke test before calling the sheet/roller table-ready.
- [ ] Add or update focused tests for smoke-test defects that represent contract, permission, persistence, formula, equipment, or action-execution regressions.
- [ ] Write a short table-use runbook in the README or a dedicated doc covering:
  - required backend/frontend/userscript startup steps
  - local auth code setup
  - GM sheet creation and player access-code workflow
  - how rolls are represented as authored actions
  - the Roll20 bridge failure behavior
  - backup/export/import expectations

- [x] Checklist verification follow-up (2026-07-19): verified the existing
  action builder, item/proficiency, inventory weight/container, effects,
  party XP, Roll20 binding, level-attribute, player inventory/visibility, and
  item approval flows against their backend routes, persistence, redaction,
  and focused tests. Added missing authoritative fractional reaction tracking,
  nonnegative contribution-point balances with audit records, and persistent
  per-instance action pins with stale-reference cleanup (schema v32).
- [x] Proficiency growth follow-up (2026-07-19): canonical weapon actions now
  advance the selected weapon proficiency and spell presets advance their
  Action Proficiency Attribute target. Character sheets display the capped
  player-facing proficiency percentage alongside uses and growth rate; existing
  unmodified canonical weapon actions migrate safely (schema v33).

## 6. Explicit Non-Blockers

These are not required for the app to be usable as the MVP character sheet and authored-action dice roller:

- A custom one-off dice-only roller inside the app. One-off rolls can happen directly in Roll20.
- Automated initiative, turn order, action-point reset, or round lifecycle.
- App-side targeting, token reads, intersheet attack execution, or cross-sheet damage automation.
- Automatic hit-vs-defense comparison, Dodge/Block/Parry contest resolution, counterattacks, or critical consequence automation.
- Automatic level-up stat distribution or mastery/rank unlock enforcement.
- Equipment capacity rules such as slots, hands, one-handed/two-handed restrictions, or weapon-combination validation.
- Overload automation.
- Multi-campaign/account support.
- Syncing data back into Roll20 character sheets.

## 7. Later Roadmap

Future work should be prioritized only after the table-readiness pass proves the MVP workflow.

- [ ] Effects & conditions system conceptual cleanup — phased plan tracked in
  `plan/active/effects_conditions_review.md`. Phase 1 complete: current pipeline documentation
  (`backend/features/augmentations/ARCHITECTURE.md`) and gap tests are in place. Phase 2
  complete: `equipment_effect_projections` renamed to `direct_effect_projections`
  (`EquipmentEffectProjection` → `DirectEffectProjection`) with schema migration v17→v18; this
  is private/redacted state so no protocol/frontend change was needed. Phase 3 complete:
  regenerated stale protocol codegen (a prerequisite unrelated to effects — prior commits had
  drifted the checked-in frontend types), decided to keep `Augmentation` as the internal model
  name, made `ConditionPreset` a pure definition by removing the dead `augmentation_ids` field
  (schema v19), and added source/timing metadata to `ActiveCondition` (`source`, `applied_at`,
  `applied_by_role`, `applied_at_state_version`; schema v20) so the GM can see why/who/when a
  condition was applied. Phase 4 (part): restructured the augmentation lifecycle into a
  declarative `mode`/`remaining`/`expires_at`/`remove_when_source_inactive`/`notes` shape
  (schema v21) — GM-tracked, not an auto-tick engine (turn/round automation stays a non-goal).
  Standalone effect stacking (schema v22): `StandaloneEffectDefinition.stacking` (`unique`
  default / `stack` with `max_stacks`); stacked applications accumulate through the existing
  projection path and removal clears the whole stack. Remaining: `refresh`/`replace` modes and
  condition stacking (need per-application lifecycle state / condition multi-application), GM
  refresh/expire controls, and the authoring UI refresh incl. the Active Effects inspector
  (Phase 5 — paused pending a UI-capable environment).
- [ ] Combat/turn tracking.
- [ ] Overload selected mode and alternative handling.
- [ ] Mastery unlock enforcement and visibility for disabled/hidden content.
- [ ] App-side physical/spell attack resolvers, including defense-derived reductions and critical side effects.
- [ ] Weapon resolver inputs and augmentation-derived attack modifiers beyond independently authored hit/damage actions.
- [ ] Equipment capacity and slot/hand rules.
- [ ] Multi-campaign support and durable player identity/account binding.
- [ ] If the player-client threat model changes, audit websocket state redaction so
  raw DM-only template, instance, encounter, and referenced-definition metadata
  cannot reveal untoggled encounter content to a client inspecting network state.
- [ ] Frontend previews for formulas that remain Roll20-resolved, clearly marked as non-authoritative previews.

## 8. Rule Decisions Captured

Expanded answered rules and future-automation handoff: `reference-docs/rule-decisions-needed-answered.md`.

Answered rulings currently reflected in the implementation plan:

- HP max is `Health * Racial HP Multiplier`; the multiplier is authored by race or creature template.
- Carry weight is `FLOOR(Strength)`.
- Resistance is additive, clamped to `0.00..1.00`, capped at 100 percent, and applied as `FLOOR(Damage * (1 - Resistance))`.
- Heavy armor imposes disadvantage on Dodge; shields normally grant advantage on Block.
- Critical behavior is defined for physical attacks, spell to-hit, Dodge, Block, Parry, skill checks, grapple checks, and overload checks.
- Overload has defined tiers, mana costs, check formula, and failure outline; only the DC remains GM-assigned rather than formula-derived.

If a rule is unclear, do not invent behavior. Add a TODO here or in the relevant reference/rule-decision document with the exact source section/page when available.
