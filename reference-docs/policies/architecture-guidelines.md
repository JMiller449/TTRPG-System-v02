# Architecture Guidelines

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
- Primary authority: `reference-docs/Chip TTRPG System_2-20-26.pdf`.
- If ambiguous, do not invent behavior. Create a TODO and track it in `frontend_tasks.md` or `backend_tasks.md`.
