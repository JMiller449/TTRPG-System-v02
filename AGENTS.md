# Repository Guidelines

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.


## Project Structure & Module Organization
This repo is backend-first, with frontend scaffolding planned in React/Vite.

- `backend/core/`: FastAPI app setup and lifespan wiring (`main.py`).
- `backend/routes/`: transport layer (currently WebSocket route in `ws.py`).
- `backend/schemas/state/`: game state dataclasses (sheets, stats, actions, items, formulas).
- `backend/schemas/ipc_types/`: client/server request and response message shapes.
- `backend/state/`: state storage and game-logic orchestration.
- `frontend/`: React/Vite frontend application and UI scaffolding.
- `reference-docs/`: TTRPG rules and formulas. `Chip TTRPG System_2-20-26.pdf` is the highest authority.
- `reference-docs/policies/`: architecture and scope guardrails.
- `plan/active/PLAN.md`: active consolidated project plan and task list.
- `plan/archived/`: archived planning/task/completion source files retained for history.
- `state_dumpy.json`: persisted local state snapshot.

## Before adding a new feature or completing a large refactor, follow this six-step workflow: (Pause for user confirmation and review between each step. Following this workflow is unnecessary for small changes requested explicitly by the user)

1. **Define the goal:** Restate the requested change, its purpose, constraints, non-goals, and expected outcome.

2. **Clarify requirements:** Identify ambiguity, assumptions, edge cases, and measurable acceptance criteria. Resolve what you can from the available documentation and code.

3. **Investigate the codebase:** Inspect the relevant architecture, files, existing implementations, dependencies, conventions, and tests. Do not begin implementation yet.

4. **Produce an implementation plan:** Create a concrete, repository-specific plan identifying:

   * files and systems to modify,
   * existing abstractions to reuse,
   * expected data and control flow,
   * implementation order,
   * tests and validation,
   * risks, compatibility concerns, and migrations.

5. **Review and harden the plan:** Critically challenge the proposed approach. Look for incorrect assumptions, duplicated systems, architectural conflicts, missing dependencies, unhandled edge cases, excessive scope, compatibility issues, and weak acceptance criteria. Revise the plan before proceeding. Clearly report any unresolved blocker.

6. **Implement and verify:** Implement the reviewed plan, run the relevant tests and validation, confirm the acceptance criteria, inspect for regressions, and summarize the completed changes and any deviations from the plan.

## Build, Test, and Development Commands
- `python -m venv backend/.venv`: create backend virtual environment.
- `backend/.venv/bin/pip install -r backend/requirements.txt`: install backend deps.
- `just run-backend`: run API server on `0.0.0.0:6767` via Uvicorn (requires `uvicorn` installed).
- `backend/.venv/bin/python -m uvicorn backend.core.main:app --host 127.0.0.1 --port 6767`: direct local run command.
- `backend/.venv/bin/python -m pytest`: run tests.

## Coding Style & Naming Conventions
- Use 4-space indentation and explicit type hints.
- Python naming: `snake_case` for functions/variables/modules, `PascalCase` for dataclasses/types.
- Keep transport message `type` strings stable across backend and frontend.
- Prefer small, composable schema changes with matching IPC updates in the same PR.

## Task Tracking
- `plan/active/PLAN.md` stores the active consolidated roadmap, MVP acceptance criteria, and task list.
- `plan/archived/` stores superseded task, plan, questionnaire, and completion logs for history.
- When work is completed, update `plan/active/PLAN.md` in the same PR.
- If behavior is unclear in the rules, add a TODO or deferred rule decision in `plan/active/PLAN.md` and reference the exact PDF section/page.

## Testing Guidelines
- Use `pytest` for backend tests under `backend/tests/`.
- Test files: `test_*.py`; test names should describe behavior (`test_build_turn_order_rejects_empty_party`).
- Prioritize websocket contract tests: request parsing, state patch generation, and error responses.
- Frontend tests should verify optimistic UI reconciliation against authoritative server patches.

## Commit & Pull Request Guidelines
- Follow existing history style: short, focused commit subjects (imperative, scoped).
- Keep one logical change per commit when possible.
- PRs should include summary, impacted paths, manual test steps, and UI screenshots for frontend changes.
- Call out schema/protocol changes explicitly so client/server updates can ship together.

## Rules Authority & Policy Docs
- Do not invent game behavior. If rules are unclear, mark it `TODO` and escalate in the PR summary.
- Gameplay calculations are backend-authoritative; frontend renders state, submits intents, and reconciles patches.
- Before starting implementation work, read and follow these policy docs:
  - `reference-docs/policies/architecture-guidelines.md`
  - `reference-docs/policies/frontend-guidelines.md`
  - `reference-docs/policies/backend-guidelines.md`
  - `reference-docs/policies/calculation-scope-policy.md`
