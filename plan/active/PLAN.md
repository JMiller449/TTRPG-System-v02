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
- Frontend protocol types and request helpers are generated from backend route contracts.
- Raw mutation paths are internal backend primitives. User-facing authoring uses backend metadata, typed payloads, and validated selectors.
- Roll20 integration is output-only chat delivery through the authenticated
  Violentmonkey userscript bridge. Roll20 never mutates backend state.
- Roll20 chat is the table play log. The in-app action history is a bounded backend-owned audit/status stream, not a second authoritative roll log.

## 3. Current Usable Baseline

The core character-sheet and authored-action dice-roller MVP is implemented.

Backend:

- FastAPI websocket app clients connect on `/ws`; the Roll20 bridge connects on `/ws/chat`.
- App sessions authenticate as `player` or `dm`; bridge sessions authenticate as `service`.
- DM-only `get_roll20_bridge_sync_config` returns the service credential only
  to the requesting authenticated DM session for immediate userscript sync.
- The newest authenticated `/ws/chat` connection is the sole delivery bridge;
  replaced Roll20 tabs receive a terminal close signal and do not oscillate.
- State sync sends full snapshots, ordered patches, version tracking, replay where possible, forced resync fallback, and role-based redaction.
- State persists through `state_dumpy.json`, with schema migrations, backup fallback, JSON export/import, and DM-only undo.
- Typed route families exist for auth, resync, sheets, sheet instances, notes, resources, stats, attributes, formulas, actions, proficiencies, items, item bridges, action bridges, proficiency bridges, conditions, standalone effects, encounters, XP tracking, Roll20 bridge status, manual damage intake, and action execution.
- `perform_action` executes backend-authored action pipelines against explicit sheet/instance IDs.
- Supported action step behavior includes calculated values, Roll20 messages, bounded set/increment/decrement mutations, semantic damage, proficiency gain, augmentation application/removal, and condition application/removal.
- Formula evaluation is backend-owned and supports arithmetic, dice expressions, aliases, dataclass/dict traversal, cycle guards, `min`, `max`, `floor`, `ceil`, and `round`.
- Attributes are typed backend records for sheets, items, and actions. Required attributes are backend-owned, backfilled, redacted correctly, and evaluated authoritatively.
- Items support `equippable`, `consumable`, and `inventory_only` interaction types; equipment lifecycle, wearer effects, granted actions, quantity consumption, and source-item action context are backend-authoritative.
- Weapon-profile items automatically grant canonical equipped weapon actions, and equipping a weapon adds the matching sheet proficiency bridge when it is missing so source-item weapon rolls can resolve `weapon_proficiency`.
- Damage/resistance uses canonical damage types, fractional resistance values, cap/clamp rules, one final floor, semantic damage action steps, and manual amount/type damage intake.
- Action history is persisted as a bounded audit/status stream with DM/player redaction.

Frontend:

- React/Vite app uses the authoritative websocket backend only; runtime mock authority has been removed.
- Player and GM views share authoritative sheet rendering with role-specific visibility and controls.
- GM authoring exists for templates/sheets, attributes, formulas, actions, proficiencies, items, conditions, standalone effects, encounters, and XP tracking.
- Template Builder is the primary complete sheet-authoring workflow, with contextual create dialogs for missing Attributes, Actions, Items, and Proficiencies.
- Player entry claims a generated sheet access code and uses the backend-validated claimed instance as the active sheet.
- Character sheets display stats, resources, attributes, actions, conditions, equipment, proficiencies, standalone effects, notes, and kill tracking where permitted.
- GM and assigned players can edit permitted current resources/notes; GM-only edits remain gated.
- Action controls execute assigned explicit actions and item-granted actions through typed `perform_action` requests.
- Weapon action controls resolve through item-granted source items rather than direct sheet action bridges.
- Frontend shell and navigation have been reorganized for table use: persistent session status, task-oriented player tabs, compact searchable action commands, and grouped GM workspaces.
- The frontend visual system now follows the dense R6 console reference layout: an edge-to-edge status header, grouped GM rail, reserved feedback strip, compact authoritative character workspace, vertical template section rail, and reusable catalog/editor authoring pages. This was a presentation-only pivot and did not add or remove application capabilities.
- Quick action controls resolve assigned default authored actions such as Dodge, Block, weapon actions, and spell actions when present.
- Roll modes are action-specific: check actions support normal/advantage/disadvantage; damage actions support normal/critical.
- Roll20 bridge disconnected state fails fast with visible client feedback.
- The GM **Extension** workspace stages Violentmonkey installation, installs
  the hosted userscript, automatically detects its version on navigation without
  an intermediate Continue gate, synchronizes the current
  development or production endpoint, refreshes status, and sends a
  best-effort test message without persisting the service credential in
  frontend state. Its discovery/sync handshake supports Violentmonkey's
  isolated content context and retains compatibility with userscript 1.0.0.
  Discovery retries during its bounded timeout so page/userscript startup
  ordering cannot force a refresh for an already-installed bridge.
  Configuration sync is independent of the live Roll20 editor connection;
  disconnected status is represented as state rather than a failed request.
  Every authenticated workspace requests the current bridge status immediately,
  then receives backend broadcasts for subsequent connection changes.
- GM console navigation, persistent toolbar, state backup UI, mobile layout refinement, and request feedback are implemented.
- Frontend build, lint, and test suites were recorded as passing after the completed implementation tracks.
- GM/player console panels keep a fixed remaining-height workspace across navigation tabs, and HP/mana editing opens as an anchored overlay instead of resizing the sheet.
- GM dashboard hosts session-level active sheet selection, player access codes, and quick actions without embedding the character sheet; GM Characters owns sheet detail plus dedicated tabs for action history, formula stats, and resistances.
- GM sheet Actions uses the player-style searchable command grid for execution while retaining GM assignment management below it.
- Frontend theme tokens now centralize the active dark console palette, and legacy white/light component surfaces in authoring, picker, roll, XP, item, template, and sheet CSS have been replaced with semantic theme variables.
- Frontend readability/compactness pass (2026-07-04): raw IDs removed from all user-facing surfaces (access codes, sheet headers, proficiency/selector editors now use names with auto-derived IDs), builder pages gained plain-language subtitles and rewritten helper copy, radius tokens sharpened with nested boxed rows flattened to dividers, and overflowing panel content (authoring editors, catalog lists, non-overview sheet tabs) now flows into horizontal swipe columns instead of vertical scrolling. Presentation-only; no capability or protocol changes.
- Template Builder newcomer pass (2026-07-04): sections are grouped into core setup, optional starting content, advanced customization, and final review; validation is deferred until review; empty states explain safe defaults; derived formulas and the full resistance matrix are progressively disclosed; and contextual creation dialogs now identify the quickest valid path in table-facing language. Presentation-only; backend validation and authoring contracts are unchanged.

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
  Violentmonkey and the production-hosted userscript from the GM **Extension**
  tab, running **Sync Bridge**, opening an active Roll20 editor tab, and
  confirming both the test message and a real authored action reach Roll20
  chat exactly once.

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
    role-filtered string payloads as snapshots for both DMs and assigned players.

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
  - install Violentmonkey and the userscript through the GM Extension tab
  - run Sync Bridge and reload the Roll20 editor page
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
  - confirm Roll20 receives chat output and disconnected bridge failures are visible
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

## 6. Explicit Non-Blockers

These are not required for the app to be usable as the MVP character sheet and authored-action dice roller:

- A custom one-off dice-only roller inside the app. One-off rolls can happen directly in Roll20.
- Automated initiative, turn order, action-point reset, reaction spending, or round lifecycle.
- App-side targeting, token reads, intersheet attack execution, or cross-sheet damage automation.
- Automatic hit-vs-defense comparison, Dodge/Block/Parry contest resolution, counterattacks, or critical consequence automation.
- Automatic level-up stat distribution or mastery/rank unlock enforcement.
- Equipment capacity rules such as slots, hands, one-handed/two-handed restrictions, or weapon-combination validation.
- Overload automation.
- Multi-campaign/account support.
- Syncing data back into Roll20 character sheets.

## 7. Later Roadmap

Future work should be prioritized only after the table-readiness pass proves the MVP workflow.

- [ ] Combat/turn tracking.
- [ ] Overload selected mode and alternative handling.
- [ ] Mastery unlock enforcement and visibility for disabled/hidden content.
- [ ] App-side physical/spell attack resolvers, including defense-derived reductions and critical side effects.
- [ ] Weapon resolver inputs and augmentation-derived attack modifiers beyond independently authored hit/damage actions.
- [ ] Equipment capacity and slot/hand rules.
- [ ] Multi-campaign support and durable player identity/account binding.
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
