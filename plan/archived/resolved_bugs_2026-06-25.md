# Resolved Bugs — June 25, 2026

This archive records the integration bugs formerly tracked in section 15 of
`plan/active/PLAN.md`. All listed bugs were resolved and verified before being
removed from the active roadmap.

## BUG-001 — Landing page did not connect until a code was submitted

- **Priority:** P1
- **Area:** Frontend / WebSocket lifecycle
- **Resolution:** The app connects whenever transport state is `disconnected`,
  independent of authentication state.
- **Regression coverage:** Initial application connection behavior.

## BUG-002 — Backend replaced client request IDs

- **Priority:** P1
- **Area:** Backend protocol / Frontend request tracking
- **Resolution:** Valid client request IDs are preserved. The backend generates
  an ID only when one is absent, allowing pending frontend intents to correlate
  with their terminal response and retain their original labels.
- **Regression coverage:** Request-ID preservation and frontend correlation.

## BUG-003 — Action requests could resolve more than once

- **Priority:** P2
- **Area:** Frontend protocol handling
- **Resolution:** State patches update authoritative state without completing a
  pending action. `action_executed` is the sole terminal success event for
  `perform_action`.
- **Regression coverage:** Multi-event action responses sharing a request ID.

## BUG-004 — Roll20 bridge status became stale

- **Priority:** P1
- **Area:** Backend WebSocket integration / Frontend status
- **Resolution:** `/ws/chat` connection and disconnection lifecycle changes
  broadcast `roll20_bridge_status` to authenticated application clients.
- **Regression coverage:** Bridge connection and disconnection broadcasts.

## BUG-005 — Generated sheet access codes were hidden from the GM

- **Priority:** P1
- **Area:** GM frontend / Character-sheet provisioning
- **Resolution:** `sheet_access_codes` events populate frontend UI state and a
  persistent GM panel displaying instance identification, copy controls, and
  refresh support.
- **Regression coverage:** Event parsing, adaptation, and reducer storage.

## BUG-006 — Firefox extension missed the exact Roll20 editor URL

- **Priority:** P1
- **Area:** Firefox extension
- **Resolution:** The manifest matches both
  `https://app.roll20.net/editor` and
  `https://app.roll20.net/editor/*`. The extension README contains a smoke-test
  checklist.

## BUG-007 — Public Roll20 commands were formatted as ordinary text

- **Priority:** P1
- **Area:** Backend / Roll20 message formatting
- **Resolution:** Labeled public rolls use inline-roll syntax, unlabeled public
  rolls retain a leading `/r`, and GM-only rolls use valid whisper syntax.
- **Regression coverage:** Public, GM-only, labeled, unlabeled, advantage, and
  disadvantage formatting.
- **Manual follow-up:** A live Roll20 browser smoke test remains recommended.

## BUG-008 — Uvicorn was absent from backend dependencies

- **Priority:** P2
- **Area:** Backend setup / Dependency management
- **Resolution:** `uvicorn>=0.30,<1` is declared in
  `backend/requirements.txt`, matching the documented startup path.

## BUG-009 — Stale Roll20 bridge errors survived successful delivery

- **Priority:** P2
- **Area:** Frontend status and feedback
- **Resolution:** Connected bridge status and successful action delivery clear
  only Roll20 connection-specific errors while preserving unrelated errors.
- **Regression coverage:** Selective stale-error cleanup.

## Verification at archival

- Backend: `285 passed`
- Frontend: `32` test files and `227` tests passed
- TypeScript build: passed
- ESLint: passed
- Conflict-marker scan: clean
