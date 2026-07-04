# Frontend UI/UX Overhaul Plan

This is the Step 4 planning artifact for the frontend usability overhaul. It is based on the repo README, active plan, policy docs, `plan/frontend_guidance.md`, and the current frontend architecture investigation.

Mockups for review:

- `plan/ui-ux-overhaul/mockups/index.html`
- `plan/ui-ux-overhaul/mockups/styles.css`

Open `mockups/index.html` directly in a browser. These are static HTML/CSS review screens only. They do not call the backend and do not replace React implementation.

## Design Direction

- Readability wins over decoration.
- Visual style should lean into a polished dark manhwa/game HUD.
- Keep dense table-use information scannable, not decorative.
- Do not add a landing page. Auth is a functional code-entry screen.
- Roll20 remains the table log. The app surfaces action status and failures, not a second authoritative chat log.

## Proposed Information Architecture

### Entry

| Current surface | Proposed surface | Notes |
| --- | --- | --- |
| `SessionLanding` | `Code Entry` | Functional access screen with connection status and concise error handling. |
| `PlayerEntry` | `Claim Sheet` | Player-only sheet access screen after player auth. |

### Player

| Current surface/tab | Proposed surface/tab | Notes |
| --- | --- | --- |
| `ConsolePage` player shell | `Player Shell` | Persistent top status, main sheet, compact action/status rail. |
| `Stats` | `Overview` | Identity, HP/mana, core stats, active conditions/effects, pinned actions. |
| `Actions` plus `RollPanel` | `Actions` | One compact action execution surface. Search remains visible, roll mode is selected once per action context, and action cards/buttons execute directly. |
| `Equipment` | `Inventory` | Equipped/carried/consumables and item-granted actions. |
| `Proficiencies`, `Facts`, parts of `Stats`, `Kills` | `Details` | Passive/reference info. Kills move here unless the GM needs a dedicated workflow. |
| `Notes` | `Notes` | Player-editable notes remain a focused tab. |
| `RollLog` | `Recent Action Status` | Compact, bounded, status-oriented. Avoid competing with Roll20. |

### GM

| Current GM view | Proposed workspace | Notes |
| --- | --- | --- |
| `console` | `Session` | Active characters, access codes, Roll20/backend status, quick sheet view. |
| `sheet_viewer` | `Characters` | Instance list, selected sheet detail, permitted GM edits. |
| `template_library` | `Templates > Library` | Search, filter, spawn, edit, delete. |
| `create_template` | `Templates > Builder` | Builder remains tabbed: Details, Stats, Facts, Resistances, Actions, Proficiencies, Inventory. |
| `action_authoring` | `Content > Actions` | Editor/list split with presets and validation. |
| `item_maker` | `Content > Items` | Editor/list split with item grants and effects. |
| `fact_authoring` | `Rules Data > Facts` | Catalog management. |
| `formula_authoring` | `Rules Data > Formulas` | Catalog management with variable picker. |
| `proficiency_authoring` | `Rules Data > Proficiencies` | Catalog management. |
| `condition_authoring` | `Status Effects > Conditions` | Condition presets and augmentations. |
| `effect_authoring` | `Status Effects > Standalone Effects` | Runtime effect templates. |
| `encounter_presets` | `Encounters > Presets` | Encounter builder/list/spawn. |
| `xp_tracker` | `Encounters > XP` | Level readiness and XP config. |
| `state_backup` | `Admin` | Undo, export, import, destructive-operation warnings. |

## Component And File Plan

### Shell and navigation

- Update `frontend/src/app/App.tsx`
  - Replace the large inline `gmContent` conditional with a small workspace resolver.
  - Render a persistent shell with role, selected sheet, connection, sync, Roll20 bridge, and pending status.
  - Keep auth and sheet-claim gates intact.

- Update or replace `frontend/src/features/console/GMConsoleToolbar.tsx`
  - Group GM navigation into `Session`, `Templates`, `Characters`, `Content`, `Rules Data`, `Status Effects`, `Encounters`, and `Admin`.
  - Show sub-tabs inside the main workspace rather than flattening every tool in the sidebar.

- Update `frontend/src/features/console/gmConsoleToolbarData.ts`
  - Replace flat `GM_TOOLBAR_NAV_ITEMS` with grouped workspace metadata.
  - Preserve current `GMView` values initially to reduce reducer churn, or introduce a new local workspace model after Step 5 review.

- Add shared shell/status components under `frontend/src/shared/ui/` or `frontend/src/features/console/components/`
  - `AppStatusBar`
  - `WorkspaceTabs`
  - `StatusPill`
  - `CommandButton` or extend existing button styling only if the app already has enough.

### Player sheet

- Refactor `frontend/src/features/console/ConsolePage.tsx`
  - Move player status out of the left sidebar into the persistent top/status bar.
  - Replace the two-column `RollPanel` plus `RollLog` layout with a main sheet and compact action/status rail.
  - Keep the GM sheet view path separate from the player path.

- Refactor `frontend/src/features/sheets/PlayerCharacterSheet.tsx`
  - Keep backend request builders and role gates.
  - Add a display composition matching the new tabs:
    - `overview`
    - `actions`
    - `inventory`
    - `details`
    - `notes`
  - Reuse existing section components where possible.

- Update `frontend/src/features/sheets/sheetDisplay.ts`
  - Change `PlayerSheetTab` from implementation categories to user-facing task tabs.
  - Add helpers for grouping actions and summarizing important sheet status if needed.

- Update `frontend/src/features/sheets/components/CharacterSheetTabs.tsx`
  - Render the new tab set with accessible keyboard behavior preserved.

- Refactor `RollPanel` and `RollLog`
  - Quick actions become pinned action groups or a compact "Pinned" area in the Actions tab.
  - The Actions tab should use a dense command-grid layout instead of a large detail/sidebar layout.
  - Keep search and category filters visible at the top of the Actions tab.
  - Show roll mode once for the current action category/context instead of repeating advantage/disadvantage controls on every action card.
  - Make each action card/button directly clickable to roll/perform the action; avoid requiring an extra "select then perform" step for common actions.
  - Action history becomes "Recent action status" with less audit detail by default.
  - Detailed audit content can remain available to GM or behind disclosure where needed.

### GM workspaces

- Templates:
  - Keep `TemplateLibrary`, `TemplateCreatePage`, and `TemplateEditorForm`.
  - Add a workspace wrapper with Library and Builder tabs.
  - Preserve the current builder tabs but improve visual hierarchy and sticky save/validation.

- Characters:
  - Reuse `ActiveSheetSelector` and `PlayerCharacterSheet` in GM mode.
  - Add instance list/access-code context where useful.

- Content:
  - Wrap `ActionAuthoringPage` and `ItemMakerPage` behind Content tabs.
  - Keep form/list behavior, improve split-pane layout.

- Rules Data:
  - Wrap facts, formulas, and proficiencies into one workspace with tabs.

- Status Effects:
  - Wrap conditions and standalone effects into one workspace with tabs.

- Encounters:
  - Wrap encounter presets and XP tracker into one workspace with tabs.

- Admin:
  - Keep `StateSafetyPanel` and `StateBackupPage`.
  - Add a danger-zone layout with clear import/export consequences.

### State and feedback

- Keep transport-facing requests generated/centralized through existing request builders.
- Add durable UI state for sync recovery if Step 5 approves:
  - `syncStatus: "synced" | "resyncing" | "stale"`
  - optional `syncMessage`
- Otherwise derive shell status from pending `resync_state` intent feedback, though that is weaker and harder to reason about.
- Promote Roll20 bridge state from scattered pills to persistent shell status.
- Keep `IntentFeedbackBanners`, but use them as secondary transient feedback.

### Styling

- Consolidate app screens onto the existing R6 theme:
  - `frontend/src/styles/r6-system-ui/*`
  - `frontend/src/styles/app.css`
  - `frontend/src/styles/sheet.css`
- Phase out older light/parchment card styles for active app surfaces.
- Keep contrast high, touch targets stable, and text non-overlapping on mobile.

## Data And Control Flow

- Backend authoritative state continues to enter through snapshots and patches.
- Active sheet selection, active workspace, active tab, filters, modal state, and drafts remain frontend-local.
- Player action execution still sends `perform_action` through existing request helpers.
- Resource and note edits still send existing backend requests.
- GM catalog edits continue to use current authoring request builders.
- Roll20 bridge status remains backend reported and fail-fast.

## Implementation Order

1. Add shell/status components and grouped GM navigation metadata.
2. Recompose `App.tsx` to render grouped workspaces without changing backend requests.
3. Rebuild player shell and player tabs around `Overview`, `Actions`, `Inventory`, `Details`, `Notes`.
4. Convert RollPanel/RollLog into compact action status and integrated action controls, with the Actions tab implemented as a dense searchable command grid.
5. Add GM workspace wrappers for Templates, Characters, Content, Rules Data, Status Effects, Encounters, Admin.
6. Restyle existing section components onto the R6 visual system.
7. Add durable sync recovery UI state if approved in Step 5.
8. Run frontend tests, lint, build, and browser viewport checks.

## Verification Plan

- `npm run test`
- `npm run lint`
- `npm run build`
- Browser checks at desktop, tablet, and mobile widths.
- Verify:
  - Player sees no GM-only controls.
  - GM can reach every current tool through grouped navigation.
  - Common player action execution is visible and fast.
  - Resource and notes edits still reconcile against backend patches.
  - Pending, success, error, disconnected, unauthorized, Roll20 disconnected, and resync states are visible.
- Text does not overflow controls or overlap.

## Step 5 Feedback Applied

- The player Actions tab must not reserve a large side panel for action feedback by default.
- The search field should remain available on the compact action surface.
- Advantage/disadvantage or other roll-mode controls should appear once for the relevant context, not repeated across every action entry.
- Action entries should behave like direct roll buttons/cards.
- Recent action feedback should be compact and secondary so the action grid remains the primary surface.

## Risks

- Changing tab names can break tests that expect current labels. Update tests intentionally.
- Flattened `gmView` state may become awkward with grouped workspaces. Step 5 should decide whether to keep compatibility or introduce a cleaner workspace/subtab model.
- `RollLog` currently exposes backend action audit details. Reducing default visibility must not remove useful GM debugging information; use disclosure or GM-only detail views.
- The current app lacks durable `resyncing`/`stale` state. Relying only on transient banners would not meet the frontend guidance as strongly.

## Open Step 5 Review Points

- Approve the new player tabs: `Overview`, `Actions`, `Inventory`, `Details`, `Notes`.
- Approve GM workspace grouping.
- Decide whether to add durable sync UI state.
- Decide whether `Kills` belongs in player `Details`, GM `Encounters > XP`, or both.
- Confirm that action history should become compact "Recent action status" by default.
