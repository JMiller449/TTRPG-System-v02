# XP Tracking

## Purpose and ownership

XP is derived from a backend-owned registry of kills and explicit adjustments.
Characters do not maintain an independently mutable XP total. Temporary parties
control who participates in a new kill, while each historical kill snapshots
the participant identities and award values that applied at record time.

Models in [`backend/state/models/xp.py`](../../backend/state/models/xp.py)
include:

- `Party`: current named grouping of spawned player instance IDs;
- `KillRecord`: monster identity, canonical base XP, participant snapshots,
  participant count, percentage/share, occurrence time, notes, and submission
  attribution;
- `XpAdjustment`: an explicit signed amount and reason for one instance.

Templates provide enemy XP values. State owns campaign-wide derived XP progression settings and also
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
control player-recordable enemy visibility, configure derived progression, and add
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

Total XP is rederived from kill participant awards plus adjustments. The next-level
lifetime target is evaluated from current instance Attributes by
[`progression.py`](../../backend/features/xp_tracker/progression.py). The remaining
XP and readiness are backend projections; reaching the target never changes Level.

`set_xp_progression` replaces `set_sheet_xp_required`. The DM configures one campaign
curve using tuning controls (100 / 1.35 / 25 / 1.08 / 1.02 / 10 by default) or a deterministic
Attribute equation. The required `xp_growth_rate` bridge multiplies either result;
1 is normal, below 1 easier, above 1 harder. Each spawned instance owns its copy.
Tuning rounds each level cost to the nearest increment (halfway up), then sums
the costs to a lifetime target. Recommended settings give costs 7880 for 24→25,
8410 for 25→26, and 8880 for 26→27.
For current level L, the exponent is `growth_exponent ×
growth_multiplier_per_milestone^floor(L/interval)`. The multiplier applies only when `L+1` is a
milestone, so 24→25 receives the bump and 25→26 uses the increased exponent.
Tuning calculations support current levels up to 100000 and total goals up to 1e15.
Equation mode defines the
same lifetime target and rounds down to whole XP after growth. See the
[answered XP rules](../../reference-docs/rule-decisions-needed-answered.md#derived-xp-goals-2026-09-06)
for exact boundaries and semantics.

Settings are persisted privately as `State.xp_progression` and included only in DM
tracker responses. Equations cannot execute dice, arbitrary traversal, or code.
Missing/invalid Attributes and arithmetic overflow produce a safe unavailable-goal
message without interrupting the XP ledger. Numeric targets are limited to 1e15.
Schema v49 removes `xp_cap`, adds default settings and missing growth bridges,
and preserves earned-XP records and manually assigned Levels.

`get_xp_tracker` subscribes the authenticated session to fresh tracker projections
after state-sync mutations, undo, and state import. This includes changes to Level,
growth, or other equation inputs. The existing XP mutation routes also send tracker
responses. Unclaimed sessions do not subscribe to character progress.

## Frontend

[`frontend/src/features/xp/XpTrackerPage.tsx`](../../frontend/src/features/xp/XpTrackerPage.tsx)
is the DM management workspace, including the two-mode `XpProgressionEditor`. GM/player character progress and player history
use `SheetXpProgressBar` and `SheetKillsSection`. After its initial tracker
request, the UI relies on pushed WebSocket updates instead of a manual refresh
control.
The GM character-history view exposes an Add Kill dialog scoped to the selected
character. It reuses the standard kill-record request, resolves participants
from current backend-owned party membership, and supports both registered enemy
templates and arbitrary enemy/XP entries. Players retain the restricted visible
enemy final-blow form.
The shared GM and player character views place the independently stored
canonical Level Attribute beside this XP projection; XP readiness never mutates
Level automatically.

The DM party view presents the existing backend-owned parties in a party
navigator with membership counts and a derived Unassigned view, while only the
selected party's roster editor is expanded. The membership control reuses the
sheet-instance catalog hierarchy as a searchable checkbox tree, supporting
individual and folder-wide editing of the local party-membership draft. `Save
Party` is the only commit action.
Membership changes retain the existing `save_party` validation and patch flow;
the frontend does not reinterpret party membership locally.

The Parties, Kill Registry, and XP Progress views share the same lightweight
workspace-surface treatment for their primary navigation, entry, and management
regions. This keeps the three views visually related without reintroducing a
second outer frame around the full-width XP workspace.

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

The progression editor uses a responsive two-column layout with compact tuning
controls and a local `XpCurvePreview`. The user-requested client-side preview
supports both tuning and equation modes, sample growth/Attribute inputs, ranges
through 25/50/100/250, and pointer or keyboard inspection. Its default series is
incremental XP (the nonnegative difference between adjacent lifetime targets);
DMs may switch to lifetime targets. Non-Level sample Attributes stay fixed across
the curve. This is an unsaved illustration only: no preview result crosses the
request boundary or replaces authoritative character progress. A bounded arithmetic
parser evaluates preview equations without JavaScript eval. Preview controls live
outside the save form so incomplete samples cannot prevent saving campaign settings.

Schema v50 adds `growth_increase_per_milestone` (default 0.02), upgrades exact old
default configurations to the corrected defaults, and preserves customized knobs.
Tuning now represents individual costs; formula mode keeps its lifetime-target semantics.

Schema v51 replaces additive growth increase with a growth multiplier. Both
milestone controls use 1 as neutral and percentages above 1 as increases. Migration
converts legacy growth increase d to 1+d; saved curves therefore use the new
compounding semantics without changing earned XP or manually assigned Level.
The graph retains valid points when a later level exceeds the numeric limit and
restricts its axis and inspection slider to those points, with an explanatory message.

The Growth Multiplier / Milestone defaults to 1 (neutral) for new settings or
missing editor/preview values. The explicit recommended preset uses 1.02; existing
authored multipliers remain intact.

Kill records include a positive integer `quantity` (1–10000, default 1). DM
registry creation, DM character dialogs, player final-blow submission, and DM
historical editing all support batches such as “5× Zombie”. `base_xp` remains
per enemy; each participant's single-kill share is rounded as before, then
multiplied by quantity. A batch therefore awards exactly the same XP as separate
identical kills with the same participants. Each batch snapshots one roster and
occurrence time; later party changes do not rewrite it. Editing a batch recalculates
its award, while omitted quantity in legacy edit requests preserves the stored
quantity. Player batches retain server-selected XP, character, and participants.
Schema v52 backfills quantity 1 on historical records. Quantity is projected in
both registry/history views; the row count remains the count of records.
