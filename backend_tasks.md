# Backend Tasks

Use this file for backend and rules-engine TODO work. Keep items short and actionable.

## Status Note
- Current backend schemas/contracts are incomplete.
- `reference-docs/Chip TTRPG System_2-20-26.pdf` is highest authority for behavior conflicts.
- Decisions locked:
  - Notes: authoritative schema should support sheet-instance notes; GM template-level notes optional.
  - Equipment: inventory-list model only (no slot-equipping model for now).
  - Quick-roll actions should support prefill-driven composer flow on frontend.

## Now (Backend Foundation)
- [ ] Finalize sheet schema for notes and equipment data (instance notes required; GM template notes optional; inventory list only).
- [ ] Finalize roll intent/request schema to support quick-roll actions: `attack`, `dodge`, `parry`, `block`.
- [ ] Define role/permission rules for note edits, equipment edits, and stat/resource adjustments.
- [ ] Finalize websocket request/response types for template edits, sheet updates, and roll actions.

## Next (Rules + Resolution)
- [ ] Implement backend roll resolution pipeline for quick-roll actions.
- [ ] Implement weapon/equipment-driven attack modifiers on backend (authoritative; no frontend math).
- [ ] Implement contested resolution hooks for defensive actions (`dodge`, `parry`, `block`) as defined by rules.
- [ ] Add validation/error responses for invalid quick-roll payloads and unauthorized actions.

## Later (Reliability + Integration)
- [ ] Add websocket reliability features: reconnect/backoff handling strategy and snapshot resync path.
- [ ] Add idempotency/ordering handling for intent replay or duplicate messages.
- [ ] Add integration tests for snapshot + patch consistency across rapid intent sequences.

## Rules TODOs
- [ ] Confirm exact formulas and modifiers for attack and defensive roll types from rules PDF.
- [ ] Confirm equipment and weapon attribute model needed for backend-calculated attack adjustments.
- [ ] Confirm level-up policy boundaries (manual value edits vs any rule enforcement).
