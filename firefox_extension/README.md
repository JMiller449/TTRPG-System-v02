## TTRPG Roll20 Chat Bridge

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.

Temporary Firefox extension that runs on `https://app.roll20.net/editor/*`, opens a
WebSocket to the local backend, and forwards incoming chat jobs into the Roll20 chat UI.

### Load Temporarily In Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on`
3. Select [manifest.json](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/firefox_extension/manifest.json)

### Backend Socket

The content script connects to:

`ws://127.0.0.1:6767/ws/chat`

After loading the extension, open its preferences/options page and configure:

- the backend WebSocket URL
- the same service authentication code used by the backend's `SERVICE_AUTH_CODE`

Reload the Roll20 editor tab after saving. The service code is stored in Firefox extension
storage and is not committed in the content script.

### URL Smoke Test

After reloading the temporary extension, verify the content script activates on both:

- `https://app.roll20.net/editor`
- `https://app.roll20.net/editor/<game-path>`

The browser console should show the `[ttrpg-roll20-bridge]` connection message on either URL.
