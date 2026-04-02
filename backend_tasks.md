# Backend Tasks

Use this file for backend and rules-engine TODO work. Keep items short and actionable.

## Status Note
- Current backend schemas/contracts are incomplete.
- `reference-docs/Chip TTRPG System_2-20-26.pdf` is highest authority for behavior conflicts.
- Use [backend_takeover.md](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/backend_takeover.md) as the active migration plan for websocket contract, state ownership, and frontend/backend integration sequencing.
- Decisions locked:
  - Notes: authoritative schema should support sheet-instance notes; GM template-level notes optional.
  - Equipment: inventory-list model only (no slot-equipping model for now).
  - Quick-roll actions should support prefill-driven composer flow on frontend.
  - Active sheet selection is frontend-local, not backend-authoritative.
  - Roll20 chat is the effective play log; do not build new backend-owned roll-log authority unless requirements change.
  - `state_sync` raw path mutation helpers are internal primitives, not the public client API.

## Now (Backend Foundation)
- [ ] Finalize sheet schema for notes and equipment data (instance notes required; GM template notes optional; inventory list only).
- [ ] Define how baseline sheet checks should be represented as default action bridges instead of a dedicated `roll_basic_check` runtime intent.
- [ ] Finalize roll intent/request schema to support quick-roll actions: `attack`, `dodge`, `parry`, `block`.
- [ ] Define role/permission rules for note edits, equipment edits, and stat/resource adjustments.
- [ ] Replace generic public `create_entity` / `update_entity` / `delete_entity` contracts with typed route contracts for sheet admin features.
- [ ] Add registry metadata needed for generated frontend helper functions from route declarations.
- [ ] Finalize websocket request/response types for typed template edits, sheet updates, bridge operations, and roll actions.
- [ ] Finalize augmentation schema for gear/weapon augmentation data.
- [ ] Finalize augmentation attachment/update intents for gear and weapon items.
- [ ] Extend roll request schema for advantage/disadvantage flags.
- [ ] Define permission enforcement so players cannot directly edit stats/substats.
- [ ] Ensure backend role/permission model supports shared sheet rendering on the GM Console tab with restricted player-visible controls.
- [ ] Finalize schema for damage-type input on health adjustments.
- [ ] Add optional World Anvil item-link field to item schema and IPC update payloads.

## Next (Rules + Resolution)
- [ ] Implement backend roll resolution pipeline for quick-roll actions.
- [ ] Implement weapon/equipment-driven attack modifiers on backend (authoritative; no frontend math).
- [ ] Implement contested resolution hooks for defensive actions (`dodge`, `parry`, `block`) as defined by rules.
- [ ] Add validation/error responses for invalid quick-roll payloads and unauthorized actions.
- [ ] Implement backend handling for advantage/disadvantage roll resolution.
- [ ] Implement damage-type-aware health adjustment handling.
- [ ] Implement augmentation effect resolution hooks for gear/weapon contexts.
- [ ] Model non-CRUD bridge operations as semantic commands (`attach`, `detach`, `link`, `unlink`, `instantiate`) instead of forcing them through generic delete/update semantics.

## Later (Reliability + Integration)
- [ ] Add websocket reliability features: reconnect/backoff handling strategy and snapshot resync path.
- [ ] Add idempotency/ordering handling for intent replay or duplicate messages.
- [ ] Add integration tests for snapshot + patch consistency across rapid intent sequences.
- [ ] Add backend coverage for generated-helper metadata and typed route/export consistency once generation expands beyond types.

## Rules TODOs
- [ ] Confirm exact formulas and modifiers for attack and defensive roll types from rules PDF.
- [ ] Confirm equipment and weapon attribute model needed for backend-calculated attack adjustments.
- [ ] Confirm level-up policy boundaries (manual value edits vs any rule enforcement).
- [ ] Confirm whether super advantage/super disadvantage are valid mechanics in this system.
- [ ] Confirm canonical damage-type set and how each type interacts with health adjustments.
- [ ] Confirm augmentation stacking/interaction rules with existing item and enchantment systems.
