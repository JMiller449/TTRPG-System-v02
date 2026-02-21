# Calculation Scope Policy (Frontend vs Backend)

## Backend-Only Calculation Scope
- All gameplay math and resolution must run on backend:
  - skill checks and roll outcomes
  - contested rolls (block/parry/dodge, etc.)
  - derived stats and formula evaluation
  - damage/healing application and final state mutation

## Frontend Scope
- Render authoritative state and roll history.
- Collect user intent (roll, edit, create template, instantiate sheet).
- Optionally show pending optimistic UI for responsiveness.
- Reconcile UI strictly to backend patch/snapshot responses.

## Non-Negotiable Rule
- Frontend must not finalize or persist gameplay outcomes from local math.
- Any local preview values are temporary and must be overwritten by backend results.

## Ambiguity Handling
- If the rules PDF does not specify behavior, do not infer.
- Record a TODO in `frontend_tasks.md` or `backend_tasks.md` (whichever applies) with a link/path and page reference to the unresolved rule.
