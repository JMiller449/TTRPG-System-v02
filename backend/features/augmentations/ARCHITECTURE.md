# Effects & Conditions Runtime Architecture

Current-state reference for the effects/conditions pipeline, written for the phased cleanup
tracked in `plan/active/effects_conditions_review.md`. This documents **what exists today**;
naming here matches the code, not the review plan's proposed future names.

## Three layers

1. **Definitions** (authoring-time, DM-owned, persisted, reusable):
   - `ConditionPreset` — a named gameplay state (`condition_presets`).
   - `StandaloneEffectDefinition` — an action/manual-controlled effect (`standalone_effects`).
   - Item `augmentation_templates` — effect templates carried on an `Item`.
   - A manually-authored `Augmentation` with `lifecycle_owner="manual"`.

2. **Runtime applications** (source-of-truth for "what is active right now"):
   - `ActiveCondition` (`active_conditions`) — one per applied condition per instance.
   - `StandaloneEffectApplication` (`standalone_effect_applications`) — one per applied
     standalone effect per instance.
   - `Augmentation` records in `state.augmentations` — the **concrete** modifiers. Condition
     and equipment sources materialize concrete augmentations here; standalone effects do
     **not** (they stay as applications and are projected directly — see below).

3. **Derived projections** (bookkeeping, private/redacted, never authored):
   - `equipment_effect_projections` (`EquipmentEffectProjection`) — for every numeric path
     touched by a *direct* effect, remembers `base_value` (value without the projected direct
     effects) and `effective_value` (value with them). Despite the name it covers **both**
     equipment and standalone direct effects (see `_desired_projected_augmentations`).

## The single core model: `Augmentation`

`Augmentation` (`backend/state/models/augmentation.py`) is the one modifier shape. Everything
else is a source that produces or references augmentations. Key fields:

- `source: AugmentationSource` — `type` (`item|action|spell|condition|ally_effect|manual|other`),
  plus `id`, `label`, `relationship_id`, `application_id` linking back to the owning application.
- `lifecycle_owner: manual|equipment|condition|action` — decides which sync path owns it.
- `target: AugmentationTarget` — `root` (`state|sheet|instance`) + `path`. `state` root is not
  yet supported at runtime; targets are validated against the variable registry.
- `effect` is one of three kinds:
  - `FormulaModifierEffect` — **direct**: mutates the stored numeric value while active.
  - `EvaluationFormulaModifierEffect` — **evaluation-time**: modifies formulas/rolls only
    during evaluation; never mutates stored state.
  - `RollModeModifierEffect` — advantage/disadvantage during evaluation.
- `AugmentationLifecycle` (`duration`, `expires_at`, `removal_condition`) is **descriptive
  metadata only** — no predicate is executed.

Direct effects go through the projection system. Evaluation-time and roll-mode effects are
gathered on demand by `matching_evaluation_effects` and applied inside formula evaluation.

## Runtime flows

### Equip / unequip
`synchronize_equipment_augmentations_mutation(state)` (invoked by the state-sync mutation hook):
1. `_desired_equipment_augmentations` scans every instance's equipped, in-stock equippable
   items and builds concrete augmentations (id `equipment:{hash}`, `lifecycle_owner="equipment"`,
   `applied=True`). Sheet-root templates are rewritten to instance root/scope.
2. Existing equipment-owned augmentations not in the desired set are removed, along with their
   instance `augments` bridges.
3. `_sync_equipment_direct_effects` recomputes projections for direct effects (equipment +
   standalone) from a stable base and writes `set` ops only where the effective value changed.

Unequip is just the desired set shrinking → augmentation + bridge removal + projection teardown,
restoring the base value.

### Condition apply / remove
- `apply_condition_preset_mutation` creates one `ActiveCondition` and, for each
  `augmentation_template`, builds a concrete condition-owned `Augmentation`
  (id `condition:{condition}:{instance}:{template}`), adds an instance `augments` bridge, and
  calls `_apply_condition_effect_mutation`. **Direct** condition effects mutate the stored value
  immediately (they are *not* part of the projection system); evaluation-time ones just flip
  `applied=True`.
- `remove_condition_application_mutation` reverses each effect (`_remove_condition_effect_mutation`
  inverts the arithmetic; `set` effects cannot be reversed), removes bridges, augmentations, and
  the `ActiveCondition`.
- Note: `ConditionPreset.augmentation_ids` is **legacy/unused** by the apply path — only
  `augmentation_templates` is consumed. (Slated for removal in the cleanup, Change 4.)

### Standalone apply / remove
- `apply_standalone_effect_mutation` validates the definition targets an instance, creates a
  `StandaloneEffectApplication` (id `standalone:{instance}:{definition}`, idempotent per
  instance), then runs `synchronize_projected_direct_effects_mutation`. Standalone direct effects
  are projected (like equipment) rather than materialized into `state.augmentations`.
- `remove_standalone_effect_mutation` drops the application and re-syncs projections, restoring
  the value.

### Delete instance
`delete_instanced_sheet` removes, for the target instance: active conditions, standalone
applications, any augmentation whose `applied_target_id` is the instance or whose
`source.application_id` belonged to a removed application, and sheet access codes — then the
instance itself. (Covered by `test_dm_can_delete_instanced_sheet_and_runtime_dependencies`.)

### Redaction (player snapshots/patches)
`_redact_state_for_role` (state-sync) drops: gm-only attributes and condition presets; active
conditions that are gm-only or belong to another instance; standalone applications for other
instances; condition-owned augmentations whose application is not player-visible; and it strips
`equipment_effect_projections` entirely (`PRIVATE_STATE_ROOTS`). `to_dict(include_private=False)`
also omits projections and access codes.

### Export / import
Export serializes the full private state; import runs schema migration, rebuilds via
`State.from_dict`, then `synchronize_equipment_augmentations_mutation` to reconcile. Because
projections store a stable base, a rebuilt state re-syncs to a no-op — no orphaned or
double-applied modifiers. (Covered by `test_export_import_round_trip_leaves_no_orphaned_effects`.)

## Source-of-truth vs derived

| Collection | Kind | Owner / regenerated by |
|---|---|---|
| `condition_presets`, `standalone_effects`, `items` | Definition (truth) | DM authoring |
| `active_conditions` | Application (truth) | condition apply/remove |
| `standalone_effect_applications` | Application (truth) | standalone apply/remove |
| `augmentations` (manual) | Truth | DM authoring |
| `augmentations` (condition) | Truth (materialized) | condition apply/remove |
| `augmentations` (equipment) | **Derived** | `synchronize_equipment_augmentations_mutation` |
| `equipment_effect_projections` | **Derived** | `_sync_equipment_direct_effects` |

Derived collections must never be authored directly and should always be reproducible from the
truth collections plus the current stored values.
