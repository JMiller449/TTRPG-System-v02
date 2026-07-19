# Persistence, Migrations, and Backups

## Purpose and ownership

The backend owns one canonical in-memory `State`. `state_dumpy.json` is a
recovery checkpoint for that state, not a database and not a client-facing
query surface. Ordinary gameplay reads and writes operate on the in-memory
object through state sync.

## Checkpoint format and writes

[`backend/state/store.py`](../../backend/state/store.py) serializes a versioned
envelope containing `schema_version` and the full private state document.
Writes go to a temporary sibling file, flush and synchronize it, rotate a valid
primary to `state_dumpy.json.bak`, and atomically replace the primary. An invalid
primary is not promoted over a recoverable backup.

The application loads the primary at startup, falls back to the backup when the
primary is corrupt, unsupported, or cannot reconstruct a valid state, and
otherwise creates fresh default state. The FastAPI lifespan periodically dumps
state and writes once more during orderly shutdown. State-sync mutations also
persist committed results.

## Schema migrations

[`backend/state/migrations.py`](../../backend/state/migrations.py) owns a
sequential migration registry. Legacy unversioned files are treated as schema
version 0 and upgraded one version at a time to the current schema, presently
version 32. Future-version checkpoints are rejected rather than guessed at.

Migrations transform persisted JSON envelopes before `State.from_dict`
constructs current models. New state-shape changes must add a sequential
migration, advance the current version, and include focused tests for legacy
and current round trips. A migration must preserve authored campaign choices;
guarded migrations update known defaults without overwriting customized data.

Schema version 32 adds safe defaults for persisted fractional reaction state,
contribution-point balances and transaction records, and per-instance action
pins. Existing instances begin with zero reactions and contribution points and
no pins; normal runtime synchronization establishes any authored reaction
maximum after load.

Schema version 29 adds explicit visibility to authored Roll20 message steps and
backfills existing steps as `public`, preserving all pre-feature behavior.

Schema version 30 upgrades only exact built-in baseline and canonical action
definitions from free-form Roll20 messages to structured roll cards. Any
campaign-customized action remains untouched.

Schema version 31 removes persisted visibility from Roll20 message and roll
steps. Visibility is now invocation-local input on `perform_action`, so existing
action definitions retain their mechanics while no longer carrying a competing
authored destination.

## Export and import

The DM-only state-backup routes in
[`backend/features/state_backup/`](../../backend/features/state_backup/) export
the complete private persisted envelope as JSON. This includes data omitted
from player/DM application snapshots, such as access codes and derived private
projection bookkeeping.

Import parses and migrates the supplied envelope, rebuilds the current model,
reconciles equipment-derived effects, writes the replacement checkpoint, and
broadcasts new full snapshots. Import is intentionally a whole-state
replacement. It clears runtime patch replay, request-deduplication, and undo
history.

The frontend backup workspace is
[`frontend/src/features/stateBackup/StateBackupPage.tsx`](../../frontend/src/features/stateBackup/StateBackupPage.tsx),
with state-safety/undo controls in
[`frontend/src/features/stateSync/StateSafetyPanel.tsx`](../../frontend/src/features/stateSync/StateSafetyPanel.tsx).
The frontend never edits the exported document into its local state directly.

## Operational boundaries

- Routine production deployment preserves the server checkpoint and backup.
- Deployment archives intentionally exclude local checkpoint files.
- A first deployment without a checkpoint starts from fresh default state.
- `just seed` is a development replacement workflow and must not run against
  production or while a backend process can overwrite it from memory.
- Campaign backup exports are the recoverable long-term safety mechanism; the
  in-memory undo stack is intentionally bounded.

## Principal tests

- [`backend/tests/test_state_store.py`](../../backend/tests/test_state_store.py)
  covers atomic writes, backup fallback, envelope validation, migrations, and
  private-state preservation.
- [`backend/tests/test_state_sync.py`](../../backend/tests/test_state_sync.py)
  covers state replacement interactions.
- [`backend/tests/test_ws.py`](../../backend/tests/test_ws.py) covers DM-only
  export/import contracts and full-snapshot broadcasts.

## Limitations

There is no transactional database, multi-campaign storage, query index, or
cross-process state coordination. Running multiple backend processes against
the same checkpoint would violate the singleton authority model.
