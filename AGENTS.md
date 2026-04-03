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
- `state_dumpy.json`: persisted local state snapshot.
- `frontend_tasks.md`: active frontend TODO backlog.
- `backend_tasks.md`: active backend TODO backlog.
- `frontend_completed.md`: completion log for finished frontend tasks.
- `backend_completed.md`: completion log for finished backend tasks.
- `Completed.md`: legacy shared completion log (do not add new entries).

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
- `frontend_tasks.md` stores active frontend TODO items.
- `backend_tasks.md` stores active backend TODO items.
- `frontend_completed.md` stores finished frontend tasks as a dated log.
- `backend_completed.md` stores finished backend tasks as a dated log.
- When a frontend task is completed, remove it from `frontend_tasks.md` and add it to `frontend_completed.md` in the same PR.
- When a backend task is completed, remove it from `backend_tasks.md` and add it to `backend_completed.md` in the same PR.
- If behavior is unclear in the rules, add a `TODO` task in the relevant task file and reference the exact PDF section/page.

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
