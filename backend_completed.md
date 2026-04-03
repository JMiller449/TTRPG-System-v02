# Backend Completed

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.


Use this file as the completion log for backend tasks moved out of `backend_tasks.md`.
Record entries with a date and a short summary.

## 2026-02-20
- Created contributor/policy documentation baseline (`AGENTS.md`, policy docs, task workflow files).
- Split active tasks into `frontend_tasks.md` and `backend_tasks.md`; retired `Tasks.md`.

## 2026-04-02
- Locked the websocket protocol around one canonical request envelope, one canonical server-event vocabulary, authoritative `state_snapshot` / `state_patch` sync, and backend contract tests for auth, snapshot, patch, resync, and error flows.
- Added backend-driven TypeScript protocol generation so frontend transport request/event types come from backend protocol schemas instead of handwritten duplicates.
- Added route-level client-generation metadata to the websocket request registry and exported a generated frontend route-contract manifest for future typed helper generation.
- Moved `authenticate` into the registry-backed app-route contract surface and replaced DM-only route auth with the `unauthenticated` / `player` / `dm` role hierarchy.
- Removed the old public generic sheet-admin websocket CRUD surface so future typed admin routes can land on a clean public contract.
- Finished backend auth bootstrap migration so app auth is server-derived, registry-dispatched, and covered by backend role/bootstrap tests.
