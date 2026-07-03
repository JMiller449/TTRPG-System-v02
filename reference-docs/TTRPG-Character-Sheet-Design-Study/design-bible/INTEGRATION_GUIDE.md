# Repo Integration Guide

## Current repo fit

The current frontend is React + TypeScript + Vite with plain CSS and no component-library dependency. `PlayerCharacterSheet` already decomposes the sheet into dedicated sections for resources, stats, facts, actions, conditions, equipment, proficiencies, kills, notes, and effects. The sheet keeps active-tab selection local while mutations are submitted through `GameClient` and typed request builders.

That architecture is a good fit for incremental presentation replacement. The study kit intentionally does not introduce routing, global state, transport types, or a second rules layer.

## Files to copy

Copy:

```text
drop-in/frontend/src/shared/ui/character-sheet-study/
    -> frontend/src/shared/ui/character-sheet-study/

drop-in/frontend/src/styles/character-sheet-study.css
    -> frontend/src/styles/character-sheet-study.css

drop-in/frontend/src/features/sheets/characterSheetStudyAdapter.ts
    -> frontend/src/features/sheets/characterSheetStudyAdapter.ts
```

Then append to `frontend/src/styles/index.css`:

```css
@import "./character-sheet-study.css";
```

The stylesheet uses a `cs-` prefix and activates design tokens under `.cs-theme`, reducing collision risk with current classes.

## Recommended adoption path

### Step 1 — Hero and resources

In `PlayerCharacterSheet.tsx`, replace only the inner `.character-sheet__header` presentation. Keep `useResourceEditor` and every existing callback.

Conceptual mapping:

```tsx
<CharacterHeroBar
  name={detail.instance.name}
  eyebrow={mode === "gm" ? "GM sheet preview" : "Player character"}
  resources={resourceViewModels}
  syncStatus={syncViewModel}
/>
```

Build `resourceViewModels` from `resourceEditor.resources` and point `onDecrease` / `onIncrease` at the same resource adjustment functions already used by `SheetResourceHeader`.

### Step 2 — Tabs

The current `CharacterSheetTabs` already has sound ARIA and keyboard behavior. Either retain it and restyle it with the new tokens, or replace it with `AccessibleSheetTabs` to add badges and reusable tab definitions.

Do not change the current panel ownership. `PlayerCharacterSheet` should remain responsible for selecting and rendering the active panel.

### Step 3 — Stats

Use `buildStatGroups` from `characterSheetStudyAdapter.ts` with `detail.stats`. It follows the repo’s current main/substat model.

```tsx
const groups = buildStatGroups(detail.stats, (key) => {
  // Call an existing or future typed perform-check request.
  // Do not calculate the roll in this component.
});

<div className="cs-stat-grid">
  {groups.map((group) => <StatCluster key={group.id} group={group} />)}
</div>
```

GM modifier editing can remain in the current `SheetStatsSection` until a dedicated editing treatment is designed. The player presentation and GM editing form do not have to migrate together.

### Step 4 — Actions

Map `assignedActions` into `ActionViewModel` values. Use the existing `buildPerformActionRequest` call in the parent callback.

```tsx
const actionCards = buildActionCards(assignedActions, ({ actionId, sourceItemRelationshipId, rollMode }) => {
  client.sendProtocolRequest(
    buildPerformActionRequest({
      sheetId: detail.instance.id,
      actionId,
      sourceItemRelationshipId,
      rollMode
    }),
    `Perform action: ${actionId}`
  );
});

<ActionDeck actions={actionCards} />
```

Keep the request builder import in the feature layer, not inside shared UI.

### Step 5 — Conditions and mobile dock

Use `ConditionTray` for active conditions. Pass `onRemove` only in GM mode. Add `QuickRollDock` at the player shell level so it is not clipped by the sheet’s scroll region.

## State boundaries

### Safe local component state

- search query
- active category filter
- favorite-only toggle
- selected tab
- disclosure open/closed state
- focus restoration

### Must stay backend-authoritative

- current/max resources
- stats and derived values
- action availability/cost
- condition application/removal
- equipment and quantities
- proficiency use and XP
- roll/check/damage result
- permissions

## Pending intent pattern

The components accept `status` / `pending` props. The parent should derive these from the app’s existing intent lifecycle rather than letting a component assume success.

Suggested lifecycle:

1. Parent emits typed request.
2. Parent marks the specific control pending using the request/intent identity.
3. Control is disabled and labels the pending verb.
4. Backend patch updates canonical state.
5. Intent resolves; control returns to idle.
6. Rejection displays inline reason and remains available for retry.

## Theme migration

Wrap the new surface:

```tsx
<div className="cs-theme cs-theme--command">
  {/* study components */}
</div>
```

For a temporary light bridge:

```tsx
<div className="cs-theme cs-theme--parchment">
  {/* study components */}
</div>
```

The command theme is the recommended final identity. The parchment preset exists to support component-by-component adoption while the surrounding app still uses the current cream/teal palette.

## Tests to add in the repo

- tab arrow/Home/End navigation;
- action search and category filtering;
- disabled action reason rendering;
- perform callback fires once;
- resource pending state disables repeated intents;
- sync status accessible label;
- mobile quick dock renders only supplied shortcuts;
- no component imports request builders or generated protocol types.

## No backend work required

The kit is presentation-only. It does not require new websocket routes, state fields, generated protocol changes, or persistence. Some richer future states—such as authored action availability reasons—may benefit from backend-provided metadata, but the components accept that information without defining its transport.
