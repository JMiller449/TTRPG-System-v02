# Frontend Tasks

Use this file for frontend-only and frontend-scaffold TODO work. Keep items short and actionable.

## Status Note
- Backend is not finished; schema and IPC contracts are incomplete.
- Do not invent behavior when rules/contracts are unclear. Add a TODO instead.
- Decisions locked:
  - Notes: player notes are per sheet instance; GM may optionally store notes on templates too.
  - Equipment UI: inventory-list only, no slot-based layout.
  - Quick-roll actions (`attack`, `dodge`, `parry`, `block`) should prefill roll composer, not auto-submit.

## Now (Frontend Scaffolding)
- [x] Add player notes notepad UI in character sheet (`Notes` becomes editable multiline text field).
- [x] Add equipment UI scaffold as inventory list only (no slot model) without frontend-side gameplay math.
- [x] Add manual level-up page/panel scaffold for direct stat/value edits (no automatic level progression tracking).
- [x] Add quick-roll buttons for `attack`, `dodge`, `parry`, and `block` in player and GM flows.
- [x] Add roll composer shortcuts so quick-roll actions prefill roll context cleanly (no immediate submit).
- [x] Remove direct stat editing from player sheet UI.
- [x] Remove direct substat editing from player sheet UI.
- [x] Add damage-type dropdown to player Health + / - controls.
- [x] Add GM-facing substat modifier controls in sheet view.
- [x] Add roll composer controls for advantage and disadvantage.
- [x] Unify GM Console tab sheet view and player sheet view into one shared page/component with role-based visibility.
- [ ] Separate GM creation flows for sheets, items, and abilities, then provide a dedicated sheet viewer mode.
- [x] On the GM Console tab specifically, use the same sheet UI for GM view/edit and player view modes to avoid desync across duplicated views.
- [x] Extract active sheet/template/stat merge logic from `PlayerCharacterSheet` into `useSheetDetailState`.
- [x] Extract stat modifier editor state/handlers from `PlayerCharacterSheet` into `useStatModifierEditor`.
- [x] Extract resource editor state/handlers from `PlayerCharacterSheet` into `useResourceEditor` (health/mana active value + damage type UI state).
- [x] Add shared sheet selectors in `frontend/src/app/state/selectors/` for repeated derivations used across pages (active sheet detail, active weapon label, player-only sheet list).
- [x] Split `frontend/src/app/state/reducer.ts` into domain reducer modules (`connection`, `templates`, `instances`, `encounters`, `items`, `sheetLocalState`, `rolls`, `ui`) and compose them in a root reducer.
- [x] Remove stale duplicate sheet UI path by deleting or hard-deprecating `frontend/src/features/sheets/SheetDetail.tsx` and keeping `PlayerCharacterSheet` as the single rendered sheet component.
- [x] Decompose `frontend/src/features/items/ItemMakerPage.tsx` into reusable components (`ItemEditorForm`, `ItemTemplateList`, `ItemTemplateCard`) plus pure mapper/validation helpers.
- [x] Decompose `frontend/src/features/sheets/TemplateLibrary.tsx` into modules (`TemplateSearchBar`, `TemplateList`, `TemplateListItem`, `TemplateEditPanel`) and move template parse/serialize helpers into a dedicated utility.
- [x] Decompose `frontend/src/features/encounters/EncounterPanel.tsx` into encounter-form components (`EncounterEntryRow`, `EncounterEntryList`, `EncounterPresetList`) with pure intent payload builders.
- [x] Move intent payload construction (`create_template`, `instantiate_template`, `save_encounter`, `spawn_encounter`, `set_active_sheet`) out of view components into feature-level `intentBuilders.ts` modules.
- [x] Consolidate duplicated stat metadata between `frontend/src/features/sheets/sheetDisplay.ts` and `frontend/src/domain/stats.ts` into one canonical source consumed by sheet + roll composer UIs.
- [x] Split `frontend/src/styles.css` into feature-scoped style files (`app.css`, `sheet.css`, `rolls.css`, `items.css`, `encounters.css`) while keeping shared tokens/utilities centralized.

## Next (Frontend Quality + Test Scaffolding)
- [ ] Add frontend test scaffolding: reducer tests, mock transport event handling tests, and core sheet interaction tests.
- [ ] Add accessibility pass scaffold (focus states, labels, keyboard navigation checks for sheet/resource editors).
- [ ] Add mobile layout refinement pass for player character sheet and GM encounter/template panels.
- [ ] Add augmentation builder UI scaffold.
- [ ] Add UI flow to attach augmentations to gear and weapons.
- [ ] Explore GM console overlay mode (cheat-engine style) for fast page switching and encounter spawn actions.
- [ ] Add TODO-gated UI options for super advantage/super disadvantage only if rules confirm they exist.

## Later (Frontend ↔ Backend Integration)
- [ ] Finalize frontend IPC v1 contract map in `frontend/src/domain/ipc.ts` to match backend request/patch payloads.
- [ ] Gate GM console access on backend auth acknowledgement (replace optimistic local enablement with server-verified flow).
- [ ] Scaffold stat/resource update intents so character sheet modifiers are represented in backend transport contracts.
- [ ] Replace mock transport placeholder roll outputs with backend-authoritative roll/state patch handling.
- [ ] Add global sync conflict/recovery UX for backend snapshot resync and rejected intents.
- [ ] Add GM roll-log moderation UI (clean/revoke entries) as explicit scope-creep backlog.
- [ ] Add Item Maker support for GM-provided World Anvil item links (entry field + sheet/equipment display link handling).

## Rules TODOs
- [ ] Clarify whether frontend-entered stat/resource modifiers should be additive, replace-value, or formula-driven in backend outcomes.
  Reference: `reference-docs/Chip TTRPG System_2-20-26.pdf` pages 3-6, 10, 14.
- [ ] Clarify whether player-side stat/resource adjustments are GM-only actions or allowed for players directly.
  Reference: `reference-docs/Chip TTRPG System_2-20-26.pdf` pages 8-10.
- [ ] Clarify notes/equipment persistence ownership and update permissions (player vs GM) for authoritative sync.
- [ ] Clarify quick-roll payload requirements for `attack`/`dodge`/`parry`/`block` intents.
- [ ] Clarify exact roll equation display terms (dice expression + stat/action modifiers) for frontend composer preview.
- [ ] Clarify whether super advantage/super disadvantage exist and should be surfaced in UI controls.
- [ ] Clarify damage-type list and wording for Health + / - interactions.
- [ ] Clarify augmentation UX boundaries on frontend (what is editable vs display-only) for weapon/gear augments.
