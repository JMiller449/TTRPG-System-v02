# Frontend Completed

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.


Use this file as the completion log for frontend tasks moved out of `frontend_tasks.md`.
Record entries with a date and a short summary.

## 2026-02-20
- Created contributor/policy documentation baseline (`AGENTS.md`, policy docs, task workflow files).
- Scaffolded React/Vite frontend architecture with typed state, transport abstractions, and mock/ws adapters.
- Implemented session landing flow, GM/password entry gate, and player entry flow (select/create player before console).
- Implemented GM console scaffolding (templates, encounters, tabs, roll panel) and player console scaffolding.
- Refactored player console into consolidated character-sheet style layout.
- Added reusable template create/edit form scaffold (`name/notes/tags/core stats`) and wired template updates.
- Expanded encounter preset builder to support multi-entry rosters.
- Added player-console roll composer scaffold inside the roll-log panel.
- Added local intent lifecycle feedback banners for pending/success/error states.
- Improved character-sheet modifier UX with clearer edit affordances, keyboard hints, and validation hints.
- Added frontend lint/format scaffolding (`eslint`, `prettier`, config files, npm scripts).
- Split active tasks into `frontend_tasks.md` and `backend_tasks.md`; retired `Tasks.md`.
- Added new scoped TODOs for notes notepad, equipment UI, level-up manual edit page, and quick-roll action support.
- Implemented player notes notepad as editable multiline field in character sheet.
- Implemented equipment inventory-list scaffolding (add/remove items, set/clear active weapon) for active sheets.
- Implemented manual level-up editor panel for direct stat value overrides (local scaffold state).
- Implemented quick-roll buttons (`attack`, `dodge`, `parry`, `block`) in GM and player roll composers.
- Implemented quick-roll prefill behavior (context prefills; no immediate submit).
- Added roll equation preview blocks to GM/player roll composers using explicit TODO placeholders (no invented rule math).

## 2026-02-23
- Add player notes notepad UI in character sheet (`Notes` becomes editable multiline text field).
- Add equipment UI scaffold as inventory list only (no slot model) without frontend-side gameplay math.
- Add manual level-up page/panel scaffold for direct stat/value edits (no automatic level progression tracking).
- Add quick-roll buttons for `attack`, `dodge`, `parry`, and `block` in player and GM flows.
- Add roll composer shortcuts so quick-roll actions prefill roll context cleanly (no immediate submit).
- Remove direct stat editing from player sheet UI.
- Remove direct substat editing from player sheet UI.
- Add damage-type dropdown to player Health + / - controls.
- Add GM-facing substat modifier controls in sheet view.
- Add roll composer controls for advantage and disadvantage.
- Unify GM Console tab sheet view and player sheet view into one shared page/component with role-based visibility.
- On the GM Console tab specifically, use the same sheet UI for GM view/edit and player view modes to avoid desync across duplicated views.
- Extract active sheet/template/stat merge logic from `PlayerCharacterSheet` into `useSheetDetailState`.
- Extract stat modifier editor state/handlers from `PlayerCharacterSheet` into `useStatModifierEditor`.
- Extract resource editor state/handlers from `PlayerCharacterSheet` into `useResourceEditor` (health/mana active value + damage type UI state).
- Add shared sheet selectors in `frontend/src/app/state/selectors/` for repeated derivations used across pages (active sheet detail, active weapon label, player-only sheet list).
- Split `frontend/src/app/state/reducer.ts` into domain reducer modules (`connection`, `templates`, `instances`, `encounters`, `items`, `sheetLocalState`, `rolls`, `ui`) and compose them in a root reducer.
- Remove stale duplicate sheet UI path by deleting or hard-deprecating `frontend/src/features/sheets/SheetDetail.tsx` and keeping `PlayerCharacterSheet` as the single rendered sheet component.
- Decompose `frontend/src/features/items/ItemMakerPage.tsx` into reusable components (`ItemEditorForm`, `ItemTemplateList`, `ItemTemplateCard`) plus pure mapper/validation helpers.
- Decompose `frontend/src/features/sheets/TemplateLibrary.tsx` into modules (`TemplateSearchBar`, `TemplateList`, `TemplateListItem`, `TemplateEditPanel`) and move template parse/serialize helpers into a dedicated utility.
- Decompose `frontend/src/features/encounters/EncounterPanel.tsx` into encounter-form components (`EncounterEntryRow`, `EncounterEntryList`, `EncounterPresetList`) with pure intent payload builders.
- Move intent payload construction (`create_template`, `instantiate_template`, `save_encounter`, `spawn_encounter`, `set_active_sheet`) out of view components into feature-level `intentBuilders.ts` modules.
- Consolidate duplicated stat metadata between `frontend/src/features/sheets/sheetDisplay.ts` and `frontend/src/domain/stats.ts` into one canonical source consumed by sheet + roll composer UIs.
- Split `frontend/src/styles.css` into feature-scoped style files (`app.css`, `sheet.css`, `rolls.css`, `items.css`, `encounters.css`) while keeping shared tokens/utilities centralized.

## 2026-04-02
- Moved raw websocket JSON parsing and protocol event normalization into a dedicated ws-layer client wrapper and added wrapper-level tests for snapshot, patch, and invalid payload handling.
- Finished Phase 4 server-state coverage for backend-authoritative items, actions, and formulas, and repointed the live equipment flow at backend-backed item data while leaving the old item-maker scaffold parked as non-authoritative code.
- Finished Phase 6 by removing the frontend-only app patch dialect, keeping one canonical backend-native patch applier in the websocket wrapper, and adding sync tests for initial snapshot, incremental patch, and forced resync.
