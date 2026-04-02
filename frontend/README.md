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
- Align request helpers and transport types with generated route-backed contract output as backend typed routes land.
- Keep transport implementations isolated in `src/infrastructure/transport/`.
- Keep backend-authoritative data in the app server-state slice; keep active sheet selection, drafts, and view state local to the frontend.
- Treat Roll20 chat as the play log rather than rebuilding an authoritative in-app roll history.

## Important TODOs
- Confirm final roll request payload shape from backend.
- Finish direct frontend adoption of the backend-native patch dialect.
- Replace handwritten feature websocket request builders with generated or centralized typed helpers.
