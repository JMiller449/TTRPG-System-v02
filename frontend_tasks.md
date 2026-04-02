# Frontend Tasks

Use this file for frontend-only and frontend-scaffold TODO work. Keep items short and actionable.

## Status Note
- Backend is not finished; schema and IPC contracts are incomplete.
- Do not invent behavior when rules/contracts are unclear. Add a TODO instead.
- Use [backend_takeover.md](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/backend_takeover.md) as the integration umbrella for multi-session frontend/backend migration work.
- Decisions locked:
  - Notes: player notes are per sheet instance; GM may optionally store notes on templates too.
  - Equipment UI: inventory-list only, no slot-based layout.
  - Quick-roll actions (`attack`, `dodge`, `parry`, `block`) should prefill roll composer, not auto-submit.
  - Active sheet selection is frontend-local UI state.
  - Roll20 chat is the play log; do not rebuild in-app authoritative roll history.

## Now (Frontend Scaffolding)
- [ ] Separate GM creation flows for sheets, items, and abilities, then provide a dedicated sheet viewer mode.

## Next (Frontend Quality + Test Scaffolding)
- [ ] Add frontend test scaffolding: reducer tests, mock transport event handling tests, and core sheet interaction tests.
- [ ] Add accessibility pass scaffold (focus states, labels, keyboard navigation checks for sheet/resource editors).
- [ ] Add mobile layout refinement pass for player character sheet and GM encounter/template panels.
- [ ] Add augmentation builder UI scaffold.
- [ ] Add UI flow to attach augmentations to gear and weapons.
- [ ] Explore GM console overlay mode (cheat-engine style) for fast page switching and encounter spawn actions.
- [ ] Add TODO-gated UI options for super advantage/super disadvantage only if rules confirm they exist.

## Later (Frontend ↔ Backend Integration)
- [ ] Treat `backend_takeover.md` Phase 3 and Phase 6 as the active integration checklist for transport cleanup and direct backend patch adoption.
- [ ] Replace handwritten feature-level websocket request builders with generated or centralized typed route helpers as backend route contracts stabilize.
- [ ] Adapt the frontend patch applier to the backend-native patch dialect instead of maintaining app-shaped patch ops.
- [ ] Scaffold stat/resource update intents so character sheet modifiers are represented in backend transport contracts.
- [ ] Replace mock transport placeholder roll outputs with backend-authoritative roll/chat handling.
- [ ] Add global sync conflict/recovery UX for backend snapshot resync and rejected intents.
- [ ] Add Roll20 chat bridge status / send-failure UX if player/GM visibility needs it.
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
