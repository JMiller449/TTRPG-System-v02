# Attributes and Authoring Metadata

## Purpose and model

Attributes are typed, reusable properties attached to sheets, items, and
actions. They cover campaign-specific metadata and backend-required mechanical
profiles without adding bespoke fields for every authored concept.

[`backend/state/models/attribute.py`](../../backend/state/models/attribute.py)
defines:

- `AttributeDefinition`: ID, name, supported subject types, value type, default,
  unit, visibility, validation options, reference kind, and ownership/profile
  metadata.
- `AttributeBridge`: relationship ID, definition ID, authored value, evaluated
  value, and evaluation error.
- `AttributeValue`: literal number, boolean, text, enum, reference, or list
  values, plus formula-backed storage for numeric definitions.

Definitions live in the top-level `attributes` registry. Bridges live on their
owning sheet, instance, item, or action.

## Backend-owned and authored definitions

The backend seeds required definitions, including Amount of Reactions, the
canonical sheet Level, and the weapon attribute profile. It also supplies
optional standard sheet, item, and action definitions. Required/backend-owned
definitions cannot be changed in a way that breaks their mechanical contract.
Level is attached to every template and spawned instance with a default of 1;
existing authored Level values are preserved during synchronization and
migration. A Level write must resolve to a positive whole number.

DMs can create campaign definitions for supported subjects and attach, detach,
set, or reset values through typed routes in
[`backend/features/attributes/`](../../backend/features/attributes/). A bridge
value must match the definition's declared type, enum/list options, reference
kind, subject eligibility, and required-profile rules. Deletion is rejected
while live bridges or formula references depend on a definition.

Complete template/item/action authoring may include attribute bridges
atomically. Separate attach/value routes support later focused edits to a
template, instance, or authored subject.

## Evaluation

Formula-backed numeric attribute values are evaluated by the backend against
the owning subject context. The evaluated result and any safe evaluation error
are projected in state. Attribute formulas can reference only the scoped paths
allowed for their subject; cross-subject and cyclic dependencies are rejected.

Actions and item effects may read evaluated attributes during formula
execution. Source-item attribute access requires an explicit source inventory
relationship when more than one owned copy could satisfy the action.

The action-formula authoring catalog also exposes every visible numeric sheet
Attribute definition as `sheet.attributes.<attribute_id>`. Its generated,
read-only `@sheet_attribute_*` shortcut is stable even when an Attribute ID is
not itself a valid formula identifier. During character execution these paths
read the acting spawned instance's stored evaluated bridge value. They do not
fall back to the parent template when the bridge is detached or invalid;
missing definitions, wrong subject/value types, evaluation errors, nonnumeric
results, and role-inaccessible definitions are rejected before formula
expansion.

## Visibility and redaction

Definitions can be public or `gm_only`. Player snapshots remove GM-only
definitions and their bridges. Item and action payload redaction also removes
GM-only attached values. Frontend visibility is not the protection boundary;
the state-sync service performs the filtering before data is sent. Formula
metadata and runtime Attribute resolution apply the same visibility boundary,
so a player cannot execute an authored alias that reads a GM-only Attribute.

## Frontend authoring

[`frontend/src/features/attributes/`](../../frontend/src/features/attributes/)
contains definition authoring, typed value editors, subject attachment, and
formula-variable selection. Template, item, and action editors reuse those
components rather than maintaining feature-specific value models.

The shared character sheet promotes the same canonical Level bridge beside
identity and XP. Players receive a read-only value. The GM control writes a
literal through the existing DM-only instanced-sheet Attribute route, so the
header does not introduce a second Level field or client-owned state.

Authoring variable metadata comes from backend routes in the variable registry
feature. Formula fields present that metadata through cursor-aware `@`
autocomplete rather than a separate variable-picker field. Selecting a result
inserts its token at the active mention and records the correct scoped alias;
IDs and canonical paths remain stable transport values.

## Principal tests

- [`backend/tests/test_attributes.py`](../../backend/tests/test_attributes.py)
  covers definitions, value validation, formula evaluation, references,
  permissions, redaction, and dependencies.
- [`backend/tests/test_variable_registry.py`](../../backend/tests/test_variable_registry.py)
  covers the allowed authoring catalogs.
- Attribute page, variable autocomplete, and template-context tests live under
  [`frontend/src/features/attributes/`](../../frontend/src/features/attributes/),
  [`frontend/src/features/variables/`](../../frontend/src/features/variables/),
  and the sheet/item/action features.

## Limitations

Attribute subject types are currently limited to sheets, items, and actions.
The system does not infer new mechanics from display-only attributes; gameplay
behavior must explicitly consume an allowed value in backend logic or an
authored formula/action.
