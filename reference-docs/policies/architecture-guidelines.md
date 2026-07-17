# Architecture Guidelines

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.


## Core Principles
- Server-authoritative state: backend is the source of truth for sheet values, rolls, and outcomes.
- Patch-first synchronization: send one full snapshot at connect, then incremental patches for updates.
- Resync safety: support forced full snapshot when client/server state versions diverge.

## Domain Model
- Use one sheet model with metadata to distinguish:
  - `kind`: `player` or `enemy`
  - `mode`: `template` or `instance`
- Templates are reusable; instances are spawned copies for session use.

## Interaction Model
- Frontend submits intents (create/update sheet, roll request, instantiate template).
- Backend validates intent, computes outcomes, persists state, then emits patches.
- Frontend may render optimistic pending state, but must reconcile to server patches.

## Rules Authority
- Primary authority: `reference-docs/Chip_TTRPG_System.md`.
- Answered implementation rulings: `reference-docs/rule-decisions-needed-answered.md`.
- Archived PDFs are historical references only.
- If ambiguous, do not invent behavior. Create a TODO or deferred rule decision in `plan/active/PLAN.md` and reference the exact active-rule section.
