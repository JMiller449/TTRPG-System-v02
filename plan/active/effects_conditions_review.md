# Effects & Conditions System Review

Tracking doc for the effects/conditions cleanup. Source: `effects_conditions_review_plan.md`
(external review). Linked from `plan/active/PLAN.md`.

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first
> contract model, protocol/codegen workflow, and implementation rules. This is a
> conceptual-cleanup effort: do earlier phases fully before later ones, and do not add
> behavior/schema/UI change before its tests and documentation land.

## Target principle

> Conditions are named gameplay states. Effects are mechanical modifiers. Applications are
> runtime instances of those effects. Equipment, actions, and conditions are different
> sources of effect applications.

## Current-state findings (verified 2026-07-08)

These ground the plan in what already exists so we don't re-solve solved problems.

- `Augmentation` (`backend/state/models/augmentation.py`) is already the single core runtime
  modifier. Conditions, equipment, and standalone effects all *project* into
  `state.augmentations` and/or `state.equipment_effect_projections`. The "unified runtime
  layer" (Change 1) is therefore largely a **rename/reframe**, not a rebuild.
- `ConditionPreset` carries **both** `augmentation_ids` (legacy, unused by the apply path)
  and `augmentation_templates` (what apply actually uses). `augmentation_ids` is dead weight
  → Change 4.
- `AugmentationLifecycle` is explicitly descriptive-only (`duration`, `expires_at`,
  `removal_condition`); no executable lifecycle or stacking model exists. Application IDs
  (`standalone:{instance}:{definition}`, `condition:{condition}:{instance}`) enforce
  one-application-per-source-per-instance → basis for Change 5 (lifecycle) and stacking.
- `equipment_effect_projections` is already fed by **both** equipment and standalone direct
  effects (`_desired_projected_augmentations`), and is private/redacted. Its name is stale
  → Change 3.
- Cleanup is already robust and tested: `delete_instanced_sheet` clears
  conditions/effects/augmentations/access codes; condition removal reverses effects;
  equipment sync tears down on unequip; standalone removal restores projected values.
- Direct vs evaluation-time vs roll-mode effects already exist as three distinct effect
  types (`FormulaModifierEffect`, `EvaluationFormulaModifierEffect`, `RollModeModifierEffect`)
  → Change 6 is mostly a UI-authoring clarification, not a model change.

### Existing test coverage (do not duplicate)
- condition apply/remove — `test_augmentation_service.py`
- standalone apply/remove — `test_standalone_effects.py`
- equip/unequip lifecycle, per-instance isolation, failed-equip rollback — `test_augmentation_service.py`
- direct projection base restoration + recompute-from-stable-base — `test_standalone_effects.py`, `test_augmentation_service.py`
- duplicate-application idempotency (conditions + standalone) — both files
- delete-instance cleanup — `test_sheet_admin_sheets.py::test_dm_can_delete_instanced_sheet_and_runtime_dependencies`
- player-snapshot redaction of gm-only / unassigned effects — `test_standalone_effects.py`, `test_augmentation_service.py`

---

## Phase 1 — Tests & Documentation (no behavior change)  ← MOSTLY DONE

- [x] Write current-pipeline architecture doc (`backend/features/augmentations/ARCHITECTURE.md`):
      three layers (definitions / runtime applications / derived projections); the equip/unequip,
      condition apply/remove, standalone apply/remove, delete-instance, redaction, and
      export/import flows; source-of-truth vs derived table.
- [x] Gap test: export → import round-trip with active conditions, standalone applications,
      and direct projections leaves **no orphaned** modifiers and identical effective values.
      → `test_augmentation_service.py::test_export_import_round_trip_leaves_no_orphaned_effects`.
- [x] Gap test: equipment effect + standalone effect targeting the **same** numeric path
      stack and unwind predictably (apply both, remove one, remove other → base restored).
      → `test_augmentation_service.py::test_equipment_and_standalone_direct_effects_share_path_and_unwind`.
- [x] Change-base-while-active case already covered by
      `test_standalone_effects.py::test_definition_update_recomputes_from_base_and_preserves_external_edits`
      (base edited to 17 mid-effect, recomputed, then removed → external delta preserved).
- [x] Relevant suites green: augmentation service/model, standalone effects, condition presets,
      sheet admin sheets (87 passed).
- [x] Full backend suite run: 448 passed. The 6 remaining failures
      (`test_state_store` x4, `test_action_history`, `test_protocol_codegen`) are **pre-existing
      on `main`** (verified by stashing this branch's changes) — stale checked-in codegen and
      local checkpoint-write tests — and are unrelated to this work. A further 3 (`test_dev_seed`,
      `test_dm_examples_acceptance`, `test_ws`) only fail under the tool sandbox that blocks
      writing checkpoints to the repo root and pass with the sandbox disabled.
- [ ] (Follow-up, out of scope for this effort) Regenerate checked-in TS codegen and investigate
      the pre-existing `test_state_store` failures — likely to block Phase 2's rename migration
      test, which touches the same persistence path.

## Phase 2 — Internal rename & cleanup

- [ ] Rename `equipment_effect_projections` → `direct_effect_projections` (state field,
      `EquipmentEffectProjection` → `DirectEffectProjection`, `_equipment_projection_path`,
      `PRIVATE_STATE_ROOTS`, `to_dict` redaction, protocol/state_schema). Add schema
      migration v17→v18 that renames the persisted key.
- [ ] Rename equipment-only-flavored helpers that are now general
      (`_sync_equipment_direct_effects` → `_sync_direct_effects`, etc.).
- [ ] Document which runtime collections are source-of-truth vs derived (in ARCHITECTURE.md).
- [ ] Regenerate protocol types (`just codegen` / documented workflow); frontend consumers
      of the renamed field/types updated.

## Phase 3 — Unified runtime application layer (reframe)

- [ ] Decide naming: keep `Augmentation` internally vs introduce `EffectApplication` alias.
      (See Change 2 — user-facing rename is separate from the internal model.)
- [ ] Make `ConditionPreset` a pure definition (Change 4): drop unused `augmentation_ids`
      from the apply path; keep `augmentation_templates` as the inline effect source. Add
      migration to strip the dead field. Decide inline-templates vs shared-definition refs.
- [ ] Add source/timing metadata to `ActiveCondition` (Change 5 fields: `source`,
      `applied_at`, `applied_by_role`, `applied_at_state_version`) as persisted, redaction-safe fields.
- [ ] Compatibility migration for existing `active_conditions` / `standalone_effect_applications`.

## Phase 4 — Lifecycle & stacking

- [ ] Make lifecycle executable OR explicitly label notes-only (Change 5): lifecycle
      `mode` enum (`manual|rounds|turns|until_rest|until_source_removed|scene`), `remaining`,
      `remove_when_source_inactive`.
- [ ] Add stacking model (`mode: unique|stack|refresh|replace`, `stack_key`, `max_stacks`).
- [ ] GM controls for refresh / remove / expire.

## Phase 5 — UI review

- [ ] Rename user-facing "Augmentation" → "Effect" in authoring/UI (Change 2).
- [ ] Separate direct / evaluation-time / roll-mode effects in the authoring editor (Change 6).
- [ ] Active Effects inspector: name, source, target, visibility, duration, stack count,
      remove/expire controls (Change 8).
- [ ] Player-safe active condition/effect display.
- [ ] Audit-log entries for effect lifecycle events (Change 9) — action history already exists.

## Cleanup invariants to guarantee (Change 7 — assert across phases)

- [ ] Deleting an instance removes all attached conditions/effects/projections/access codes. *(exists; keep covered)*
- [ ] Removing a condition removes condition-owned effects. *(exists)*
- [ ] Unequipping an item removes equipment-owned effects. *(exists)*
- [ ] Deleting an effect/condition definition fails safely if active, or cascades intentionally. *(partially exists — verify)*
- [ ] Import/export cannot leave orphaned active effects. *(Phase 1 gap test)*
