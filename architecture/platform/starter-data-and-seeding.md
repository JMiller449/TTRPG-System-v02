# Starter Data and Seeding

## Purpose

The development seed creates a complete, internally valid example campaign for
manual table testing and regression coverage. It exercises public authoring
contracts instead of maintaining a second hand-built state format.

## Source and build flow

[`backend/dev/dm_examples.py`](../../backend/dev/dm_examples.py) defines
deterministic payloads for campaign attributes, formulas, proficiencies,
actions, conditions, standalone effects, items, player and enemy templates,
encounter presets, and runtime examples.

[`backend/dev/seed.py`](../../backend/dev/seed.py) builds the seed in isolation:

1. Start from a fresh state and dispatch typed authoring requests through the
   same request registry used by the application.
2. Create templates, definitions, bridges, and encounter presets.
3. Spawn example player instances and add deterministic development character
   access codes.
4. Add the XP registry and runtime examples needed for table-facing coverage.
5. Validate references, required records, inventory, effects, and expected
   coverage.
6. Write a temporary checkpoint and only then atomically replace the requested
   target checkpoint.

This makes contract drift fail the seed rather than silently creating state the
application could not author normally.

## Installed coverage

The seed includes two player references, enemy templates, required and
campaign-specific attributes, formulas, weapon-family and custom
proficiencies, all item interaction types, containers, equipment effects,
conditions, standalone effects, authored checks and damage/resource actions,
encounter presets, XP thresholds, kill records, and claimed-character examples.
It intentionally provides examples of direct, evaluation-time, and roll-mode
effects and both public and GM-only visibility.
Example Player 1 equips Iron Gauntlets and Training Bracers for two stacked
Strength effects, plus Weighted Greaves for a subtractive Dexterity effect. This
fixture exercises the core-stat assignment/augmentation breakdown without
turning equipment values into permanent stat-point assignments.
Example Player 2 includes a larger kill-history fixture with repeated names and
batched quantities for exercising the character Kills Summary/Feed switch. The
fixture totals 144 defeated enemies across eight records while Example Player 1
retains the in-progress XP case.

The human-readable summary in
[`plan/active/dm_examples.md`](../../plan/active/dm_examples.md) describes the
campaign examples but is not the executable source.

## Operation

Run `just seed` from the repository root with the backend stopped. The previous
valid checkpoint becomes the backup according to normal store behavior.

Do not run the seed against production. Do not run it while a backend process
is active: the process retains its old state in memory and may overwrite the
new checkpoint on its next mutation or shutdown dump.

## Principal tests

- [`backend/tests/test_dev_seed.py`](../../backend/tests/test_dev_seed.py)
  verifies isolated construction and atomic checkpoint behavior.
- [`backend/tests/test_dm_examples_acceptance.py`](../../backend/tests/test_dm_examples_acceptance.py)
  verifies the intended cross-feature campaign coverage.
- Individual feature suites validate the same payload rules used while seeding.

## Maintenance rule

When a required system definition or public authoring contract changes, update
the seed payload and acceptance tests in the same change. Examples may
demonstrate active rules, but they must not become a competing rules authority.

The isolated seed includes starting stat-point provenance from its normal spawn
requests. Before publishing the new fixture, its synthetic audit IDs and dates
are made deterministic, matching the existing fixed-date XP examples. This
fixture construction does not rewrite history in an installed campaign.
