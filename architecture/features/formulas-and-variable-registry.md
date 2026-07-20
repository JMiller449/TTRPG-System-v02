# Formulas and Variable Registry

## Purpose and ownership

Formulas provide backend-evaluated numeric expressions for derived stats,
resource maxima, action calculations/messages, attributes, item effects, and
other authored mechanics. The variable registry exposes the safe paths and
presets that editors may use without exposing arbitrary backend object
traversal.

## Formula model and definitions

[`backend/state/models/formula.py`](../../backend/state/models/formula.py)
defines formula text, explicit aliases, normalized semantic tags, and reusable
global `FormulaDefinition` records. Aliases map `@name` placeholders to paths
resolved against the current sheet/instance execution root. Global definitions
are referenced by ID so an action uses the current authored definition at
execution time.

DM-only CRUD for global definitions lives in
[`backend/features/sheet_admin/formulas/`](../../backend/features/sheet_admin/formulas/).
Create/update validates aliases against canonical paths and rejects missing,
unsupported, self-referential, or cyclic dependencies. Deletion is rejected
while live actions or other definitions depend on a formula.

## Runtime evaluation

[`backend/features/formula_runtime/service.py`](../../backend/features/formula_runtime/service.py)
owns expression evaluation. It supports finite numeric arithmetic, parentheses,
dice expressions, nested formula expansion with cycle guards, and the allowed
functions `min`, `max`, `floor`, `ceil`, and `round`. Unsupported AST nodes,
operators, functions, paths, and nonnumeric results are rejected.

Execution context may include the acting template/instance, a specific source
item relationship, action-scoped calculated values, global formula references,
and matching evaluation-time or roll-mode effects. Tags and selectors let an
effect target eligible formula evaluations without rewriting stored values.

For action execution, the rooted `sheet` context means the acting sheet: it
reads the spawned instance when a character instance is executing and falls
back to the template only when no instance exists. The read-only `template`
root explicitly addresses the parent template. This keeps ordinary aliases
such as `@arc` aligned with character advancement while still allowing an
author to deliberately select aliases such as `@template_arc`.

Visible numeric sheet Attribute definitions join that catalog under
`sheet.attributes.<attribute_id>` with stable `@sheet_attribute_*` shortcuts.
They resolve only through the acting sheet or spawned instance's authoritative
evaluated Attribute bridge. Runtime validation rejects missing, detached,
nonnumeric, evaluation-failed, or role-inaccessible Attribute references
instead of substituting the parent template's value or a definition default.

Formula results used for persisted outcomes are normalized and validated on the
backend. Roll20-bound formulas are composed into inline roll expressions where
appropriate; the browser/Roll20 surface performs the visible dice roll, while
state mutations remain backend-authorized and delivery-acknowledged.

## Variable and authoring metadata

[`backend/features/variable_registry/`](../../backend/features/variable_registry/)
publishes three related player-authenticated catalogs:

- canonical variable paths and types;
- action formula aliases, allowed mutation roots, step metadata, system action
  presets, and formula/resource defaults;
- allowed augmentation targets filtered by authoring context.

The same catalog functions are reused by backend validation. This prevents the
UI from advertising paths that runtime services would reject and prevents
handwritten client option lists from becoming a second contract.

Frontend authoring is under
[`frontend/src/features/formulas/`](../../frontend/src/features/formulas/) and
[`frontend/src/features/variables/`](../../frontend/src/features/variables/).
Formula-bearing fields use the shared `FormulaVariableInput` control. Typing
`@` at the cursor opens a filtered search of the variables allowed by the
backend-provided metadata; keyboard or pointer selection replaces that mention
in place and upserts its canonical alias. Sheet and attribute editors translate
the selected path into their relative execution roots, while action editors
also expose values produced by earlier calculation steps. This keeps variable
discovery in the formula itself instead of maintaining a separate insertion
field beside every editor.

Editors submit formulas and aliases; they do not calculate final gameplay
results locally. The autocomplete is an authoring aid only, and backend formula
validation remains authoritative.

Formula tags use one shared chip-and-search control across those editors.
Selected tags and the search input occupy the same field; typing filters the
allowed/common suggestions, while Enter, Tab, comma, or pointer selection adds
a tag. Authors may still create normalized custom tags, and can remove selected
tags directly from the same control. There is no separate suggestion field or
staged add button.

## Roll modes

Actions declare `none`, `check`, or `damage` roll-mode kind. Check actions may
request normal, advantage, or disadvantage; damage actions may request normal
or critical. Roll-mode effects can adjust the requested check mode when their
selectors match. Transformations apply only to eligible standalone d100 check
expressions or documented damage expressions, not every number in a message.

## Principal tests

- [`backend/tests/test_formula.py`](../../backend/tests/test_formula.py) covers
  parsing, expansion, dice, functions, cycles, tags, and effects.
- [`backend/tests/test_sheet_admin_formulas.py`](../../backend/tests/test_sheet_admin_formulas.py)
  covers CRUD, references, paths, and permissions.
- [`backend/tests/test_variable_registry.py`](../../backend/tests/test_variable_registry.py)
  covers canonical catalogs and context filtering.
- Frontend formula and variable-autocomplete tests live in their corresponding
  feature directories.

## Limitations

The expression language is deliberately restricted and is not general Python.
Frontend formula previews, if added later, must be clearly non-authoritative
and overwritten by backend results.
