# Frontend Application

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.

This React/Vite frontend is integrated with the backend-authoritative WebSocket contract.

## Responsibilities

- Provide modular player and GM UI for authoritative sheets, authoring, encounter setup, XP tracking, and action execution.
- Keep all gameplay calculations on backend.
- Support optimistic UX while reconciling to server snapshots/patches.

## Run (once dependencies are installed)

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run format`

## Backend Connection

- `VITE_WS_URL` configures the authoritative backend websocket URL.
- Failed or interrupted connections retry with bounded backoff and re-authenticate the prior session after reconnecting.
- Tests isolate client behavior with injected inert transports; the application runtime always uses the websocket backend.

Vite mode selects the deployment base and socket configuration:

- `npm run dev` uses `/` and defaults to `ws://127.0.0.1:6767/ws`.
- `npm run build` uses `/ttrpg/` and `frontend/.env.production`, which points to
  `wss://bossadapt.org/ttrpg/ws`.

## Auth Configuration
- `VITE_PLAYER_AUTH_TOKEN`: optional player token used by role-based helper auth.
- `VITE_DM_AUTH_TOKEN`: optional GM token used by role-based helper auth.
- Normal login uses the code entered by the player or GM; these env values are only for helper paths.
- Production builds explicitly leave both helper-token values empty. Never put
  production authentication codes in a `VITE_*` variable because frontend
  environment values are public bundle content.

## Integration Boundary

- Keep request helpers aligned with generated route-backed transport types and route metadata.
- Keep transport implementations isolated in `src/infrastructure/transport/`.
- Keep backend-authoritative data in the app server-state slice; keep active sheet selection, drafts, and view state local to the frontend.
- Treat Roll20 chat as the play log rather than rebuilding an authoritative in-app roll history.

## Architecture Reference

- Start with [`architecture/README.md`](../architecture/README.md).
- Frontend ownership, reconciliation, and transport layers are documented in
  [`architecture/platform/frontend-state-and-transport.md`](../architecture/platform/frontend-state-and-transport.md).
- Public contract generation is documented in
  [`architecture/platform/backend-authority-and-websocket-protocol.md`](../architecture/platform/backend-authority-and-websocket-protocol.md).
- Request builders are centralized and typed from generated payloads; generated
  client methods remain a possible future extension rather than current behavior.
