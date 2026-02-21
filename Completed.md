# Completed

Use this file as a completion log. Move tasks from `frontend_tasks.md` or `backend_tasks.md` here when done.

## 2026-02-20
- Created contributor/policy documentation baseline (`AGENTS.md`, policy docs, task workflow files).
- Scaffolded React/Vite frontend architecture with typed state, transport abstractions, and mock/ws adapters.
- Implemented session landing flow, GM/password entry gate, and player entry flow (select/create player before console).
- Implemented GM console scaffolding (templates, encounters, tabs, roll panel) and player console scaffolding.
- Refactored player console into consolidated character-sheet style layout.
- Added reusable template create/edit form scaffold (`name/notes/tags/core stats`) and wired template updates.
- Expanded encounter preset builder to support multi-entry rosters.
- Added player-console roll composer scaffold inside the roll-log panel.
- Added local intent lifecycle feedback banners for pending/success/error states.
- Improved character-sheet modifier UX with clearer edit affordances, keyboard hints, and validation hints.
- Added frontend lint/format scaffolding (`eslint`, `prettier`, config files, npm scripts).
- Split active tasks into `frontend_tasks.md` and `backend_tasks.md`; retired `Tasks.md`.
- Added new scoped TODOs for notes notepad, equipment UI, level-up manual edit page, and quick-roll action support.
- Implemented player notes notepad as editable multiline field in character sheet.
- Implemented equipment inventory-list scaffolding (add/remove items, set/clear active weapon) for active sheets.
- Implemented manual level-up editor panel for direct stat value overrides (local scaffold state).
- Implemented quick-roll buttons (`attack`, `dodge`, `parry`, `block`) in GM and player roll composers.
- Implemented quick-roll prefill behavior (context prefills; no immediate submit).
- Added roll equation preview blocks to GM/player roll composers using explicit TODO placeholders (no invented rule math).
