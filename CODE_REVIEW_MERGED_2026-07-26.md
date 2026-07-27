# TTRPG-System-v02 — Merged Code Review

**Date:** 2026-07-26
**Sources:** Review A (this agent, Windows host) + Review B (second reviewer, WSL1 host), reconciled
and re-verified against the working tree.
**Provenance tags:** `[A]` found by review A only · `[B]` found by review B only · `[A+B]` both ·
`[B→verified]` claimed by B and independently confirmed here.

Every finding below was re-checked against the code before inclusion. Claims that did not survive
verification are listed in §7.

## Post-review remediation verification

**Verified:** 2026-07-26, after the remediation batch described by the second reviewer.

The original review is retained below as the point-in-time record of what was found. The following
table supersedes its status labels:

| Finding | Current status | Verification |
| --- | --- | --- |
| C-0 player data leak | **Closed** | Player snapshots now contain only the claimed instance; other instances, DM-only templates, and encounter presets are withheld. Patch redaction mirrors those rules, and the DM bypass now precedes player-only runtime filtering. A-5 remains open because the full redaction system is still a large hand-written path matcher rather than a declarative root policy. |
| C-1 tests overwrite the checkpoint | **Closed** | An autouse fixture redirects `STATE_PATH` to `tmp_path`. A fresh 554-test run left the real checkpoint byte-identical, with the same timestamp and size. |
| C-2 checkpoint destruction on failure | **Closed** | The existing primary is copied, not renamed, before atomic replacement; directory fsync is best-effort. The failure-path test confirms the old primary and backup remain readable when replacement fails. |
| C-3 persistence outside rollback | **Closed in implementation** | `apply_mutation`, `apply_audit_mutation`, `undo_last_change`, and `apply_private_mutation` now persist inside their rollback boundaries. Failed undo restores its consumed history entry. Direct failure-injection coverage for all four paths was not found, so this remains a regression-test gap rather than an observed defect. |
| C-4 formula exception drops socket | **Partially remediated** | The WebSocket dispatcher now logs unexpected exceptions and sends a correlated generic error instead of silently dropping the socket. Invalid imported resource formulas can still prevent snapshots and unrelated mutations until the formula is repaired; C-5's unbounded exponentiation is also unchanged. |
| F-1 irremovable condition `set` | **Closed** | Backend create/update validation rejects direct condition-owned `set`; the editor removes that choice. Legacy direct `set` effects deactivate while retaining the current value, and evaluation-time `set` remains valid. The legacy removal branch lacks a focused regression test. |
| F-2 no-op request never completes | **Closed** | Backend route metadata limits `request_completed` to state-patch-only routes, the hand-written frontend parser accepts it, the adapter emits an acknowledgement, and pending intents resolve. The work also confirms A-6: `variable_registry` remains unreachable through the hand-written parser. |

### Updated ratings

| Area | Before | After remediation | Reason |
| --- | ---: | ---: | --- |
| Security and privacy | 3/10 | **7/10** | The live cross-player/GM data disclosure is fixed; token lifetime, rate limiting, and broader declarative redaction remain. |
| Persistence and recovery | 3/10 | **8/10** | Test isolation, write ordering, Windows behavior, and mutation rollback are corrected; durability is still one local primary plus one backup. |
| Automated validation | 8/10 | **9/10** | 554 backend tests pass locally and the second reviewer reports 460 frontend tests passing. Failure-injection gaps remain for C-3, the C-4 catch-all, and F-1 legacy removal. |
| Architecture | 5/10 | **5/10** | Documentation improved, but A-1 through A-6 and the global-lock/whole-state costs remain structurally unchanged. |
| UI/UX | 5/10 | **5/10** | None of U-1 through U-8 was addressed in this batch. |
| Table readiness | 4/10 | **7/10** | The immediate privacy and checkpoint hazards are removed. Formula hardening, responsive layout, and a real hosted Roll20/table smoke test still gate high confidence. |

**Remediation batch rating: 9/10.** The reviewer prioritized the correct risks, chose the correct
layer for test isolation, carried the no-op protocol change through backend and frontend, and kept
architecture documentation synchronized. The deduction is for treating C-4 primarily as transport
containment rather than formula-state hardening, plus the three focused regression-test gaps noted
above.

### Revalidation

- `backend/.venv/bin/python -m pytest -q`: **554 passed in 12.66s**.
- `state_dumpy.json` before and after: SHA-256
  `0f56a595bf0d21513504238afc4cdd8c4d59c3ac7df20a4736d43e32ec9be574`, timestamp
  `2026-07-26 19:19:22.985988800 -0500`, size `15,679` bytes.
- Frontend suite: not runnable from this WSL1 environment because its Windows npm launcher rejects
  WSL1; the second reviewer's reported result is **460 tests across 101 files, all passing**.
- No application source was changed during this verification.

---

## 0. Disclosures

**Two agents ran `pytest backend/tests` against this repo today, and both mutated
`state_dumpy.json` as a side effect.**

- Review B ran the suite on Linux at roughly 19:19. It succeeded, and in succeeding it **overwrote
  the checkpoint with test residue** (the file now describes 1 sheet, 1 instance, 1 action, 0 items,
  0 proficiencies). B reported "No repository files were changed" — that is true of tracked files,
  but `state_dumpy.json` is gitignored, so the damage was invisible to `git status`.
- Review A ran the same suite on Windows at roughly 19:43. It **deleted the checkpoint** (finding
  C-2). A restored it byte-identically from `state_dumpy.json.bak`.

Neither run lost campaign data, because the checkpoint had already been reduced to test residue.
This is finding **C-1**, demonstrated twice in one evening.

**Review A overwrote review B's report file.** `CODE_REVIEW_2026-07-26.md` existed in the working
tree when session A began; A wrote its own report to that same path. B's full text survives in the
conversation transcript the user supplied, and is merged here. This merged report is written to a
new path to avoid a third collision.

---

## 1. Critical

### C-0. Player sessions receive every other character's full sheet, all DM-only templates, and all encounter presets `[B→verified]`

**This is the most serious defect either review found.**

`_redact_state_for_role` (`backend/features/state_sync/service.py:306-318`) keeps every entry in
`instanced_sheets` and, for instances the player does not own, removes only five things:

```python
instance["items"] = {}
instance.pop("reactions", None)
instance.pop("evaluated_max_reactions", None)
instance.pop("contribution_points", None)
instance.pop("pinned_action_ids", None)
```

Everything else survives: `health`, `mana`, `stats`, `evaluated_stats`, `resistances`, `notes`,
`profile` (including backstory), `actions`, `proficiencies`, `attributes`, `augments`,
`unassigned_stat_points`, `max_health` / `max_mana` formulas.

Two further gaps in the same function, confirmed here:

- **`dm_only` never appears anywhere in `state_sync/service.py`.** Enemy templates are shipped to
  players with only `notes`, `xp_cap` and `xp_given_when_slayed` stripped. Players receive every
  monster's stats, resistances, actions and attributes.
- **`encounter_presets` is in neither `PRIVATE_STATE_ROOTS` nor `DM_ONLY_STATE_ROOTS`.** Players
  receive the GM's entire encounter plan.

The patch path has the same shape (`service.py:367-384`): for non-owned instances only the four
runtime fields and `items` are dropped; every other mutation to another player's instance is
forwarded verbatim, live.

This contradicts the project's own documented contract in
`architecture/platform/state-sync-redaction-and-undo.md:57` and
`architecture/platform/authentication-sessions-and-sheet-access.md:62`.

**It is also encoded as intended behaviour in a passing test.**
`test_player_snapshot_redacts_template_notes_but_keeps_instance_notes`
(`backend/tests/test_state_sync.py:296`) asserts that an *unassigned* player snapshot retains
`"Shared instance notes."` for an instance the session does not own. Fixing the leak requires
changing that test, which is why the suite's 546 passes gave no warning.

Hiding this in React is not a fix — it is visible in the browser devtools network tab to anyone with
the shared player code.

**Fix direction:** replace the field-subtraction approach with allow-listing. A player snapshot
should contain their own instance in full, plus the minimum projection of others needed by the UI
(id, name, kind, maybe current/max HP for a party bar), and no `dm_only` sheets or encounter presets
at all.

### C-1. The backend test suite writes to the live state checkpoint `[A]`

`backend/tests/conftest.py` resets `state_sync_service` between tests but never isolates
`backend.state.store.STATE_PATH`. Only three of ~40 test modules patch it
(`test_action_history.py:244`, `test_dm_examples_acceptance.py:72`, `test_state_store.py:28`).
Every other test that calls `apply_mutation` reaches `StateSingleton.dumpState()` and writes to the
real repo-root `state_dumpy.json`.

On Linux this silently replaces the developer's campaign with test state. Both review runs today
demonstrate it. See §0.

**Fix:** an autouse fixture that monkeypatches `STATE_PATH` to `tmp_path`, plus a guard in
`_write_checkpoint` refusing repo-root writes when `APP_ENV == "test"`.

### C-2. `_write_checkpoint` destroys the checkpoint when it fails, and always fails on Windows `[A]`

`backend/state/store.py:83-101`:

```python
if path.exists() and _load_checkpoint(path) is not None:
    os.replace(path, backup_path)     # primary -> .bak
    _fsync_directory(path.parent)     # raises PermissionError on Windows
os.replace(temporary_path, path)      # never runs
finally:
    temporary_path.unlink(missing_ok=True)   # last remaining copy deleted
```

Two defects:

1. **Not cross-platform.** `_fsync_directory` opens a directory handle and `fsync`s it; Windows
   refuses (`PermissionError [Errno 13]`, reproduced directly). Local development on Windows cannot
   persist state at all. Same class of bug: `frontend/package.json`'s `generate:protocol` invokes
   `../backend/.venv/bin/python`, which on Windows is `Scripts/python.exe`.
2. **Not crash-safe.** Rotate-then-write means any failure between the rename and the replace loses
   the primary — full disk, read-only mount, `SIGKILL`. Correct order is write-temp → fsync-temp →
   copy primary to `.bak` → `os.replace(temp, primary)`, with the directory fsync best-effort.

This is the reason A's run saw 8 failures where B's saw none: `538 passed + 8 failed` (Windows)
versus `546 passed` (Linux) is the same suite, and all 8 failures are this bug.

### C-3. A failed checkpoint write leaves memory mutated, unpatched, and unrecorded `[A+B]`

Both reviews found this independently, and B's articulation of the consequences is the better one.

`state_sync/service.py:1331-1389`: the rollback `try/except` wraps `mutation(state)` and
`before_commit` only. `StateSingleton.dumpState()` sits outside it. If persistence fails:

- the in-memory state stays mutated;
- no `state_version` is consumed and no `state_patch` is emitted;
- the request is **not** recorded as processed, so a client retry re-applies it — compounding an
  increment or a damage step;
- the next unrelated successful write silently persists the earlier failed mutation;
- the version-gap resync in `GameClient.ts:263-280` cannot fire, because no version was consumed.

`apply_audit_mutation` and `undo_last_change` share the same boundary error.

### C-4. Formula errors are unisolated and can break connect and mutate for everyone `[A]`

`evaluate_resource_maximum` (`formula_runtime/service.py:274`) propagates exceptions;
`evaluate_sheet_stats` (line 248) deliberately swallows them. Reproduced:

```
'10 / 0' -> ZeroDivisionError
'1 +'    -> SyntaxError
```

- `synchronize_resource_bounds_mutation` evaluates maxima for **every instance on every mutation**
  (`sheet_runtime/service.py:1176`) — one bad formula blocks all state changes for everyone.
- `_build_snapshot_locked` evaluates them for **every sheet and instance**
  (`state_sync/service.py:707-736`) — one bad formula and nobody can connect.
- `routes/ws.py:130` catches only `PermissionError`, `PersistedStateError`, `ValueError`.
  `ZeroDivisionError` and `SyntaxError` escape the receive loop: socket dropped, no message, no log.

Authoring validates alias *paths* only (`build_formula`), never that the text parses or evaluates.
`apply_mutation`'s rollback happens to reject bad formulas saved through the normal path, so the
live entry point is `import_state_backup` (`state_backup/service.py:37-56`), which validates schema
only — and `replace_state_and_broadcast_snapshots` **writes the imported state to disk before it
knows it can serve it**.

### C-5. `**` is unbounded — one formula can freeze the server `[A]`

`_ALLOWED_BINARY_OPERATORS` includes `ast.Pow` with no operand ceiling
(`formula_runtime/service.py:32-39`). `2 ** 2 ** 40` burns CPU indefinitely on the single-threaded
event loop while holding the global state lock. Dice count and sides are capped; the exponent is not.

---

## 2. High — functional defects

### F-1. Conditions can be authored with an effect the runtime cannot remove `[B→verified]`

`ConditionAugmentationTemplatePanel.tsx:31-36` offers `set` in `AUGMENTATION_OPERATIONS` for direct
sheet-value effects. On removal, `augmentations/service.py:834-835` raises:

```
Set augmentations cannot be removed without stored base state.
```

`_remove_condition_effect_mutation` (line 945) calls straight into that path. The architecture doc
(`conditions-effects-and-augmentations.md:90`) acknowledges the limitation and says authoring "must
avoid" it — but neither the editor nor backend validation enforces it. A GM can create, apply, and
then be permanently unable to remove a condition through normal controls.

**Fix:** either remove `set` from the condition editor's operation list and reject it in
`create/update_condition_preset`, or store the pre-application base value so removal can restore it.

### F-2. No-op mutations never send a terminal response, so requests pend forever `[B→verified]`

`state_sync/service.py:1387-1388`: when a mutation yields zero ops, the request id is remembered but
**nothing is sent** — no patch, no ack, no error. Routes like
`contribution_points/route.py` declare `emitted_event_models = (StatePatchEvent,)` and rely entirely
on the patch as the response.

`useGameClient.ts:105-151` clears a pending intent only on a correlated snapshot, patch, ack, or
error. So the intent stays in the global pending count for the rest of the session.

Trivially reachable: `SheetRuntimeResources.tsx:73` enables Add/Set with `amount = "0"`
(`validAmount` accepts 0), and `contribution_points/service.py:58-59` returns `None, []` when the
value is unchanged.

**Fix:** have `apply_mutation` emit an empty-ops `state_patch` (or a generic `request_completed`
ack) when a request id is present and no ops were produced.

### F-3. Referential integrity is applied inconsistently across entity types `[A]`

| Entity | Delete guard |
| --- | --- |
| Item | Full — refuses while attached to any sheet **or instance** (`items/service.py:454-486`) |
| Proficiency | Partial — checks attribute references on `sheets`, `items`, `actions`; **ignores `instanced_sheets` and all proficiency *bridges*** (`proficiencies/service.py:57-86`) |
| Action | **None** — deleted unconditionally (`actions/service.py:590-604`) |

Deleting a trained proficiency orphans the bridge; the sheet then renders the raw id with a
percentage (`sheetProficiencies.ts:26`). Deleting an action leaves dangling `Bridge.entry_id`s on
sheets and instances and dangling `action_grants` on items; the player sees the action until they
click it.

### F-4. Two protocol paths are only partially wired `[B→verified]`

- `variable_registry` server events are mapped to **zero client events**
  (`eventAdapters.ts:456-460`), despite an exposed request builder. Any pending intent for that
  request never resolves — same class as F-2.
- `handleConnectionLost` clears `lastSeenStateVersion` (`GameClient.ts:292`), so every reconnect
  requires a full snapshot and the backend's patch-replay support (`replay_since`) is never
  exercised in practice. *(Nuance: the re-auth bootstrap sends a fresh snapshot anyway, so this is
  wasted capability rather than a live bug — but it means replay is effectively untested in the
  field.)*

---

## 3. Architecture

### A-1. Every mutation costs O(entire state), four times over `[A]`

Under one global `asyncio.Lock`, each state change performs:

1. `deepcopy(state)` for the undo baseline (`state_sync/service.py:1339`);
2. three full-state reconciliation passes — `synchronize_equipment_augmentations_mutation`,
   `synchronize_resource_bounds_mutation` (re-evaluates health/mana formulas for *every* instance),
   `synchronize_pinned_actions_mutation` (walks every instance's inventory and every item's grants);
3. `json.dump` of the entire state plus `fsync`;
4. **a full re-read, re-migrate and `State.from_dict()` of the previous checkpoint** —
   `store.py:94` calls `_load_checkpoint(path)` solely to decide whether to rotate the backup;
5. two directory `fsync`s;
6. a per-session `deepcopy` of the patch for redaction.

Step 4 doubles the cost for no benefit. Fixing it is a one-line change.

### A-2. One global lock spans Roll20 delivery, disk I/O, and client broadcast `[A+B]`

Both reviews found this; B enumerated the three costs most clearly.

`perform_action` passes `deliver_messages` as `before_commit`
(`sheet_runtime/service.py:2032-2056`), so it runs inside `apply_mutation`, inside
`state_sync_service._lock`, awaiting per-message browser acknowledgement with
`DELIVERY_TIMEOUT_SECONDS = 12.0` (`chat/service.py:27`). The same lock is held through the
synchronous checkpoint write and through `broadcast_per_session`
(`session/service.py:162`), which awaits `send_json` to each client sequentially.

*(Precision note on B's citation: the lock at `session/service.py:162` is the session-registry lock,
released before sending. The problem is that the whole broadcast is awaited inside the **state**
lock held by `apply_mutation`.)*

One hung Roll20 tab, one slow client, or one filesystem stall pauses every mutation at the table.

Also unhandled: if message 1 of 3 delivers and message 2 fails, state rolls back but Roll20 already
shows message 1.

### A-3. "Patch-first sync" is undone on the client `[A]`

`eventAdapters.ts:279-306`: every `state_patch` `structuredClone`s the entire backend state, applies
the ops, then `projectSnapshot` rebuilds arrays from every collection — dispatched as
`apply_snapshot`, after which `syncReducer.ts:26-101` rebuilds every `Record` and `*Order` array.

Every HP tick allocates a new object for every sheet, item, action and attribute in the game,
breaking referential equality across all memo boundaries and re-rendering the whole tree. The
backend's patch machinery buys nothing on the client.

Related: `applySinglePatchToDraft` throws on an untraversable path;
`SocketProtocolClient.handleMessage` catches it, emits a generic `"Invalid server payload"`, and
leaves `protocolState` unadvanced — recovery waits for the next patch's version-gap detection.

### A-4. `Sheet` and `InstancedSheet` are duplicate models, contradicting the project's own rule `[A]`

`reference-docs/policies/architecture-guidelines.md`: *"Use one sheet model with metadata to
distinguish: `kind`: player/enemy, `mode`: template/instance."*

`backend/state/models/sheet.py` implements two dataclasses duplicating 11 fields.
`InstancedSheet.stats` is `Stats | None`, forcing
`runtime_stat_owner = instance if instance.stats is not None else template` fallbacks
(`state_sync/service.py:719`). `InstancedSheet` has no `id` and no `name`.

The cost shows everywhere: paired `_sheet` / `_instanced_sheet` functions throughout the services,
parallel redaction branches (the soil C-0 grew in), and `sheets` + `persistentSheets` as separate
frontend collections. This is the structural reason "character screen still contains template
editing things" was hard to close.

### A-5. Redaction is a 340-line hand-rolled path-matching chain `[A]`

`_redact_patch_for_role` (`state_sync/service.py:356-693`) is a long sequence of
`if len(segments) >= N and segments[0] == "..."` blocks with subtract-what's-secret semantics.
C-0 is the predictable outcome of that design; a second instance is the `augmentations` branch
(lines 605-649), where an augmentation whose `source.type` is not `"condition"` — i.e.
equipment-sourced — falls through without `continue` and is appended unconditionally at line 690.

**Fix:** declare visibility per state root as data and drive both snapshot and patch redaction from
it, defaulting to deny for unrecognised roots. This is the same fix as C-0 and should be one piece
of work.

### A-6. The hand-written type layer duplicates the generated contract `[A]`

`frontend/src/domain/models.ts` (646 lines, 75 types) restates shapes already generated into
`frontend/src/generated/backendProtocol.ts` (3,094 lines, 236 types). **126 files import
`@/domain/models`; 6 import the generated contract.**

Divergence exists already: hand-written `ItemDefinition` carries `approval_status` and
`submitted_by_*`; generated `ItemDefinitionPayload` does not, while `ItemPayload` does — three
near-identical item types with different fields. The root README forbids exactly this.
`requestBuilders.ts` shows the right pattern (`Extract<ProtocolApplicationRequest, {type: T}>`).

### A-7. Subsystem monoliths `[A+B]`

`sheet_runtime/service.py` 2,113 · `state/migrations.py` 2,155 · `requestBuilders.ts` 1,917 ·
`PlayerCharacterSheet.tsx` 1,005 (serving both roles through a `mode` prop with 27 role branches) ·
`ActionEditorForm.tsx` 938 · `sheet.css` 2,216. Against
`reference-docs/policies/frontend-guidelines.md:20` ("modularize aggressively").

`requestBuilders.ts` is the least concerning — it is 115 mechanical, fully type-derived builders and
a natural codegen target. `PlayerCharacterSheet.tsx` is the most concerning, for the reason in A-4.

### A-8. Unbounded state collections `[A]`

`action_history` is pruned on every dump. These are not: `kill_registry`, `xp_adjustments`,
`contribution_point_transactions`, `sheet_access_codes` (deactivated codes are never removed). All
are serialised in full on every mutation, so growth compounds directly into latency and file size.

### A-9. Credential and operational gaps `[A+B]`

- **Bridge tokens have no expiry or revocation** `[A+B]`. `chat/service.py:102-118` signs only
  `{binding_key, version}`. Rotating a character's access code or logging out does not invalidate a
  synchronised bridge; only changing `SERVICE_AUTH_CODE` or deleting the character does. The legacy
  path still accepts the raw `SERVICE_AUTH_CODE` as a DM binding.
- **Single-worker constraint is undocumented and unenforced** `[A]`. In-memory authoritative state
  requires exactly one uvicorn process; nothing in `deploy/ttrpg.service` says so. `--workers 2`
  would silently fork divergent game states.
- **Thin durability** `[A]`. One JSON file plus one `.bak` generation, no scheduled off-box backup —
  and see C-1/C-2.
- **Auth hygiene** `[A]`. `auth/tokens.py:11` compares codes with `==` rather than
  `hmac.compare_digest`; `claim_sheet_access_code` has no rate limiting; codes never expire or
  deactivate on use; nothing prevents two sessions claiming the same instance.
- **No message size limit, rate limit, or generic exception logging on `/ws`** `[A]`.

---

## 4. UI / UX

### U-1. Hidden scrollbars + drag-to-pan + sideways column flow `[A+B]`

Both reviews flagged the sideways flow; A found the two compounding decisions that make it hostile
rather than merely unusual.

1. `styles/shared.css:585-609` **hides the scrollbars** on the primary scrolling surfaces
   (`.character-sheet__tab-panel`, `.authoring-workspace__editor`,
   `.authoring-workspace__catalog-scroll`, the actions list, the notification stack) and sets
   `cursor: grab`.
2. `styles/sheet.css:1138-1149` makes non-overview character-sheet tabs a CSS multi-column container
   (`column-width: 420px; column-fill: auto`) that flows **sideways** when it runs out of vertical
   room, with an inline comment instructing "swipe / shift+wheel sideways".
3. `shared/ui/dragScroll.ts` installs document-level pointer handlers so those surfaces pan by drag.

Together: content silently continues into a column to the right, no scrollbar indicates it, and the
wheel scrolls vertically (which does nothing). This is exactly the reported
*"save action button disappears below action preset details — no scroll bar or other way to see it"*.
The sticky `.action-editor__footer` patches that one button; the pattern still governs every other
tab and authoring page. B adds the accessibility angle: keyboard focus can appear to jump off-screen.

Two further costs of the drag-scroll layer `[A]`:

- a click that moves more than 6 px is **swallowed** (`dragScroll.ts:105-112`) — on a trackpad this
  reads as "the button didn't work";
- text in read-only panels **cannot be selected** (drag pans; `user-select: none` while dragging), so
  players cannot copy an item description or their own notes.

### U-2. The layout has no breakpoint where most people sit `[A]`

The shell is a fixed, non-scrolling `100dvh` frame (`app.css:6-13`) with `overflow: hidden` on
`.app-layout` (171) and `.app-main-panel` (197). The breakpoint that returns it to a normally
scrolling page is at **`max-width: 960px`** (`app.css:1138`).

| Display | Windows scale | CSS viewport |
| --- | --- | --- |
| 1920×1080 | 100 % | 1920 × ~945 |
| 1920×1080 | 125 % | 1536 × ~756 |
| 1920×1080 | 150 % | 1280 × ~630 |
| 1600×900 | 100 % | 1600 × ~810 |

Everything from 961 px to ~1400 px keeps the rigid frame while fixed minimums stack: 224 px nav
(`app.css:169`) plus grids with hard floors — `minmax(500px, 1.2fr) minmax(320px, 0.8fr)` (388),
`minmax(0,1fr) minmax(320px,420px)` (237), `minmax(0, 1.55fr) minmax(340px, 0.85fr)` for inventory
(`sheet.css:1195`). Ancestors are `overflow: hidden`, so the excess is **clipped, not scrollable**.
Vertically at 630–760 px, the header, notification slot, sheet header, advancement row, resource
cards and tab strip consume the frame before the tab panel gets any space — which triggers U-1.

**Fix:** raise the release breakpoint to ~1280 px, add a `max-height: 800px` density tier, audit
every `minmax(Npx, …)` floor against 1280 × 630, and let the shell scroll rather than clip.

### U-3. Item details are hidden in a hover/focus-only tooltip `[B→verified]`

`SheetEquipmentSection.tsx:26-60` puts description, attribute summaries, effect counts, active
effects and granted actions inside `.equipment-card__hover-label`. `sheet.css:105-125` renders it
`opacity: 0; visibility: hidden; pointer-events: none`, revealed only on hover/`focus-within`.
There is no visible "Details" affordance and no `aria-describedby` association. Weak on touch,
undiscoverable with a mouse, awkward for keyboard and screen-reader users.

### U-4. Effect durations look operational but are decorative `[B→verified]`

`SheetStandaloneEffectsSection.tsx:58` renders `Duration: …` for each active effect. The backend
ticks nothing — no rounds, turns, rests, scenes, expiry or refresh — as the architecture doc states
outright (`conditions-effects-and-augmentations.md:121-124`), and the section offers no removal or
lifecycle control. A GM reading "3 rounds remaining" will reasonably assume it is maintained.

### U-5. The GM's spawned-character picker is a flat `<select>` `[A]`

`ActiveSheetSelector.tsx` renders every instance in one dropdown with a Despawn button, defaulting to
`sheetOptions[0]`. Spawn eight goblins and the PCs are buried among them — no grouping by
player/enemy, no search, no folders, no indication of which instances are claimed. The XP tracker's
`PartyFolderWorkspace` already does folders well; lift that pattern.

### U-6. No router `[A]`

`App.tsx:52-88` is a 16-branch ternary over `gmView` in local UI state. No deep links, Back does
nothing, refresh returns the GM to the dashboard and re-authenticates, two tabs cannot hold two
pages.

### U-7. Native `window.confirm` for all destructive actions `[A]`

`confirmDestructiveAction.ts:18` uses `window.confirm` across 22 files while a themed
`shared/ui/ModalDialog.tsx` exists. Breaks the visual system, browser-suppressible on repeat,
keyboard-inconsistent. Coverage itself is good — the "add a confirm to deletions" item is done.

### U-8. Structural CSS smells `[A]`

`sheet.css:1138-1190` styles by **DOM id** with chained `:not()` selectors
(`.character-sheet__tab-panel:not(#sheet-panel-overview):not(#sheet-panel-inventory):not(...)`).
Adding a tab means editing four negation chains in three rules or it silently inherits the column
layout. 18 `!important` declarations across the stylesheets.

---

## 5. To-do list reconciliation

### Confirmed implemented — close these

Both reviews agree, and I re-verified the code path for each: player read-only resistances · XP
progress bar · equip/unequip and player inventory changes · unassigned stat allocation · sticky
action save · single-submit item editing · authoritative proficiency choices and formula variables ·
carry weight, containers, ignored/retained contents weight · despawning · party-size XP distribution
and party-folder UI · contribution points · per-user Roll20 bindings · player-visible catalog items
and approval workflow · **pinned actions (fully player-settable and persisted)** · GM-only roll
output · proficiency visibility and growth · item catalog folders · destructive confirmations ·
**backstory tab** · physical damage type dropdown.

### "Proficiency select in item creator lists non-existent proficiencies" — root cause found `[A]`

The frontend is not at fault: `ItemAttributesEditor.tsx:22-49` and `ActionAttributesEditor.tsx:26-36`
both build options from live `state.proficiencies` and ignore stored `validation_options`.

The proficiencies are real state the backend authored itself — ten weapon families
(`long_swords, short_swords, spears, shields, pugilists, staffs, bows, throwing, knives, axes`) from
`seeded_weapon_family_proficiencies()` (`state/models/proficiency.py:44`) via `_fresh_state()`, and
from **migration v12 → v13** (`state/migrations.py:874-893`), which `setdefault`s all ten into any
state passing through that version.

This explains why Codex could not reproduce it locally: a state created fresh never runs v12 → v13.
The current repo checkpoint has **zero** proficiencies. Verify on the DM machine with:

```bash
python -c "import json;print(list(json.load(open('state_dumpy.json'))['state']['proficiencies']))"
```

Then decide: keep them as intended content (label them "Weapon Family" in the picker — `category`
already distinguishes them) or drop the migration seeding.

### Still open, with cause identified

| Item | Status |
| --- | --- |
| Effects/conditions review | Partial. The irremovable `set` effect (F-1) and the decorative durations with no lifecycle controls (U-4) are the gaps. |
| Sub-2K scaling | Open. Root cause is U-1 + U-2, not a spot fix. |
| Improve GM party page | Open. See U-5. |
| Toggles for what players can add | Open. One global rule today: `approval_status == "approved"` **and** `player_visible == true` (`items/service.py:553-566`). No per-character or per-category control, and no way to let a player carry an item without also letting them add more. |
| Pronoun removal | **UI-only.** Removed from the form, still present in `state/models/character_profile.py:9`, `protocol/state_schema.py:128`, `migrations.py:1882`, `domain/models.ts`, `generated/backendProtocol.ts`, and `characterProfile.ts:7`. Complete the data-contract removal if that was the intent. `[B→verified]` |
| Production confidence | Hosted Roll20 test and full local table smoke test remain unchecked in `plan/active/PLAN.md:191` and `:338`. `[B]` |

### One requirement needs your ruling

**Fractional reactions.** The two reviews read the to-do line *"Can show fractions of a reaction"*
in opposite directions — A read it as "should support fractions", B read it as "should prevent
fractions". The code is the same either way and is **half-built for both readings**: storage
quantises to two decimals (`state/models/sheet.py:118-142`), the UI formats fractions
(`SheetRuntimeResources.tsx:4`), but Spend/Restore move only in whole units, so `0.5 / 2.5` can be
displayed and never resolved. Whichever direction you want, one side needs finishing.

---

## 6. Validation status

| Check | Review A (Windows) | Review B (WSL1) |
| --- | --- | --- |
| `pytest backend/tests` | 538 passed, **8 failed** (all C-2) | **546 passed** |
| `tsc -b` | Clean | Could not run |
| `vitest run` | Could not run — `node_modules` built for another platform, `@rollup/rollup-win32-x64-msvc` missing | Could not run — Node fails under WSL1 |
| Live browser / Roll20 / production | Not exercised | Not exercised |

Neither review exercised the running app. **The frontend test suite has not been run by either
reviewer** — that is the largest remaining blind spot, and it should be run before acting on any
frontend finding here.

Source TODOs: `state/models/formula.py:146` (proficiency use not queued during formula expansion —
worth checking against the "tagged in action should up proficiencies" rule) and
`state/models/sheet.py:106` (stale).

---

## 7. Claims that did not survive verification

- **Review B: "the current working tree already contains broad pre-existing modifications across 514
  tracked paths."** Not true. `git diff --stat` is empty; the tree is clean apart from untracked
  review files. The repo has 570 tracked files, so 514 looks like a miscount of the file inventory
  rather than a diff. This matters because it framed B's entire review as being against a dirty
  tree — it wasn't.
- **Review B: "No repository files were changed."** True of tracked files; false in substance. B's
  own test run rewrote the gitignored `state_dumpy.json`. See §0 and C-1.
- **Review A: implied that a bad formula could be saved through normal authoring and brick the app.**
  Partly wrong — `apply_mutation`'s rollback rejects it at save time. The live exposure is the
  import path and the unhandled exception class, as corrected in C-4.

---

## 8. Recommended order

**Before the next session — safety and privacy:**

1. **C-0** player redaction (and update the test that encodes the leak). Highest severity.
2. **C-1** isolate `STATE_PATH` in `conftest.py`. One fixture.
3. **C-2** fix `_write_checkpoint` ordering; make the directory fsync best-effort.
4. **C-3** move `dumpState()` inside the rollback boundary.
5. **C-4** add a catch-all handler with logging to the `/ws` receive loop.

**Next — defects the table will hit:**

6. **F-1** reject `set` in condition authoring (or store base state).
7. **F-2** terminal response for no-op requests.
8. **U-1 / U-2** restore visible scrollbars, drop the sideways column flow, raise the breakpoint.
9. Rule on the seeded weapon-family proficiencies.

**Then — structural, in dependency order:**

10. **A-1** drop the redundant checkpoint re-read; make the three sync passes incremental.
11. **A-2** move Roll20 delivery out of the state lock.
12. **A-5** replace redaction with a declarative allow-list (finishes C-0 properly).
13. **A-3** apply patches to projected client state instead of re-projecting everything.
14. **A-6** re-express `domain/models.ts` over the generated contract.
15. **F-3** delete guards for actions; complete the proficiency guard.
16. **U-6** add a router.
17. **A-4** unify `Sheet` / `InstancedSheet` — largest item, and it unblocks the template-vs-instance
    cleanup you have been chasing.
