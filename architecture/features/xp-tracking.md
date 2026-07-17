# XP Tracking

## Purpose and ownership

XP is derived from a backend-owned registry of kills and explicit adjustments.
Characters do not maintain an independently mutable total. Temporary parties
control who participates in a new kill, while each historical kill snapshots
the participant identities and award values that applied at record time.

Models in [`backend/state/models/xp.py`](../../backend/state/models/xp.py)
include:

- `Party`: current named grouping of spawned player instance IDs;
- `KillRecord`: monster identity, canonical base XP, participant snapshots,
  participant count, percentage/share, occurrence time, notes, and submission
  attribution;
- `XpAdjustment`: an explicit signed amount and reason for one instance.

Templates provide enemy XP value and player XP threshold fields. State also
stores which enemy template names the DM currently exposes for player final
blow submission.

## Parties and historical snapshots

A spawned player instance may belong to at most one current party. Party edits
validate every member and are DM-only. When a kill is recorded, the backend
copies each participant's instance ID and display name, calculates the equal
per-participant award with two-decimal precision, and stores the party size and
percentage used.

Later party edits, visibility changes, renames, or despawns do not rewrite
historical kills. Despawning removes current party membership but retained kill
participant snapshots continue contributing to the historical record.

## DM and player recording

DMs can record arbitrary kills, correct or delete records, set enemy XP values,
control player-recordable enemy visibility, set character thresholds, and add
or delete explicit XP adjustments.

An assigned player can submit a final blow only for a currently exposed enemy
name. The backend derives the submitting character from the session, resolves
the canonical enemy template and XP, and selects the current party. An
ungrouped character records a solo 100-percent award; a grouped character
records every current party member. Client-supplied participant or XP spoofing
is not accepted, and request-ID deduplication prevents replayed awards.

## Projection and redaction

[`backend/features/xp_tracker/`](../../backend/features/xp_tracker/) builds a
dedicated `xp_tracker` response appropriate to the requesting session and
broadcasts updated projections after mutations. DMs receive management data for
all relevant templates/instances, parties, kills, adjustments, and visibility.
Players receive only their assigned character's progress/history and the safe
enemy names they may currently submit; hidden XP values and other characters'
records are withheld.

Total XP is rederived from kill participant awards plus adjustments. Progress
to the template's current threshold is a projection, so reload and import do
not depend on a separately stored total remaining synchronized.

## Frontend

[`frontend/src/features/xp/XpTrackerPage.tsx`](../../frontend/src/features/xp/XpTrackerPage.tsx)
is the DM management workspace. Player/character progress and history use
`SheetXpProgressBar` and `SheetKillsSection`. After its initial tracker request,
the UI relies on pushed WebSocket updates instead of a manual refresh control.

## Principal tests

- [`backend/tests/test_xp_tracker.py`](../../backend/tests/test_xp_tracker.py)
  covers parties, solo/group awards, snapshots, visibility, player anti-spoof
  checks, edits, despawn behavior, adjustments, and derived totals.
- XP frontend components and request behavior are tested under
  [`frontend/src/features/xp/`](../../frontend/src/features/xp/).
- Seed acceptance tests verify representative in-progress and threshold-ready
  characters.

## Limitations

XP does not automatically level a character, grant points, or unlock mastery
content. Parties are intentionally temporary coordination state rather than a
historical identity stored on every kill.
