## TTRPG Roll20 Chat Bridge Userscript

> LLM note: Before editing code, reference the repo-root `README.md` for the backend-first contract model, protocol/codegen workflow, and implementation rules.

Firefox userscript managed by Violentmonkey. It runs on the TTRPG frontend for
configuration synchronization and on Roll20 editor pages for chat delivery. No
Roll20 bot or browser runs on the server.

### Install

1. Sign in to the TTRPG application and open **Extension**. Players must claim
   their character first. The page immediately checks for the bridge userscript.
2. If the bridge is not detected, install Violentmonkey if needed, choose
   **Install or Update Roll20 Bridge**, and approve Violentmonkey's prompt.
3. Return to the Extension page and choose **Reload to Activate** once after a
   new installation, then choose **Sync Bridge**.
4. Open or reload the Roll20 editor.

### Backend Socket

The content script supports either environment:

- local development: `ws://127.0.0.1:6767/ws/chat`
- hosted deployment: `wss://bossadapt.org/ttrpg/ws/chat`

The Extension page derives the endpoint and obtains a signed bridge token for
the authenticated DM or claimed player sheet. Sync Bridge stores the endpoint,
token, and binding label in Violentmonkey's private script storage. The token is
not embedded in this file or kept in frontend state.

Every player and the DM installs and synchronizes their own userscript. A
player's bridge only receives messages initiated through that player's claimed
sheet; DM messages only use the DM bridge. Opening a second Roll20 tab replaces
the first connection for the same binding without disconnecting other users.

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
If authentication is rejected, the current character changes, or another
Roll20 tab replaces this binding, use **Resync Bridge** to reactivate the
intended tab.
