# TTRPG-System-v02 — Full Code Review

**Date:** 2026-07-26
**Scope:** `backend/`, `frontend/`, `violentmonkey_extension/`, `deploy/`, docs and policies.
**Nature:** Read-only review. No source files were modified.

Each finding is tagged with how it was established:

- **[EXEC]** — reproduced by running code in this environment.
- **[CODE]** — established by reading the implementation; behaviour follows directly from the code.
- **[HYPOTHESIS]** — most likely explanation for a reported symptom; includes how to confirm.

---

## 0. Disclosure — a file changed during this review

I ran the backend test suite (`pytest backend/tests`) as part of the review. That run **deleted
`state_dumpy.json`** from the repo root. This was not a mistake in how I ran it — it is finding
**C-1/C-2 below**, and it happens to anyone who runs the documented test command.

What happened, and what I did:

- `state_dumpy.json` (15,679 bytes, 19:19) was rotated into `state_dumpy.json.bak` and then the
  replacement step failed, leaving no primary checkpoint. The previous `.bak` (17:45) was
  overwritten in the process and is unrecoverable.
- I restored `state_dumpy.json` from `state_dumpy.json.bak` (byte-identical).
- **No campaign data was lost**: the checkpoint that was there was already test residue from an
  earlier run — it contains 1 sheet, 1 instance, 1 action, 0 items, 0 proficiencies. Your real
  content was already gone before I started, almost certainly from a previous `pytest` run.

Both files now hold identical content. If you were relying on that checkpoint, re-run `just seed`.

---

## 1. Critical — data loss and state integrity

### C-1. The backend test suite writes to the live state checkpoint **[EXEC]**

`backend/tests/conftest.py` resets `state_sync_service` between tests but never isolates
`backend.state.store.STATE_PATH`. Only three test modules patch it
(`test_action_history.py:244`, `test_dm_examples_acceptance.py:72`, `test_state_store.py:28`).
Every other test that calls `state_sync_service.apply_mutation` — `test_ws.py`,
`test_sheet_runtime.py`, `test_state_sync.py`, `test_sheet_admin_*.py`, and others — reaches
`StateSingleton.dumpState()` and writes to the **real repo-root `state_dumpy.json`**.

Consequences:

- On Linux (production/dev parity), running the documented `pytest backend/tests` **silently
  overwrites the developer's campaign checkpoint** with whatever state the last test left in the
  singleton. The current on-disk checkpoint is exactly that: test residue.
- On Windows it destroys the file outright (C-2).

**Fix direction:** an autouse fixture in `conftest.py` that monkeypatches `STATE_PATH` to
`tmp_path` for every test, plus a guard in `_write_checkpoint` that refuses to write when
`APP_ENV == "test"` and the path is the repo root.

### C-2. `_write_checkpoint` cannot complete on Windows, and destroys the checkpoint when it fails **[EXEC]**

`backend/state/store.py:72-101`:

```python
if path.exists() and _load_checkpoint(path) is not None:
    os.replace(path, backup_path)     # primary -> .bak
    _fsync_directory(path.parent)     # <-- raises PermissionError on Windows
os.replace(temporary_path, path)      # never runs
finally:
    temporary_path.unlink(missing_ok=True)   # the only remaining copy is deleted
```

`_fsync_directory` opens the directory with `os.open(...)` and `fsync`s it. Windows does not permit
this; I confirmed `PermissionError: [Errno 13]` on a plain directory handle. The primary has
already been renamed, the temp is deleted by `finally`, and the process ends with **no primary
checkpoint**.

Two separate defects here:

1. **Not cross-platform.** Local development on Windows cannot persist state at all. Every mutation
   raises. (`frontend/package.json` has the same problem: `generate:protocol` invokes
   `../backend/.venv/bin/python`, which does not exist on Windows — it is `Scripts/python.exe`.)
2. **Not crash-safe.** The rotate-then-write ordering means *any* failure between the rename and the
   replace loses the primary. The same window exists on Linux for a full disk, a read-only mount, or
   a `SIGKILL`. Write-temp → fsync-temp → copy primary to `.bak` → `os.replace(temp, primary)` would
   be safe; the directory fsync should be best-effort (`except (OSError, PermissionError): pass`).

### C-3. A failed checkpoint write leaves memory and clients divergent **[CODE]**

`backend/features/state_sync/service.py:1366-1386`:

```python
if ops:
    inverse_ops = self._build_inverse_ops(previous_state, ops)
    ...
    StateSingleton.dumpState()          # persist
    patch = self._next_patch(patch_ops) # THEN version + broadcast
```

The rollback `try/except` (lines 1340-1365) wraps only `mutation(state)` and `before_commit`.
`dumpState()` is outside it. If persistence fails, the mutation is **already applied in memory**,
no `state_patch` is emitted, no version is incremented, and the requester gets an error. Every
client now shows stale values that the server considers authoritative, with no drift detection —
the version-gap resync in `GameClient.ts:263-280` cannot fire because no version was consumed.

On Windows this is the normal case, and it is exactly what the failing `test_ws.py` assertion shows:
the client receives `{"type": "error", "reason": "[Errno 13] Permission denied: ..."}` in place of
`action_executed`, while the action's mutations stand.

### C-4. Formula errors are unisolated and can take down connect/mutate for everyone **[EXEC]**

`evaluate_resource_maximum` (`backend/features/formula_runtime/service.py:274`) propagates
exceptions. `evaluate_sheet_stats` (line 248) deliberately swallows them; the resource path does not.
I confirmed:

```
'10 / 0' -> RAISES ZeroDivisionError
'1 +'    -> RAISES SyntaxError
```

Where that matters:

- `synchronize_resource_bounds_mutation` calls `evaluate_resource_maxima` for **every instance on
  every mutation** (`sheet_runtime/service.py:1176`). One bad formula anywhere blocks all state
  changes for all players.
- `_build_snapshot_locked` calls it for **every sheet and instance** (`state_sync/service.py:707-736`).
  One bad formula and nobody can connect — bootstrap throws before any snapshot is sent.
- `backend/routes/ws.py:130` catches only `PermissionError`, `PersistedStateError`, `ValueError`.
  `ZeroDivisionError` and `SyntaxError` escape the receive loop entirely: the socket is dropped with
  no error message and no log line.

Authoring only validates alias *paths* (`sheet_admin/formulas/service.py:60`, `build_formula`), never
that the text parses or evaluates. Today `apply_mutation`'s rollback happens to reject a bad formula
at save time (the bounds sync runs inside the `try`), so the main entry point is
`import_state_backup` (`state_backup/service.py:37-56`), which validates schema only — and calls
`replace_state_and_broadcast_snapshots`, which **writes the new state to disk before it knows it can
serve it** (`state_sync/service.py:786-808`). A bad import therefore persists an unservable state.

**Fix direction:** validate formulas at authoring time by evaluating them; wrap per-sheet projection
in try/except in the snapshot builder so one broken sheet degrades to "unavailable" instead of a
global outage; add a catch-all `except Exception` with logging in the `/ws` loop.

### C-5. `**` is unbounded — a single formula can freeze the server **[CODE]**

`_ALLOWED_BINARY_OPERATORS` includes `ast.Pow` with no operand ceiling
(`formula_runtime/service.py:32-39`). `2 ** 2 ** 40` in any formula field burns CPU indefinitely
inside the single-threaded event loop, while holding the global state lock. Dice count and sides are
capped; exponent is not. Either drop `Pow` or bound both operands.

---

## 2. High — architecture

### A-1. Per-mutation cost is O(entire state), four times over **[CODE]**

Every single state change — a 1 HP tick, a checkbox — does all of this under one global
`asyncio.Lock`:

1. `deepcopy(state)` for the undo baseline (`state_sync/service.py:1339`).
2. Three full-state reconciliation passes: `synchronize_equipment_augmentations_mutation`,
   `synchronize_resource_bounds_mutation` (which re-evaluates health/mana formulas for *every*
   instance), `synchronize_pinned_actions_mutation` (which walks every instance's whole inventory
   and every item's action grants).
3. `json.dump(state.to_dict(include_private=True))` of the entire state, plus `fsync`.
4. **A full re-read, re-migrate and `State.from_dict()` of the previous checkpoint** — `store.py:94`
   calls `_load_checkpoint(path)` purely to decide whether to rotate the backup.
5. Two directory `fsync`s.
6. Then a per-session `deepcopy` of the patch for redaction.

This is a synchronous, blocking, whole-state operation on the event loop. It works at today's
scale (15 KB state) and degrades linearly with campaign size. Step 4 alone doubles the cost for no
benefit — `path.exists()` plus a size check would do, or drop the validation entirely since the temp
file has already been fsynced.

### A-2. Roll20 delivery is awaited inside the global state lock **[CODE]**

`perform_action`'s `deliver_messages` is passed as `before_commit`
(`sheet_runtime/service.py:2032-2056`), so it runs inside `apply_mutation`, inside
`state_sync_service._lock`, and it awaits per-message acknowledgement from the user's browser with
`DELIVERY_TIMEOUT_SECONDS = 12.0` (`chat/service.py:27`).

One player whose Roll20 tab is unresponsive stalls **every state mutation for the whole table** for
up to 12 seconds per message. The transactional intent (don't commit state if the roll never
reached the table) is good; the implementation makes a remote round-trip a global critical section.
Consider committing state and compensating on delivery failure, or moving delivery outside the lock
with a per-binding queue.

Related: if message 1 of 3 delivers and message 2 fails, state rolls back but Roll20 already shows
message 1. Partial delivery is not compensated.

### A-3. "Patch-first sync" is undone on the client **[CODE]**

`frontend/src/infrastructure/ws/eventAdapters.ts:279-306`: every `state_patch` triggers
`structuredClone` of the entire backend state, applies the ops, then calls `projectSnapshot(...)`
which rebuilds arrays from **every** collection. That is dispatched as `apply_snapshot`, and
`syncReducer.ts:26-101` then rebuilds every `Record` and every `*Order` array from scratch.

Net effect: the careful backend patch machinery buys nothing on the client. Every HP change
allocates a new object for every sheet, item, action and attribute in the game, breaking referential
equality for all `useMemo`/`React.memo` boundaries and re-rendering the whole tree. This is the most
likely source of any perceived UI sluggishness during play.

Also: `applySinglePatchToDraft` throws on an untraversable path; `SocketProtocolClient.handleMessage`
catches it and emits a generic `"Invalid server payload"` while leaving `protocolState` unadvanced.
The user sees a meaningless error; recovery only happens on the *next* patch via version-gap detection.

### A-4. `Sheet` and `InstancedSheet` are duplicate models — contradicting the project's own architecture rule **[CODE]**

`reference-docs/policies/architecture-guidelines.md` states:

> Use one sheet model with metadata to distinguish: `kind`: player/enemy, `mode`: template/instance.

`backend/state/models/sheet.py` implements two dataclasses duplicating 11 fields (`proficiencies`,
`items`, `stats`, `resistances`, `actions`, `attributes`, `racial_hp_multiplier`, `max_health`,
`max_mana`, `stat_bonuses`, `profile`). `InstancedSheet.stats` is `Stats | None`, which forces
`runtime_stat_owner = instance if instance.stats is not None else template` fallbacks throughout
(`state_sync/service.py:719`). `InstancedSheet` has no `id` and no `name`; both are resolved
indirectly.

The cost is visible everywhere: every service has paired `_sheet` / `_instanced_sheet` functions
(`attach_sheet_item` / `attach_instanced_sheet_item`, `set_sheet_notes` / `set_instanced_sheet_notes`,
…), the redaction code has parallel `sheets` and `instanced_sheets` branches, and the frontend keeps
`sheets` + `persistentSheets` as separate collections. This duplication is the structural reason the
"character screen still contains template editing things" item was hard to close.

### A-5. Redaction is a 340-line hand-rolled path-matching chain **[CODE]**

`_redact_patch_for_role` (`state_sync/service.py:356-693`) is a long sequence of
`if len(segments) >= N and segments[0] == "..."` blocks. Security-critical logic in this shape is
one refactor away from a leak, and the failure mode is silent.

One concrete gap I found: the `augmentations` branch (lines 605-649) handles condition-sourced
augmentations, but an augmentation whose `source.type` is not `"condition"` — i.e. equipment-sourced —
falls through the block without `continue` and is appended unconditionally at line 690. Players
therefore receive equipment augmentation records for **other characters**. Low harm, but it
demonstrates the fragility. *(Confidence: high from reading; worth a targeted test rather than a
blind fix.)*

**Fix direction:** declare visibility per state root as data (a table of root → rule) and drive both
snapshot and patch redaction from it, with a default-deny for unrecognised roots.

### A-6. The hand-written type layer duplicates the generated contract **[CODE]**

`frontend/src/domain/models.ts` (646 lines, 75 types) restates shapes the backend already generates
into `frontend/src/generated/backendProtocol.ts` (3,094 lines, 236 types). **126 files import
`@/domain/models`; 6 import the generated contract.**

Real divergence already exists: hand-written `ItemDefinition` carries `approval_status`,
`submitted_by_instance_id`, `submitted_by_name`; generated `ItemDefinitionPayload` does not (it is
the create/update shape) while `ItemPayload` does. Three near-identical item types with different
fields is exactly the drift the root README forbids:

> Do not add frontend-only transport payload shapes that drift from backend schemas.

`requestBuilders.ts` is the good pattern — it derives every type via
`Extract<ProtocolApplicationRequest, {type: T}>`. `domain/models.ts` should be re-expressed as
aliases over generated payload types (plus genuinely UI-only view models), not parallel definitions.

### A-7. Referential integrity is applied inconsistently **[CODE]**

| Entity | Delete guard |
| --- | --- |
| Item | Full — refuses while attached to any sheet **or instance** (`items/service.py:454-486`) |
| Proficiency | Partial — checks attribute references on `sheets`, `items`, `actions`; **ignores `instanced_sheets` and all proficiency *bridges*** (`proficiencies/service.py:57-86`) |
| Action | **None** — deleted unconditionally (`actions/service.py:590-604`) |

Consequences: deleting a proficiency a live character has trained leaves an orphan bridge; the
sheet then renders the raw ID with a percentage (`sheetProficiencies.ts:26` falls back to
`bridge.prof_id`). Deleting an action leaves dangling `Bridge.entry_id`s on sheets and instances and
dangling `action_grants` on items; the player sees the action until they click it, then gets an error.

### A-8. Unbounded state collections **[CODE]**

`action_history` is pruned (`prune_action_history` on every dump). These are not:
`kill_registry`, `xp_adjustments`, `contribution_point_transactions`, `sheet_access_codes`
(deactivated codes are never removed). All are serialised in full on every mutation (A-1), so
growth compounds directly into per-mutation latency and checkpoint size.

### A-9. Operational single points of failure **[CODE]**

- In-memory authoritative state means **exactly one uvicorn worker** is required. Nothing in
  `deploy/ttrpg.service` or the code enforces or documents this; adding `--workers 2` would silently
  fork divergent game states.
- Durability is one JSON file plus one generation of `.bak`, with no scheduled off-box backup —
  README defers to the DM manually clicking export. Given C-1/C-2, that is thin.
- `authenticate_token` (`auth/tokens.py:11`) compares codes with `==` rather than
  `hmac.compare_digest`; `claim_sheet_access_code` has no rate limiting and codes never expire or
  deactivate on use. Low risk for a home game; worth a line of defence since the app is on the
  public internet.
- Bridge tokens (`chat/service.py:102-118`) are HMACs over `{binding_key, version}` with **no
  expiry and no revocation**, signed with `SERVICE_AUTH_CODE`; rotating that code is the only way to
  invalidate one. The legacy path still accepts the raw `SERVICE_AUTH_CODE` as a DM binding.
- No message size limit, request rate limit, or generic exception logging on `/ws`.

---

## 3. UI/UX problems that hurt usability

### U-1. Hidden scrollbars + drag-to-pan + multi-column flow — this is the root cause of three of your open items **[CODE]**

Three interacting decisions:

1. `frontend/src/styles/shared.css:585-609` **hides the scrollbars** on the primary scrolling
   surfaces (`.character-sheet__tab-panel`, `.authoring-workspace__editor`,
   `.authoring-workspace__catalog-scroll`, the actions list, the notification stack) and sets
   `cursor: grab`.
2. `frontend/src/styles/sheet.css:1138-1149` makes non-overview character-sheet tabs a **CSS
   multi-column** container (`column-width: 420px; column-fill: auto`) that **flows sideways** when
   it runs out of vertical room, with `overflow-x: auto`.
3. `frontend/src/shared/ui/dragScroll.ts` installs document-level pointer handlers so those surfaces
   pan by click-and-drag.

Together: when a panel outgrows the viewport, content silently continues into a column to the right,
there is no scrollbar to indicate it, and the mouse wheel scrolls vertically (which does nothing).
The user must know to shift+wheel or click-drag. That is precisely your report:

> *"adding steps to actions removes the save action button (disappears below action preset details —
> no scroll bar or other way to see it)"*

The sticky `.action-editor__footer` (`actions.css:58-66`) patches the one symptom; the pattern still
applies to every other tab and authoring page.

Two further costs of the drag-scroll layer:
- A click that moves more than 6 px is **swallowed** (`dragScroll.ts:105-112`). On a trackpad this
  reads as "the button didn't work".
- Text in read-only panels **cannot be selected** — drag pans instead, and `user-select: none` is
  forced while dragging. Players cannot copy an item description or their own notes.

**Recommendation:** restore visible scrollbars on all scrolling surfaces, and drop the horizontal
column flow on character-sheet tabs in favour of ordinary vertical scrolling. Keep drag-panning only
where a surface is genuinely horizontal (the catalog strip).

### U-2. "Scaling is messed on sub-2K monitors" — the layout has no breakpoint where most people sit **[CODE]**

The shell is a fixed, non-scrolling `100dvh` frame (`app.css:6-13`) with `overflow: hidden` on
`.app-layout` (line 171) and `.app-main-panel` (line 197), relying on inner panes to scroll.
Breakpoints across the whole stylesheet: 1200, 1100, 980, 960, 900, 760, 720, 700, 640, 600, 520,
420, plus one `(min-width: 961px) and (max-height: 900px)` density tweak. The escape hatch that
turns the fixed frame back into a normally scrolling page is at **`max-width: 960px`**
(`app.css:1138-1160`).

Common real viewports:

| Display | Windows scale | CSS viewport |
| --- | --- | --- |
| 1920×1080 | 100 % | 1920 × ~945 |
| 1920×1080 | 125 % | 1536 × ~756 |
| 1920×1080 | 150 % | 1280 × ~630 |
| 1600×900 | 100 % | 1600 × ~810 |

Everything from 961 px to ~1400 px keeps the rigid frame while fixed minimums stack up: 224 px nav
(`app.css:169`) + panel padding + content grids with hard floors —
`minmax(500px, 1.2fr) minmax(320px, 0.8fr)` (line 388), `minmax(0,1fr) minmax(320px,420px)`
(line 237), `minmax(0, 1.55fr) minmax(340px, 0.85fr)` for inventory (`sheet.css:1195`). Because the
ancestors are `overflow: hidden`, the excess is **clipped, not scrollable**.

Vertically it is worse: at 630–760 px of CSS height, the header, notification slot, sheet header,
advancement row, resource cards and tab strip consume most of the frame before the tab panel gets
any space — and what's left triggers U-1's sideways flow.

**Recommendation:** raise the "release the fixed frame" breakpoint to ~1280 px and add a
`max-height: 800px` density tier; audit every `minmax(Npx, …)` floor against a 1280 × 630 viewport;
allow the shell to scroll rather than clip.

### U-3. The GM's spawned-character picker is a flat `<select>` **[CODE]**

`ActiveSheetSelector.tsx` renders every instance in `persistentSheetOrder` as one flat dropdown with
a Despawn button, defaulting to `sheetOptions[0]`. Spawn an encounter of eight goblins and the PCs
are buried among them — no grouping by player/enemy, no search, no folders, no indication of which
instances are claimed. This matches your open item about the party page. (The XP tracker's
`PartyFolderWorkspace` already does folders well — that pattern should be lifted into the sheet
workspace.)

### U-4. No router **[CODE]**

`App.tsx:52-88` is a 16-branch ternary over `gmView` held in local UI state. There are no URLs, so:
no deep links to an authoring page, browser Back does nothing (or exits), refresh returns the GM to
the dashboard and re-authenticates, and two tabs cannot hold two different pages. For a GM moving
between Items → Actions → Sheet mid-session this is constant friction.

### U-5. Native `window.confirm` for all destructive actions **[CODE]**

`confirmDestructiveAction.ts:18` uses `window.confirm` in 22 call sites, while a themed
`shared/ui/ModalDialog.tsx` exists and is used elsewhere. Native dialogs break the visual system,
cannot show the consequence text with formatting, are suppressible by browsers on repeat, and are
not keyboard-consistent with the rest of the app. Coverage itself is good — your "add a confirm to
deletions" item is essentially done.

### U-6. Fractional reactions display but cannot be spent **[CODE]**

The backend stores reactions at 2-decimal precision with `Decimal` quantisation
(`sheet_runtime/service.py:1210-1230`) and `SheetRuntimeResources.tsx:4` formats fractions. But the
UI only offers Spend/Restore in **whole units of 1** (`canConsume = current >= 1`, `onSpend` sends
−1). A player who has 0.5 reactions left can see it and do nothing with it. Your "can show fractions
of a reaction" item is half-implemented — the display exists, the control doesn't.

### U-7. Structural component and CSS smells **[CODE]**

- `PlayerCharacterSheet.tsx` is 1,005 lines serving both roles through a `mode` prop with 27
  role branches. Player-facing and GM-facing concerns are interleaved throughout — the reason
  template-editing controls kept leaking into the character screen.
- `sheet.css:1138-1190` styles by **DOM id** with chained `:not()` selectors
  (`.character-sheet__tab-panel:not(#sheet-panel-overview):not(#sheet-panel-inventory):not(...)`).
  Adding a tab requires editing four negation chains in three rules or it silently inherits the
  column layout. Use a modifier class on the panel instead.
- 18 `!important` declarations across the stylesheets, several in `app.css` layout rules.

---

## 4. Your to-do list, reconciled with the code

### Open items that are already implemented (verify and close)

| Item | Evidence |
| --- | --- |
| "We should make pinned actions actually player pinned or remove it" | Fully implemented and player-settable: `backend/features/pinned_actions/service.py`, `pinned_action_ids` per instance, redacted to the owning player, validated against currently-available actions. |
| "Add a backstory tab and character" | `backstory` is a live tab in `PlayerSheetTab` (`sheetDisplay.ts:14-25`). |
| "Add a confirm to deletions of things" | 22 call sites via `confirmDestructiveAction`. (See U-5 for the dialog choice.) |
| "Add an item catalog folders" | `catalog_folder` on items; `itemCatalogFolders.ts` + `ItemCatalogBrowser`. |
| "Should allow DM to remove items even if they are equipped" | `detach_instanced_sheet_item` has no equipped guard (only a "empty the container first" guard). If the UI blocks it, that's a frontend-only restriction. |
| "Keep track of money (contribution points)" | Fully implemented with a transaction ledger: `features/contribution_points/`. |
| "Rework storage, holding weight vs dissipating weights" | `can_contain_items` + `contents_weight_behavior: normal\|ignored`, with cycle-safe weight calculation in `inventory/service.py`. |

### Open items that are real, with the underlying cause

**"Proficiency select in item creator lists out non-existent proficiencies" (High)** — **[HYPOTHESIS,
high confidence]**

The frontend is not at fault: both `ItemAttributesEditor.tsx:22-49` and
`ActionAttributesEditor.tsx:26-36` build their options from live `state.proficiencies` and ignore the
attribute definition's stored `validation_options`.

The proficiencies are real state — the backend injects ten it authored itself:

```
long_swords, short_swords, spears, shields, pugilists,
staffs, bows, throwing, knives, axes
```

They come from `seeded_weapon_family_proficiencies()` (`state/models/proficiency.py:44`) via
`_fresh_state()`, and from migration **v12 → v13** (`state/migrations.py:874-893`), which
`setdefault`s all ten into any state passing through that version. On your DM machine the state has
been migrated, so all ten appear. Codex could not reproduce it because a locally-created state never
went through v12 → v13 — and indeed the current repo checkpoint has **zero** proficiencies.

Verify with:

```bash
python -c "import json;print(list(json.load(open('state_dumpy.json'))['state']['proficiencies']))"
```

If you see those ten IDs, that's it. Decide whether seeded weapon families are intended content
(then label them "Weapon Family" in the picker and explain them in the UI — `category` already
distinguishes them) or not (then drop the migration seeding and let the DM author them).

**"Scaling is messed on sub-2k monitors" (High)** — see U-2, with U-1 as a compounding cause.

**"Adding steps to actions removes the save action button" (marked fixed)** — the sticky footer fixes
this specific button. The underlying pattern (U-1) still affects every other long form; treat the
item as mitigated, not resolved.

**"Improve UI/UX of party page on GM view — create folders"** — see U-3; the `PartyFolderWorkspace`
in the XP tracker is the pattern to reuse.

**"Can show fractions of a reaction"** — see U-6; backend done, control missing.

**"Add specific toggles for what players can add items"** — currently a single global rule: a player
may add any item that is `approval_status == "approved"` **and** `player_visible == true`
(`items/service.py:553-566`). There is no per-character or per-category toggle, and no way to let a
player carry an item without also letting them add more of it.

### Items marked "Yes (Untested)" that I read and believe are correct

- **XP by party size** — `_build_kill` (`xp_tracker/service.py:374-409`) snapshots participants at
  kill time and stores `xp_percentage = 100 / participant_count` and
  `xp_per_participant = base_xp / participant_count`. Kill goblin solo = 100 %, in a party of four =
  25 %. Matches the spec. One edge: `_record_kill_in_state` picks the **first** party containing the
  credited character (line 425); nothing prevents a character from being in two parties, and the
  choice would then be arbitrary.
- **Per-user Roll20 extension** — bindings are per DM / per claimed instance, tokens are HMAC-signed
  and scoped, delivery is fail-fast with no cross-user fallback. Correct as described. See A-2 and
  A-9 for the lock and token-lifetime concerns.
- **Player item submission and approval** — `submit_player_item` / `review_player_item` with
  `approval_status` and submitter attribution; pending items are visible to their submitter and the
  DM only (`state_sync/service.py:164-192`). Correct.

---

## 5. Verification status of the codebase

| Check | Result |
| --- | --- |
| `pytest backend/tests` | **538 passed, 8 failed** — all 8 failures are C-2 (`PermissionError` from `_fsync_directory` on Windows). The suite should pass on Linux. |
| `tsc -b` (frontend) | Clean. |
| `vitest run` | **Could not run** — `node_modules` was installed for a different platform; `@rollup/rollup-win32-x64-msvc` is missing. `npm ci` on this machine would fix it. I did not install anything. |
| Backend source TODOs | Two: `state/models/formula.py:146` (proficiency use not queued during formula expansion — worth checking against the "tagged in action should up proficiencies" rule) and `state/models/sheet.py:106` (stale). |
| Lint suppressions | None in source. |

The test suite is genuinely substantial — 40 modules, strong websocket-contract coverage, and the
architecture docs match the implementation more closely than is typical. The problems below the
waterline are concentrated in persistence, the mutation hot path, and the CSS layout model, not in
the domain logic.

---

## 6. Suggested order of work

**Before the next session (data safety):**

1. Isolate `STATE_PATH` in `conftest.py` (C-1). One fixture.
2. Fix `_write_checkpoint` ordering and make the directory fsync best-effort (C-2). Restores Windows
   dev and makes the write crash-safe everywhere.
3. Move `dumpState()` inside the rollback boundary, or persist after broadcasting (C-3).
4. Add a catch-all exception handler with logging to the `/ws` receive loop (C-4).

**Next (the two symptoms your table actually feels):**

5. Restore visible scrollbars; drop the horizontal column flow on sheet tabs (U-1).
6. Raise the layout breakpoint to ~1280 px and audit fixed minimums for a 1280 × 630 viewport (U-2).
7. Decide on the seeded weapon-family proficiencies and label or remove them (item-builder report).

**Then (structural, in dependency order):**

8. Drop the redundant checkpoint re-read in `_write_checkpoint`; make the three per-mutation
   full-state sync passes incremental (A-1).
9. Move Roll20 delivery out of the state lock (A-2).
10. Make the client apply patches to its projected state instead of re-projecting everything (A-3).
11. Re-express `domain/models.ts` over the generated contract (A-6).
12. Add delete guards for actions and complete the proficiency guard (A-7).
13. Add a router (U-4).
14. Unify `Sheet` / `InstancedSheet` (A-4) — the largest item, and the one that unblocks the
    template-vs-instance cleanup you've been chasing.
