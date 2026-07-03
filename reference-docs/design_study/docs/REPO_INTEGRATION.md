# Integration Guide for `JMiller449/TTRPG-System-v02`

## Repository fit

The target frontend is React 18 + TypeScript + Vite and already uses a central CSS import file. The application also separates backend-authoritative state from local UI state. This kit is designed to preserve that architecture:

- components never mutate server state directly;
- all state-changing behavior is passed through callbacks;
- existing `GameClient` request builders remain the mutation path;
- active tab, modal state, filters, and local drafts remain frontend-local;
- generated backend protocol types remain untouched.

## Path A — theme the existing UI first

This is the lowest-risk adoption path and provides immediate visual impact.

### Step 1: copy files

Copy:

```text
drop-in/frontend/src/styles/r6-system-ui/
```

to:

```text
frontend/src/styles/r6-system-ui/
```

### Step 2: import the theme

At the end of `frontend/src/styles/index.css`:

```css
@import "./r6-system-ui/index.css";
```

### Step 3: scope the theme

In `frontend/src/app/App.tsx`, add `r6-theme` to the existing shell:

```tsx
<div className={`r6-theme app-shell ${role === "player" ? "app-shell--player" : ""}`}>
```

The `r6-compat.css` layer restyles existing classes such as:

- `.panel`
- `.button`
- `.tab`
- `.character-sheet`
- `.character-sheet__tab`
- `.resource-card`
- `.stat-item`
- `.equipment-card`
- `.list-item`
- form controls and focus states

Because the selectors are scoped under `.r6-theme`, removal is one class change.

### Step 4: test existing flows

Verify:

- session landing and player entry;
- GM toolbar on narrow screens;
- every character-sheet tab;
- resource edit inputs;
- item quantity steppers;
- action roll controls;
- error and intent banners;
- keyboard focus order.

## Path B — replace high-value components incrementally

After the compatibility skin is stable, copy:

```text
drop-in/frontend/src/design-system/r6-system-ui/
```

to:

```text
frontend/src/design-system/r6-system-ui/
```

Recommended migration order:

| Existing feature | New component | Reason |
|---|---|---|
| `Panel` | `SystemPanel` | establishes the visual frame |
| character header | `StatusHeader` | strongest thematic improvement |
| `SheetResourceHeader` | `ResourceMeter` | clearer volatile values |
| `SheetStatsSection` cards | `StatGrid` | click-to-roll status-screen feel |
| `CharacterSheetTabs` | `SheetTabs` | consistent active/focus states |
| action rows/cards | `ActionCard` | combat-first hierarchy |
| proficiency cards | `ProficiencyRow` | progression visibility |
| equipment cards | `InventoryItemCard` | readable equipped/quantity states |
| conditions | `ConditionChip` + detail cards | fast scanning |
| connection UI | `SyncStatus` | explicit real-time confidence |

## Example adapter: stats

Keep repository/domain types outside the design system:

```tsx
const displayStats = Object.entries(stats).map(([key, value]) => ({
  key,
  label: statLabels[key] ?? key,
  shortLabel: key.slice(0, 3).toUpperCase(),
  value,
  modifier: getModifier(key)
}));

<StatGrid
  stats={displayStats}
  onRoll={(stat) => {
    client.sendProtocolRequest(
      buildPerformActionRequest({
        sheetId: detail.instance.id,
        actionId: resolveBaselineCheckActionId(stat.key),
        rollMode: "normal"
      }),
      `Roll ${stat.label}`
    );
  }}
/>;
```

The exact action lookup should use the repository's existing authored-action model; the design component should not invent transport payloads.

## Example adapter: resources

```tsx
<ResourceMeter
  label="Health"
  current={resourceEditor.resources.health.current}
  max={detail.stats.health}
  tone="health"
  onAdjust={mode === "gm" ? (delta) => {
    resourceEditor.beginResourceEdit("health");
    resourceEditor.setResourceDraftModifier(String(delta));
    resourceEditor.applyResourceModifier();
  } : undefined}
/>
```

Prefer adapting the editor hook rather than moving request/state logic into `ResourceMeter`.

## CSS ordering

The R6 theme import is intentionally last so it can override the existing neutral skin. Once individual legacy styles are removed, the theme can move earlier and the compatibility file can shrink.

Recommended final order:

```css
@import "./r6-system-ui/r6-tokens.css";
@import "./r6-system-ui/r6-foundation.css";
@import "./shared.css";
@import "./app.css";
@import "./sheet.css";
/* feature styles */
@import "./r6-system-ui/r6-components.css";
@import "./r6-system-ui/r6-compat.css";
```

## Suggested implementation slices

### Slice 1 — visual theme only

- add theme CSS;
- scope on root;
- repair regressions;
- no behavior changes.

### Slice 2 — player status header

- replace identity/resources/stat cards;
- preserve existing hooks and callbacks;
- add roll feedback live region.

### Slice 3 — actions and conditions

- adopt `ActionCard` and `ConditionChip`;
- keep request builders unchanged;
- add search/filter local state.

### Slice 4 — equipment and proficiency progression

- adopt item/proficiency cards;
- add sorting/filtering;
- validate large-number formatting.

### Slice 5 — GM authoring mode

- explicit edit-mode affordance;
- style formula/source metadata;
- system modal confirmations.

## Integration guardrails

- Do not handwrite new websocket payload types in the design-system folder.
- Do not store authoritative HP, mana, equipment, or stats in component state.
- Do not hide request failures behind optimistic animation.
- Do not place generated protocol files inside the kit.
- Do not replace accessible HTML controls with decorative `<div>` elements.
