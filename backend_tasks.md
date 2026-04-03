# Backend Tasks

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.


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

## Now (Phase 7 Augmentations)
- [ ] Replace item-owned `stat_augmentations` as the long-term effect model with a general backend-owned augmentation system.
- [ ] Model augmentations as applied, reversible effects rather than as item-only stat bonus fields.
- [ ] Give augmentations stable identity plus source metadata so item buffs, poison, ally buffs, and future applied effects can share one backend concept.
- [ ] Move augmentation targeting toward validated backend-owned paths or references instead of stat-name-only fields.
- [ ] Keep augmentation application, removal, stacking, and recomputation backend-authoritative.
- [ ] Add augmentation state to the authoritative sync boundary once the backend shape is ready.
- [ ] Prepare conditional augmentation support without exposing unrestricted raw mutation to clients.
- [ ] Implement augmentation effect hooks for gear, weapon, poison, and allied-buff contexts.
- [ ] Finalize augmentation attachment/update intents for gear and weapon items.

## Next (Phase 8 Intent Migration)
- [ ] Migrate roll submission onto a typed backend route/helper path with backend-authoritative reconciliation only.
- [ ] Define how baseline sheet checks should be represented as default action bridges instead of a dedicated `roll_basic_check` runtime intent.
- [ ] Finalize roll request schema to support quick-roll actions: `attack`, `dodge`, `parry`, `block`.
- [ ] Extend roll request schema for advantage/disadvantage flags.
- [ ] Implement backend roll resolution pipeline for quick-roll actions.
- [ ] Implement weapon/equipment-driven attack modifiers on backend (authoritative; no frontend math).
- [ ] Implement contested resolution hooks for defensive actions (`dodge`, `parry`, `block`) as defined by rules.
- [ ] Add validation/error responses for invalid quick-roll payloads and unauthorized actions.
- [ ] Implement backend handling for advantage/disadvantage roll resolution.
- [ ] Add backend contract tests for roll submission, auth/permission failures, and emitted sync events.
- [ ] Add typed route contracts for sheet admin features now that generic public entity CRUD routes have been removed.
- [ ] Finalize websocket request/response types for typed template edits, sheet updates, bridge operations, and roll actions.
- [ ] Finalize sheet schema for notes and equipment data (instance notes required; GM template notes optional; inventory list only).
- [ ] Define role/permission rules for note edits, equipment edits, and stat/resource adjustments.
- [ ] Define permission enforcement so players cannot directly edit stats/substats.
- [ ] Ensure backend role/permission model supports shared sheet rendering on the GM Console tab with restricted player-visible controls.
- [ ] Model non-CRUD bridge operations as semantic commands (`attach`, `detach`, `link`, `unlink`, `instantiate`) instead of forcing them through generic delete/update semantics.

## Later (Phase 10 Hardening)
- [ ] Add websocket reliability features: reconnect/backoff handling strategy and snapshot resync path.
- [ ] Add idempotency/ordering handling for intent replay or duplicate messages.
- [ ] Add integration tests for snapshot + patch consistency across rapid intent sequences.
- [ ] Add backend coverage for generated-helper metadata and typed route/export consistency once generation expands beyond types.
- [ ] Expand backend websocket contract tests so auth, snapshot, patch, error, and resync coverage stays aligned with the live protocol.
- [ ] Expand backend role-based access tests for DM-only and future typed admin mutations.
- [ ] Finalize schema for damage-type input on health adjustments.
- [ ] Implement damage-type-aware health adjustment handling.
- [ ] Add optional World Anvil item-link field to item schema and IPC update payloads.

## Rules TODOs
- [ ] Confirm exact formulas and modifiers for attack and defensive roll types from rules PDF.
- [ ] Confirm equipment and weapon attribute model needed for backend-calculated attack adjustments.
- [ ] Confirm level-up policy boundaries (manual value edits vs any rule enforcement).
- [ ] Confirm whether super advantage/super disadvantage are valid mechanics in this system.
- [ ] Confirm canonical damage-type set and how each type interacts with health adjustments.
- [ ] Confirm augmentation stacking/interaction rules with existing item and enchantment systems.
- [ ] Confirm conditional augmentation boundaries and evaluation rules for future effects such as weapon-type checks.
