# Frontend Guidelines (React/Vite)

## Stack
- Framework: React + TypeScript + Vite.
- Communication: WebSocket client for snapshot/patch stream and intent messages.
- State handling: keep local UI state separate from authoritative server state.

## Scope
- Player: view sheet and submit roll intents.
- GM: same capabilities plus enemy/template management, quick tab switching, searchable template list, and encounter loading.
- Include table roll log with GM visible/hidden roll option.

## UX Rules
- Optimistic UI is allowed for edits/roll submissions, but mark as pending until server ack.
- Always reconcile pending UI with incoming authoritative patches.
- Do not perform gameplay calculations client-side.

## Code Conventions
- Component files in `frontend/src/` using `PascalCase` for components and `camelCase` for hooks/helpers.
- Keep transport types centralized and shared across view features.
- Modularize components aggressively: split UI into focused, reusable components instead of page-sized components.
- Prefer small, testable components over large page-level logic blocks.
