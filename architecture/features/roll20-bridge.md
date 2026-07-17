# Roll20 Bridge

## Purpose and trust boundary

Roll20 is the table-facing chat surface and play log. The backend sends output
through a Firefox/Violentmonkey userscript running in each participating user's
browser. Roll20 is output-only: it never mutates backend state, authenticates an
application user, or becomes a source of campaign truth.

## Per-user binding

Application routes in
[`backend/features/chat/`](../../backend/features/chat/) expose bridge status,
signed synchronization configuration, and explicit chat delivery. For an
authenticated DM or a player with a claimed instance, the backend derives a
binding identity and issues a signed, scoped token. The service secret is not
returned to the app, embedded in the userscript, or stored in frontend state.

Bindings are isolated:

- DM-authored messages use only the DM binding.
- Player-authored messages use only the acting claimed-instance binding.
- No disconnected user falls back to another person's browser.
- Multiple users can remain connected concurrently.
- Within one binding, the newest authenticated Roll20 tab replaces the older
  connection to prevent duplicate delivery.

Action visibility is selected per `perform_action` invocation and resolved
before bridge delivery. Public invocations are sent unchanged. GM invocations
use Roll20's `/w gm <message>` syntax for every output step; because action
rolls are normalized to inline `[[expression]]` rolls first, the same whisper
path supports styled cards, labeled rolls, unlabeled rolls, and plain text. An
explicit `/w gm` or `/gmroll` command is preserved without double wrapping.

The bridge transports exact chat input and has no template-specific logic.
Structured action rolls are composed by the backend as native
`&{template:simple}`, `&{template:dmg}`, or `&{template:default}` commands;
Roll20 and the campaign character sheet supply their visual styling. This keeps
public and `/w gm` cards on the same acknowledged per-user delivery path as
ordinary messages.

The `/ws/chat` endpoint in
[`backend/routes/ws.py`](../../backend/routes/ws.py) validates the signed token
before registering the service connection. Application player/DM tokens are
not service tokens.

## Userscript synchronization

[`violentmonkey_extension/roll20-bridge.user.js`](../../violentmonkey_extension/roll20-bridge.user.js)
runs in two contexts:

- On the TTRPG frontend, it participates in a page/userscript handshake that
  detects installation and accepts synchronized endpoint/token/binding
  configuration.
- On supported Roll20 editor URLs, it opens `/ws/chat`, receives delivery
  requests, writes exact message text into Roll20 chat, and reports correlated
  success or bounded failure information.

Violentmonkey private storage holds one active binding per browser profile.
Synchronizing a new character, user, or environment replaces the prior local
configuration. Every DM/player must install and sync their own browser profile.

The frontend workflow is
[`frontend/src/features/extension/ExtensionPage.tsx`](../../frontend/src/features/extension/ExtensionPage.tsx)
with the isolated-world channel in
[`bridgeUserscriptChannel.ts`](../../frontend/src/features/extension/bridgeUserscriptChannel.ts).
It detects the script, guides install/reload/login, requests scoped sync data,
sends configuration without retaining the token in app state, reports current
bridge status, and can send a best-effort test message.

## Acknowledged delivery

The backend assigns a delivery ID and waits for a matching acknowledgement from
the same binding and connection generation. It rejects acknowledgements from a
different binding or stale/replaced connection. Disconnect, replacement,
timeout, browser injection failure, or negative acknowledgement fails the
delivery.

Delivery is fail-fast and not queued. For action execution, all backend
mutations remain isolated until required messages are acknowledged. Failure
rolls those mutations back before persistence or patch broadcast. A
multi-message action can still leave an earlier chat message visible when a
later message fails because Roll20 has no retraction transaction.

Bridge connection/disconnection broadcasts binding-specific status events to
application sessions. Being synchronized and being currently connected are
different states; configuration can succeed while no Roll20 editor tab is
open.

## Deployment

The same userscript identity is served locally by Vite and in production under
`/ttrpg/roll20-bridge.user.js`. Endpoint configuration selects local `ws://` or
production `wss://` during sync. Build and public verification assert the
expected metadata and hosted artifact.

## Principal tests

- [`backend/tests/test_ws.py`](../../backend/tests/test_ws.py) covers token
  scoping, bindings, status, replacement, delivery correlation, failures, and
  isolation.
- [`backend/tests/test_sheet_runtime.py`](../../backend/tests/test_sheet_runtime.py)
  covers action commit/rollback around delivery.
- Extension page, userscript channel, and artifact tests live under
  [`frontend/src/features/extension/`](../../frontend/src/features/extension/).
- Hosted browser installation and exact-once delivery remain part of the manual
  smoke-test checklist in the active plan.

## Limitations

The backend cannot retract a Roll20 chat message, operate Roll20 without a
participating user's browser, or guarantee delivery while that user's bound tab
is disconnected. It intentionally does not keep a second authoritative roll
log in the application.
