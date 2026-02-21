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

## Next (Frontend Quality + Test Scaffolding)
- [ ] Add frontend test scaffolding: reducer tests, mock transport event handling tests, and core sheet interaction tests.
- [ ] Add accessibility pass scaffold (focus states, labels, keyboard navigation checks for sheet/resource editors).
- [ ] Add mobile layout refinement pass for player character sheet and GM encounter/template panels.

## Later (Frontend ↔ Backend Integration)
- [ ] Finalize frontend IPC v1 contract map in `frontend/src/domain/ipc.ts` to match backend request/patch payloads.
- [ ] Gate GM console access on backend auth acknowledgement (replace optimistic local enablement with server-verified flow).
- [ ] Scaffold stat/resource update intents so character sheet modifiers are represented in backend transport contracts.
- [ ] Replace mock transport placeholder roll outputs with backend-authoritative roll/state patch handling.
- [ ] Add global sync conflict/recovery UX for backend snapshot resync and rejected intents.

## Rules TODOs
- [ ] Clarify whether frontend-entered stat/resource modifiers should be additive, replace-value, or formula-driven in backend outcomes.
  Reference: `reference-docs/Chip TTRPG System_2-20-26.pdf` pages 3-6, 10, 14.
- [ ] Clarify whether player-side stat/resource adjustments are GM-only actions or allowed for players directly.
  Reference: `reference-docs/Chip TTRPG System_2-20-26.pdf` pages 8-10.
- [ ] Clarify notes/equipment persistence ownership and update permissions (player vs GM) for authoritative sync.
- [ ] Clarify quick-roll payload requirements for `attack`/`dodge`/`parry`/`block` intents.
- [ ] Clarify exact roll equation display terms (dice expression + stat/action modifiers) for frontend composer preview.
