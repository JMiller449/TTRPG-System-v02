# Frontend Scaffold

This frontend is intentionally scaffolded for backend-authoritative integration.

## Goals
- Build modular UI for sheets, enemy templates, encounter presets, and rolling.
- Keep all gameplay calculations on backend.
- Support optimistic UX while reconciling to server snapshots/patches.

## Run (once dependencies are installed)
- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run format`

## Transport Modes
- `VITE_TRANSPORT=ws` (default): try the real websocket backend using `VITE_WS_URL`.
- `VITE_TRANSPORT=mock`: force local scaffold mode for UI development.
- If websocket connect fails while running in default `ws` mode, the frontend falls back to mock transport.

## Integration Boundary
- Replace/align intent payloads and server event types in `src/domain/ipc.ts` once backend contract is finalized.
- Keep transport implementations isolated in `src/infrastructure/transport/`.

## Important TODOs
- Confirm final roll request payload shape from backend.
- Confirm final patch operation schema from backend.
- Add role-based authorization handling once backend auth endpoint/message is finalized.
