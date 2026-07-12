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
  `state.augmentations` and/or `state.direct_effect_projections` (renamed from
  `equipment_effect_projections` in Phase 2). The "unified runtime layer" (Change 1) is
  therefore largely a **rename/reframe**, not a rebuild.
- `ConditionPreset` formerly carried **both** `augmentation_ids` (legacy, unused by the apply
  path) and `augmentation_templates` (what apply actually uses). The dead `augmentation_ids` was
  removed in Phase 3 (Change 4, schema v19); `augmentation_templates` is now the sole effect
  source. (`ActiveCondition.augmentation_ids` — the live per-application list — is unchanged.)
- `AugmentationLifecycle` is explicitly descriptive-only (`duration`, `expires_at`,
  `removal_condition`); no executable lifecycle or stacking model exists. Application IDs
  (`standalone:{instance}:{definition}`, `condition:{condition}:{instance}`) enforce
  one-application-per-source-per-instance → basis for Change 5 (lifecycle) and stacking.
- `direct_effect_projections` (was `equipment_effect_projections`) is fed by **both** equipment
  and standalone direct effects (`_desired_projected_augmentations`), and is private/redacted.
  The stale name motivated Change 3 (done in Phase 2).
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
- [x] Gap test: private-state serialization round trip with active conditions, standalone
      applications, and direct projections leaves **no orphaned** modifiers, identical effective
      values, and can still fully unwind after reload.
      → `test_augmentation_service.py::test_private_state_round_trip_leaves_no_orphaned_effects`.
      Scope note: this covers `State.to_dict(include_private=True)`/`from_dict` only, **not** the
      export/import service, migration, or state-store paths — a dedicated import/migration test
      belongs with the Phase 2 rename (see below).
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

## Phase 2 — Internal rename & cleanup  ← DONE

- [x] Rename `equipment_effect_projections` → `direct_effect_projections` (state field,
      `EquipmentEffectProjection` → `DirectEffectProjection`, `PRIVATE_STATE_ROOTS`,
      `to_dict` redaction). Added schema migration v17→v18 (`_migrate_v17_to_v18`) that renames
      the persisted key while preserving any populated projections; bumped
      `CURRENT_STATE_SCHEMA_VERSION` to 18. Historical migrations (v2→v3, v15→v16) keep the old
      key name because they operate on their own era's schema.
- [x] Rename equipment-only-flavored helpers that are now general
      (`_sync_equipment_direct_effects` → `_sync_direct_effects`,
      `_equipment_projection_path` → `_direct_effect_projection_path`). Note:
      `synchronize_equipment_augmentations_mutation` keeps its name — it genuinely reconciles
      equipment-owned augmentations (it just also calls the general direct-effect sync).
- [x] Source-of-truth vs derived collections documented in `ARCHITECTURE.md`.
- [x] Migration test: `test_state_store.py::test_v18_migration_renames_projection_collection_and_preserves_contents`
      (hermetic migration-logic test — no disk, matching Phase 1's approach given the Windows
      `_fsync_directory` bug, flagged separately as `task_3d1ae373`).
- [x] Protocol/frontend: **no change required.** `direct_effect_projections` is private/redacted
      state (`PRIVATE_STATE_ROOTS`, stripped from public `to_dict` and all snapshots/patches). It
      is absent from `backend/protocol/state_schema.py` and has zero frontend references, so the
      rename never crosses the codegen boundary. (The pre-existing `test_protocol_codegen`
      drift is unrelated to this work.)

### Deferred to a later phase (needs the Windows fsync fix first)
- [ ] Full state-backup **service** round-trip test (`export_state_backup` → `import_state_backup`)
      with active effects. Blocked because `import`/`replaceState` exercise the on-disk checkpoint
      path that currently raises `PermissionError` on Windows (`task_3d1ae373`). The migration
      rename itself is already covered by the hermetic test above.
      **Verified on Linux (2026-07-09):** `_fsync_directory` (`backend/state/store.py`) only omits
      `os.O_DIRECTORY` when the platform lacks it (Windows); on Linux the flag is present and
      `os.open`/`os.fsync` on the parent directory work fine — confirmed by the full backend suite
      (`test_state_store.py`, 465 total) passing with zero failures. This test is still worth
      writing since Linux is a real deployment target, but it's no longer blocked here.

## Phase 3 — Unified runtime application layer (reframe)  ← DONE

**Prerequisite done first:** regenerated the stale checked-in protocol codegen
(`frontend/src/generated/backendProtocol.ts`). Prior commits changed backend contracts
(stat-point allocation, instance bridges, nullable instance health/mana, bridge-sync events,
`default_sheet_actions`, …) without regenerating, so the frontend did **not** typecheck
(~30 `tsc` errors) and `test_protocol_codegen` failed. Regenerating fixed both with zero code
changes — the frontend already targeted the current contracts. This unblocked Phase 3's
protocol-facing edits and dropped the pre-existing failure count from 9 to 8.

- [x] **Naming decision — keep `Augmentation` as the internal model name.** It is embedded across
      the protocol (`AugmentationPayload`, `ApplyAugmentation*Step`, `AugmentationTargetMetadata`),
      the frontend, action steps, item templates, and authoring. A blanket rename to
      `EffectApplication` is a large cross-boundary change with no functional benefit, and an alias
      would add confusion. The user-facing "Effect" wording (Change 2) is a Phase 5 UI-label
      concern that does not require renaming the internal model.
- [x] Make `ConditionPreset` a pure definition (Change 4): removed the unused
      `augmentation_ids` field (backend dataclass, request schema, state-snapshot payload,
      frontend `ConditionPreset` type, `conditionEditorValues` payload builder, and all
      preset fixtures/assertions). Added migration v18→v19 (`_migrate_v18_to_v19`) stripping the
      dead key; bumped `CURRENT_STATE_SCHEMA_VERSION` to 19. `augmentation_templates` remains the
      inline effect source; `ActiveCondition.augmentation_ids` (the live list) is untouched.
      Regenerated codegen. Backend: `test_v19_migration_drops_condition_preset_augmentation_ids`
      plus updated condition-preset tests pass. Frontend: `tsc` clean; unit tests updated by
      inspection (vitest can't run in the Windows shell — Linux rollup binary only).
- [x] Decided inline-templates vs shared-definition refs: **inline templates** stay the model
      (matches current authoring and avoids a cross-cutting reference-resolution layer).

### Part C — source/timing metadata on `ActiveCondition` (Change 5)  ← DONE
- [x] Added `ConditionSource` (`type`/`id`/`label`) plus `applied_at`, `applied_by_role`,
      `applied_at_state_version` to `ActiveCondition` (backend model + `ActiveConditionPayload`
      state-snapshot payload + `ConditionSourcePayload`). Regenerated codegen; carried the fields
      into the frontend domain `ActiveCondition` + `projectActiveCondition` adapter (data is now
      available for the Phase 5 Active Effects inspector, not yet displayed).
- [x] Plumbed acting-context through `apply_condition_preset_mutation` /
      `_apply_condition_preset_mutation` / async `apply_condition_preset` (optional params). The
      production apply path (`sheet_runtime` `ApplyConditionPresetStep`) fills
      `source={type:"action", id/label from the action}`, `applied_by_role=actor_role`, and
      `applied_at_state_version=current_version+1` (same version the action-history entry uses).
      `applied_at` is set to the UTC timestamp at apply time. Unspecified callers default to an
      `other` source.
- [x] Compatibility migration v19→v20 (`_migrate_v19_to_v20`) backfills metadata defaults on
      existing `active_conditions`; bumped `CURRENT_STATE_SCHEMA_VERSION` to 20.
      (`standalone_effect_applications` need no backfill — they gained no fields.)
- [x] Tests: `test_apply_condition_preset_records_source_and_timing`,
      `test_apply_condition_preset_defaults_source_when_unspecified`,
      `test_v20_migration_backfills_active_condition_metadata`, and an action-path assertion in
      `test_sheet_runtime` (source/role/version recorded via `perform_action`). Backend 454
      passed; frontend `tsc` clean (vitest not runnable in the Windows shell).

## Phase 4 — Lifecycle & stacking  ← LIFECYCLE MODEL DONE; STACKING + GM CONTROLS DEFERRED

**Decision (confirmed with the user):** lifecycle is **declarative + GM-driven**, not an
executable engine — automatic turn/round/rest tracking is a stated product non-goal. Scope this
run was the lifecycle *model* only; stacking and GM refresh/expire controls are deferred.

- [x] Restructured `AugmentationLifecycle` from free-text `duration`/`expires_at`/
      `removal_condition` to a declarative shape: `mode`
      (`manual|rounds|turns|until_rest|until_source_removed|scene`), `remaining`, `expires_at`,
      `remove_when_source_inactive`, and `notes` (preserves old free-text). Backend model +
      `AugmentationLifecyclePayload` (shared by augmentation/standalone/condition/item template
      schemas) + frontend domain type + the three editor payload builders (via a shared
      `toAugmentationLifecyclePayload`) + the condition/standalone editor forms (mode dropdown,
      remaining, expires-at, remove-when-source-inactive checkbox, notes). Regenerated codegen.
- [x] The backend enforces **no** auto-tick: `rounds`/`turns`/`until_rest`/`scene`/`remaining`
      are GM-tracked labels; only source-linked teardown (already real for equipment/conditions)
      is enforced. Documented in `ARCHITECTURE.md`.
- [x] Migration v20→v21 (`_migrate_v20_to_v21`) upgrades every persisted lifecycle
      (augmentations, standalone_effects, condition/item `augmentation_templates`), folding old
      `duration`+`removal_condition` into `notes`. Bumped `CURRENT_STATE_SCHEMA_VERSION` to 21.
      Seed (`dm_examples.py`) updated to the new shape (incl. a `rounds`/`remaining=3` example).
      Test: `test_v21_migration_structures_augmentation_lifecycle`. Backend 455 passed (8
      pre-existing Windows-fsync failures unchanged); frontend `tsc` clean (vitest not runnable
      in the Windows shell).

### Stacking — standalone `unique`/`stack` DONE; rest deferred
- [x] Standalone effect stacking (schema v22): added `StackingConfig` (`mode: unique|stack`,
      `max_stacks`) to `StandaloneEffectDefinition` and `stack_index` to
      `StandaloneEffectApplication`. `apply_standalone_effect_mutation` enforces unique (one per
      definition/instance) vs stack (multiple `…:s{n}` applications capped by `max_stacks`);
      cumulative effect falls out of the existing projection/evaluation paths since applications
      are stateless. `remove_standalone_effect_mutation` now clears the whole stack. Protocol
      payloads + migration v21→v22 + tests
      (`test_stack_mode_applies_cumulatively_and_respects_max_stacks`,
      `test_v22_migration_adds_standalone_stacking_defaults`). Frontend: domain
      `StackingConfig`/`stack_index` types + adapter pass-through (authoring-form field deferred
      with the paused Phase 5 UI). Backend 457 passed; frontend `tsc` clean.
- [ ] `refresh` / `replace` reapplication modes — deferred: standalone applications are stateless
      (lifecycle derives from the definition), so these are meaningless without **per-application
      lifecycle state**. That storage change is the real prerequisite and should land first.
- [ ] Condition stacking — deferred: needs multi-`ActiveCondition` per condition/instance with a
      stack-suffixed application/augmentation id scheme; its own focused run.
- [ ] GM controls for refresh / remove / expire (new routes + UI) — pairs with the paused Phase 5.
      Removal already exists; refresh/expire and a `remaining` decrement control are new.

## Phase 5 — UI review  ← DONE (verified on Linux/WSL)

> Resumed on Linux/WSL, where the frontend actually runs. First real run of `npm test` +
> `npm run build` after schema v18–v22 surfaced 3 stale unit-test assertions (pre-dating this
> phase — CRLF-vs-LF line-split assumption in a userscript test, and two lifecycle-editor tests
> asserting the old free-text `duration`/`removal_condition` labels instead of the Phase 4
> `mode`/`remaining`/`expires_at` shape); fixed in place. Backend 465 passed, frontend 390 passed,
> `tsc`/build/protocol-codegen all clean.

- [x] Rename user-facing "Augmentation" → "Effect" in authoring/UI (Change 2). Audited: all
      visible copy already says "Effect"/"Effects" (`StandaloneEffectEditorForm`,
      `ConditionAugmentationTemplatePanel`, page titles/subtitles); remaining `Augmentation*`
      occurrences are code identifiers (types, functions, CSS classes) per the "keep code
      identifiers" instruction — no changes needed.
- [x] Separate direct / evaluation-time / roll-mode effects in the authoring editor (Change 6).
      Added a one-line behavior hint (`describeAugmentationEffectType` in
      `augmentationEditorValues.ts`) under the Effect Type dropdown in all three effect editors
      (`StandaloneEffectEditorForm`, `ConditionAugmentationTemplatePanel`,
      `ItemAugmentationTemplatePanel`) clarifying that direct modifies the value itself,
      evaluation-time adjusts formula results without touching the value, and roll-mode changes
      no value and only grants advantage/disadvantage.
- [x] Standalone effect stacking authoring field: added `stackingMode`/`stackingMaxStacks` to
      `AugmentationEditorValues` + `toStackingConfigPayload`, and a "Stacking" details section in
      `StandaloneEffectEditorForm` (mode dropdown, max-stacks input shown only in `stack` mode).
      Condition/item templates don't get the field — stacking is standalone-effect-only per the
      backend model.
- [x] Active Effects inspector: name, source, target, visibility, duration, stack count added to
      `SheetConditionsSection` and `SheetStandaloneEffectsSection`. Conditions show a GM-only
      source/applied-at/applied-by line (via new `mode`/`augmentations` props — lifecycle looked
      up from the condition's `augmentation_ids` against the runtime `augmentations` map) plus a
      lifecycle summary visible to everyone; standalone effects show lifecycle + stack position
      (`formatAugmentationLifecycle`/`formatStackingSummary` in `augmentationEditorValues.ts`).
      Remove control already existed for conditions; standalone effects have no remove control
      because no GM-facing route exists yet for it (matches the already-deferred "GM controls for
      refresh/remove/expire" item above).
- [x] Player-safe active condition/effect display: verified visually — a player's own visible
      (non-`gm_only`) conditions/effects show duration but not source/timing; `gm_only` and
      other-instance data stay redacted server-side as already tested. **Found and fixed a bug
      while verifying this**: claiming a sheet access code (`sheet_access_claimed`) only assigns
      the session server-side — it never told the client to refetch state, so a player's own
      pre-existing active conditions/effects (present before that browser session connected)
      stayed invisible until an unrelated patch happened to touch them. Fixed in
      `hooks/useGameClient.ts` by requesting a full (non-incremental) `resync_state` right after
      the claim response, which re-runs redaction against the newly-assigned instance.
- [ ] Audit-log entries for effect lifecycle events (Change 9) — action history already exists;
      not additionally scoped this run.

## Cleanup invariants to guarantee (Change 7 — assert across phases)

- [ ] Deleting an instance removes all attached conditions/effects/projections/access codes. *(exists; keep covered)*
- [ ] Removing a condition removes condition-owned effects. *(exists)*
- [ ] Unequipping an item removes equipment-owned effects. *(exists)*
- [ ] Deleting an effect/condition definition fails safely if active, or cascades intentionally. *(partially exists — verify)*
- [ ] Import/export cannot leave orphaned active effects. *(Phase 1 gap test)*
