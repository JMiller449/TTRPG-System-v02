# Architecture Guide

This directory is the maintained map of the systems and features that exist in
TTRPG-System-v02. It describes current implementation boundaries and points to
the code and tests that establish them. It is not a replacement for the active
rules, repository policies, public protocol schemas, or project plan.

## How to use this documentation

Start here when locating an existing capability or planning a change that
crosses backend, frontend, persistence, authorization, or deployment concerns.
Read the relevant platform document for shared infrastructure and the relevant
feature document for domain-specific behavior. Then inspect the linked source
and tests before editing.

The authority order is:

1. [`reference-docs/Chip_TTRPG_System.md`](../reference-docs/Chip_TTRPG_System.md)
   and [`reference-docs/rule-decisions-needed-answered.md`](../reference-docs/rule-decisions-needed-answered.md)
   define intended game behavior.
2. The [root README](../README.md) and
   [`reference-docs/policies/`](../reference-docs/policies/) define architectural
   and scope constraints.
3. Registered schemas, implementation, generated contracts, and tests show the
   behavior currently implemented.
4. These architecture documents summarize and navigate that implementation.
5. [`plan/active/PLAN.md`](../plan/active/PLAN.md) tracks project status,
   readiness work, and deferred changes.

If implementation conflicts with an active rule or policy, treat that as a
defect. Do not change this documentation to make the conflict appear intended.

## Platform architecture

| Area | Document | Primary concern |
| --- | --- | --- |
| Backend contract | [Backend authority and WebSocket protocol](platform/backend-authority-and-websocket-protocol.md) | Request routing, schemas, events, and code generation |
| Identity | [Authentication, sessions, and sheet access](platform/authentication-sessions-and-sheet-access.md) | Roles, character claiming, and access boundaries |
| State distribution | [State sync, redaction, and undo](platform/state-sync-redaction-and-undo.md) | Snapshots, patches, replay, visibility, and mutation safety |
| Durability | [Persistence, migrations, and backups](platform/persistence-migrations-and-backups.md) | Checkpoints, recovery, import/export, and migrations |
| Client architecture | [Frontend state and transport](platform/frontend-state-and-transport.md) | Transport adapters, authoritative state, and local UI state |
| Development content | [Starter data and seeding](platform/starter-data-and-seeding.md) | Reproducible campaign data and seed validation |
| Operations | [Deployment and operations](platform/deployment-and-operations.md) | Production build, maintenance mode, and verification |

## Feature architecture

| Feature | Document | Includes |
| --- | --- | --- |
| Characters | [Sheets and instances](features/sheets-and-instances.md) | Templates, spawned characters, bridges, and instance cleanup |
| Character mechanics | [Stats, resources, resistances, and damage](features/stats-resources-resistances-and-damage.md) | Derived values, HP/mana, allocation, and damage intake |
| Typed properties | [Attributes and authoring metadata](features/attributes-and-authoring-metadata.md) | Definitions, values, attachment, visibility, and evaluation |
| Calculation | [Formulas and variable registry](features/formulas-and-variable-registry.md) | Formula definitions, aliases, dice, variables, and authoring catalogs |
| Commands | [Actions, execution, and history](features/actions-execution-and-history.md) | Authored pipelines, transactional execution, and audit history |
| Growth | [Proficiencies](features/proficiencies.md) | Definitions, bridges, use growth, and weapon families |
| Equipment | [Items, inventory, and equipment](features/items-inventory-and-equipment.md) | Catalog, containment, weight, grants, effects, and proposals |
| Runtime modifiers | [Conditions, effects, and augmentations](features/conditions-effects-and-augmentations.md) | Definitions, applications, projections, lifecycle, and stacking |
| Encounter setup | [Encounters](features/encounters.md) | Presets and spawning enemy instances |
| Advancement | [XP tracking](features/xp-tracking.md) | Parties, kills, adjustments, visibility, and derived XP |
| Table output | [Roll20 bridge](features/roll20-bridge.md) | Per-user userscript bindings and acknowledged chat delivery |

## Maintenance rule

When a change materially alters a feature's architecture, behavior, ownership,
data or control flow, public protocol, authorization or redaction, persistence,
or deployment, update the relevant document here in the same change. A small
refactor or bug fix needs a documentation update only when the current
description would otherwise become inaccurate.

Keep these documents current-state focused:

- Link to rules instead of restating them as new authority.
- Link to the active plan instead of maintaining parallel task lists.
- Name representative requests and canonical source locations instead of
  copying the complete generated route inventory.
- Clearly label limitations and behavior that is deliberately not automated.
- Prefer one canonical explanation and link to it from older or feature-local
  documentation locations.
