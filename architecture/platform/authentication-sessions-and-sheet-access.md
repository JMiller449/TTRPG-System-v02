# Authentication, Sessions, and Sheet Access

## Purpose and scope

Authentication establishes an application role; sheet access narrows a player
session to a specific spawned character. These are separate concerns so a
shared player code can enter the application without granting access to every
character, while a generated character code can authenticate and select its
assigned instance in one flow.

## Roles and sessions

Application sessions in
[`backend/features/session/`](../../backend/features/session/) begin as
`unauthenticated`. The `authenticate` request accepts configured application
codes and upgrades the session to `player` or `dm`. A DM satisfies routes whose
minimum role is player; an unauthenticated session can call only routes marked
unauthenticated, currently authentication itself.

Authentication request handling and application-token validation live in
[`backend/features/auth/`](../../backend/features/auth/). Session objects and
connection assignment remain owned by the separate session feature.

Invalid authentication does not require opening a new application WebSocket;
the client can retry on the same connection. Disconnecting removes the
in-memory session. Frontend reconnection reuses the prior authentication token
and requests state reconciliation after the transport returns.

The Roll20 bridge authenticates separately on `/ws/chat` as service using a
signed binding token. Service credentials are not accepted as application
player/DM credentials and service sessions do not enter the application route
registry.

Configuration lives in
[`backend/core/config.py`](../../backend/core/config.py). Development permits
documented local defaults. Non-development environments require explicit,
distinct player, DM, and service codes. Frontend `VITE_*` auth values are only
optional development helpers because compiled frontend configuration is
public.

## Character access codes

DM-only requests in
[`backend/features/sheet_access/`](../../backend/features/sheet_access/) create
or rotate a code for a spawned instance and list active assignments. The
persisted `SheetAccessCode` record associates a code with a template sheet and
instance. Codes are private state: they are omitted from ordinary snapshots and
patches and are returned only through dedicated DM responses.

A player may submit `claim_sheet_access_code`. The backend validates that the
code still references an existing player character, assigns the instance to
the session, and returns `sheet_access_claimed`. The frontend then requests a
full resync so redaction is recalculated for the newly assigned character;
without that resync, pre-existing private-to-other-player state would remain
absent from the client's earlier snapshot.

Generated character codes are also recognized during authentication, allowing
the login and claim steps to be presented as one player-facing action. Shared
player authentication still requires a later claim before the character sheet
workspace becomes available.

## Authorization boundaries

Feature routes declare broad role requirements, while service-level access
checks enforce entity ownership:

- DMs may manage templates, instances, access codes, and all characters.
- Players may view and mutate only the spawned instance assigned to their
  current session, and only through explicitly player-available operations.
- Template notes, DM-only entities, private item data, other characters'
  runtime applications, and access codes are redacted or withheld.
- A player-provided sheet or instance ID is always validated against the
  session assignment; it is never treated as authorization by itself.

Shared access helpers are in
[`backend/features/sheet_access/service.py`](../../backend/features/sheet_access/service.py).
Per-session snapshot and patch filtering is described in
[State sync, redaction, and undo](state-sync-redaction-and-undo.md).

## Frontend flow

[`frontend/src/features/auth/SessionLanding.tsx`](../../frontend/src/features/auth/SessionLanding.tsx)
collects login codes. A player without a completed character selection is sent
to [`PlayerEntry.tsx`](../../frontend/src/features/auth/PlayerEntry.tsx).
DM code management is surfaced through
[`SheetAccessCodesPanel.tsx`](../../frontend/src/features/auth/SheetAccessCodesPanel.tsx).
Authentication truth and assigned state remain server-owned; the frontend only
retains local connection/session presentation state and the selected active
sheet ID.

## Principal tests

- [`backend/tests/test_auth_config.py`](../../backend/tests/test_auth_config.py)
  and [`backend/tests/test_config.py`](../../backend/tests/test_config.py)
  cover environment and token constraints.
- [`backend/tests/test_sheet_access.py`](../../backend/tests/test_sheet_access.py)
  covers generation, rotation, claim, privacy, and ownership checks.
- [`backend/tests/test_permissions.py`](../../backend/tests/test_permissions.py)
  and [`backend/tests/test_ws.py`](../../backend/tests/test_ws.py) cover role
  enforcement and bootstrap behavior.
- Frontend auth and identity behavior is covered by app, configuration, and
  `useGameClient` tests under `frontend/src/`.

## Limitations

Sessions and sheet claims are in-memory connection identity, not durable user
accounts. Multi-campaign identity and durable account binding remain later
roadmap work in the active plan.
