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
   - `direct_effect_projections` (`DirectEffectProjection`) — for every numeric path touched by
     a *direct* effect, remembers `base_value` (value without the projected direct effects) and
     `effective_value` (value with them). Covers **both** equipment and standalone direct
     effects (see `_desired_projected_augmentations`). (Renamed from `equipment_effect_projections`
     in schema v18 — the collection was never equipment-only.)

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
- `AugmentationLifecycle` (`mode`, `remaining`, `expires_at`, `remove_when_source_inactive`,
  `notes`) is **declarative authoring intent**. The backend runs no turn/round/rest engine
  (an explicit product non-goal), so `rounds`/`turns`/`until_rest`/`scene` and `remaining` are
  GM-tracked labels surfaced in the UI, not auto-executed. The only lifecycle behaviour actually
  enforced is source-linked teardown (equipment unequip / condition removal), which the
  equipment/condition derive logic performs regardless of these fields;
  `remove_when_source_inactive` documents that intent for other sources. (Was free-text
  `duration`/`expires_at`/`removal_condition` before schema v21.)

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
3. `_sync_direct_effects` recomputes projections for direct effects (equipment +
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
- The `ActiveCondition` records source/timing metadata: `source` (`ConditionSource` — why it is
  active), `applied_at` (ISO timestamp set at apply time), `applied_by_role`, and
  `applied_at_state_version`. The action-execution path (the only production apply path) fills
  these from the executing action and acting session; the test-only async `apply_condition_preset`
  and any future manual path default to an `other` source.
- `remove_condition_application_mutation` reverses each effect (`_remove_condition_effect_mutation`
  inverts the arithmetic; `set` effects cannot be reversed), removes bridges, augmentations, and
  the `ActiveCondition`.
- A `ConditionPreset` is a **pure definition**: its effects are authored inline as
  `augmentation_templates`, the only field the apply path consumes. (The formerly-parallel,
  unused `ConditionPreset.augmentation_ids` was removed in schema v19 — Change 4. The live
  per-application list lives on `ActiveCondition.augmentation_ids`.)

### Standalone apply / remove
- `apply_standalone_effect_mutation` validates the definition targets an instance, creates a
  `StandaloneEffectApplication`, then runs `synchronize_projected_direct_effects_mutation`.
  Standalone direct effects are projected (like equipment) rather than materialized into
  `state.augmentations`.
- **Stacking** (`StandaloneEffectDefinition.stacking`, schema v22): `unique` (default) keeps one
  application per definition per instance (id `standalone:{instance}:{definition}`; reapply is a
  no-op); `stack` allows multiple concurrent applications (ids `…:s{n}`), capped by `max_stacks`
  (reapply past the cap returns `max_stacks_reached`). Because applications are stateless (the
  augmentation is derived from the definition) and the projection/evaluation paths iterate every
  active application, N stacks accumulate on the same path automatically — no special cumulative
  math. `remove_standalone_effect_mutation` clears the **whole** stack for that definition/instance
  and re-syncs projections. (Note: `refresh`/`replace` reapplication modes and condition stacking
  are not yet implemented — they need per-application lifecycle state / condition multi-application.)

### Delete instance
`delete_instanced_sheet` removes, for the target instance: active conditions, standalone
applications, any augmentation whose `applied_target_id` is the instance or whose
`source.application_id` belonged to a removed application, and sheet access codes — then the
instance itself. (Covered by `test_dm_can_delete_instanced_sheet_and_runtime_dependencies`.)

### Redaction (player snapshots/patches)
`_redact_state_for_role` (state-sync) drops: gm-only attributes and condition presets; active
conditions that are gm-only or belong to another instance; standalone applications for other
instances; condition-owned augmentations whose application is not player-visible; and it strips
`direct_effect_projections` entirely (`PRIVATE_STATE_ROOTS`). `to_dict(include_private=False)`
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
| `direct_effect_projections` | **Derived** | `_sync_direct_effects` |

Derived collections must never be authored directly and should always be reproducible from the
truth collections plus the current stored values.
