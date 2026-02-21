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
- `VITE_TRANSPORT=mock` (default): local scaffold mode for UI development.
- `VITE_TRANSPORT=ws`: real websocket mode using `VITE_WS_URL`.

## Integration Boundary
- Replace/align intent payloads and server event types in `src/domain/ipc.ts` once backend contract is finalized.
- Keep transport implementations isolated in `src/infrastructure/transport/`.

## Important TODOs
- Confirm final roll request payload shape from backend.
- Confirm final patch operation schema from backend.
- Add role-based authorization handling once backend auth endpoint/message is finalized.
