## TTRPG Roll20 Chat Bridge Userscript

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.

Firefox userscript managed by Violentmonkey. It runs on the TTRPG frontend for
configuration synchronization and on Roll20 editor pages for chat delivery. No
Roll20 bot or browser runs on the server.

### Install

1. Install Violentmonkey from the official Firefox Add-ons site.
2. Sign in to the TTRPG application as the DM and open **Extension**.
3. Choose **Install Roll20 Bridge** and approve Violentmonkey's prompt.
4. Return to the Extension page, reload it, and choose **Sync Bridge**.
5. Open or reload the Roll20 editor.

### Backend Socket

The content script supports either environment:

- local development: `ws://127.0.0.1:6767/ws/chat`
- hosted deployment: `wss://bossadapt.org/ttrpg/ws/chat`

The DM console derives the endpoint and obtains the credential from its
authenticated backend session. Sync Bridge stores them in Violentmonkey's
private script storage. The credential is not embedded in this file or kept in
frontend state.

Syncing from the local console selects development. Syncing from the hosted
console selects production and replaces the previous configuration. There is
one installed script, not separate development and production variants.

Violentmonkey updates the script from the stable `@downloadURL` when `@version`
increases. Stored bridge configuration survives an update. Reload an already
open Roll20 tab after installing or updating script code.

### URL Smoke Test

After synchronization, verify the userscript activates on both:

- `https://app.roll20.net/editor`
- `https://app.roll20.net/editor/<game-path>`

The browser console should show the `[ttrpg-roll20-bridge]` connection message.
If authentication is rejected or another Roll20 tab replaces this bridge, use
**Resync Bridge** to reactivate the intended tab.
