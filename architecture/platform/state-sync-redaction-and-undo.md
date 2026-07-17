# State Sync, Redaction, and Undo

## Purpose and scope

State sync is the only supported path for committed game-state mutations. It
serializes changes, increments the authoritative version, persists the result,
and distributes a role-appropriate view to every application session.

## Bootstrap, patches, and replay

After successful authentication,
[`backend/features/state_sync/`](../../backend/features/state_sync/) sends a
full `state_snapshot` with the current `state_version`. Later mutations emit
ordered `state_patch` events using `set`, `add`, `remove`, and numeric increment
operations with JSON-pointer-like paths.

The service retains a bounded patch history. A reconnecting client sends
`resync_state` with its last seen version. The backend replays every missing
patch when the requested version is valid and still covered; otherwise it
sends a fresh snapshot. A client that is already current receives no redundant
state mutation.

[`frontend/src/infrastructure/ws/eventAdapters.ts`](../../frontend/src/infrastructure/ws/eventAdapters.ts)
applies protocol patches to a cloned backend-state document and projects that
document into the frontend domain snapshot. The state reducer then replaces
its normalized server-state collections. Patch application is therefore an
authoritative incremental transport optimization, not a separate client
source of truth.

## Mutation transaction

`StateSyncService` protects mutations with a lock so simultaneous client
intents produce one ordered version stream. Feature services submit patch
operations or a mutation callback rather than changing `StateSingleton`
directly. The service validates and applies the mutation, runs registered
reconciliation hooks such as derived equipment effects, records inverse
operations when eligible, dumps the checkpoint, and only then broadcasts the
result.

Processed request IDs are retained in a bounded cache. Repeating the same ID
does not repeat a state mutation, protecting reconnect/retry flows from
duplicate effects. A bounded internal mutation-audit trail records version,
request identity, actor role, request type, affected paths, and relevant entity
IDs without copying mutation values.

Some operations intentionally opt out of undo, including action-history
recording. DM `undo_last_state_change` applies the inverse of the latest
eligible mutation and broadcasts it as a new authoritative version. Undo is a
bounded runtime convenience, not a replacement for exported campaign backups.

## Redaction

Snapshots and patches are filtered per recipient session. Redaction is applied
to the state shape and again to individual patch operations so replay does not
bypass current visibility rules.

Filtering includes:

- Private roots such as direct-effect projections are never public.
- Sheet access codes are retrieved through dedicated DM-only events rather
  than ordinary state sync.
- Players receive their assigned instance and player-visible supporting
  definitions, not other player runtime state or DM-only templates.
- Template notes and GM-only attribute/item/condition details are removed from
  player views.
- Item definitions remain visible to a player when required to render an item
  already owned by the assigned character, even if the catalog definition is
  no longer generally published.
- Action history and active condition/effect applications are filtered and may
  be reduced to player-safe content.

Redaction is a server security boundary. Frontend hiding is presentation only
and must not be relied on to protect data.

## State replacement

Importing a campaign backup replaces the entire state, advances the version,
clears patch, request-deduplication, and undo histories, and sends complete
role-filtered snapshots to all clients. This avoids attempting to express an
arbitrary imported document as an incremental patch sequence.

## Principal implementation

- [`backend/features/state_sync/service.py`](../../backend/features/state_sync/service.py)
  owns serialization, mutation helpers, replay, redaction, audit, and undo.
- [`backend/features/state_sync/route.py`](../../backend/features/state_sync/route.py)
  registers resync and DM undo requests.
- [`backend/state/store.py`](../../backend/state/store.py) owns the in-memory
  singleton and checkpoint writes.
- Frontend transport and reconciliation live under
  [`frontend/src/infrastructure/ws/`](../../frontend/src/infrastructure/ws/) and
  [`frontend/src/app/state/`](../../frontend/src/app/state/).

## Principal tests

- [`backend/tests/test_state_sync.py`](../../backend/tests/test_state_sync.py)
  covers mutations, redaction, replay, request deduplication, audit, and undo.
- [`backend/tests/test_state_sync_integration.py`](../../backend/tests/test_state_sync_integration.py)
  covers concurrent clients and reconnect consistency.
- [`frontend/src/infrastructure/ws/eventAdapters.test.ts`](../../frontend/src/infrastructure/ws/eventAdapters.test.ts)
  and reducer tests cover patch and snapshot reconciliation.

## Limitations

Patch, undo, audit, and processed-request histories are bounded and in memory.
They reset on process restart and full state replacement. The JSON checkpoint,
not those runtime histories, is the durability boundary.
