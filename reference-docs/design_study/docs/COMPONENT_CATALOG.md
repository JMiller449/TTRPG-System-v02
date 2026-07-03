# Component Catalog

All components are presentational and dependency-free beyond React. They accept data and callbacks, making them compatible with the repository's backend-authoritative state flow.

Import from:

```tsx
import {
  SystemPanel,
  StatusHeader,
  ResourceMeter,
  StatGrid,
  SheetTabs,
  ActionCard,
  ProficiencyRow,
  InventoryItemCard,
  ConditionChip,
  SystemModal,
  SyncStatus
} from "@/design-system/r6-system-ui";
```

## `SystemPanel`

Use for major screen regions and modals.

```tsx
<SystemPanel title="Status" eyebrow="Character Interface" actions={<SyncStatus status="synced" />}>
  ...
</SystemPanel>
```

Variants: `default`, `raised`, `critical`, `quiet`.

Do not nest full `SystemPanel` components more than once. Use cards inside panels.

## `StatusHeader`

Persistent identity block.

```tsx
<StatusHeader
  name="Kael Ardent"
  title="Unregistered Rift Walker"
  rank="C"
  level={18}
  subtitle="Human · Vanguard"
  badges={["Frontline", "Awakened"]}
/>
```

`portraitUrl` is optional. Without it, the component renders a generated geometric monogram plate.

## `ResourceMeter`

Displays a current/max value and optional adjustment controls.

```tsx
<ResourceMeter
  label="Health"
  current={2220}
  max={2400}
  tone="health"
  onAdjust={(delta) => updateResource(delta)}
/>
```

Tones: `health`, `mana`, `action`, `warning`, `danger`, `arcane`.

## `StatGrid`

Grid of rollable primary or derived stats.

```tsx
<StatGrid
  stats={stats}
  onRoll={(stat) => performCheck(stat.key)}
/>
```

Each stat supports `value`, `modifier`, `description`, and a short glyph.

## `SheetTabs`

Accessible tab-strip presentation. Parent owns active state and tab panels.

```tsx
<SheetTabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
```

Provide tab panel `id` and `aria-labelledby` values in the parent, as demonstrated in the showcase.

## `ActionCard`

A combat/check action with a prominent execution control.

```tsx
<ActionCard
  action={action}
  onRoll={(rollMode) => performAction(action.id, rollMode)}
/>
```

The included card exposes normal, advantage, and disadvantage as a compact select. Replace the select with your existing `RollMode` component if desired.

## `ProficiencyRow`

Progression display for weapon, skill, or ability proficiency.

```tsx
<ProficiencyRow
  name="Longsword"
  category="Weapon"
  rank={4}
  progress={68}
  bonus="+1.40×"
/>
```

`progress` is 0–100 and should represent progress to the next proficiency rank, not a raw gameplay value.

## `InventoryItemCard`

Compact item/equipment card with equipped, quantity, rarity, tags, and item actions.

```tsx
<InventoryItemCard
  item={item}
  onEquip={() => toggleEquipped(item.id)}
  onUse={() => useItem(item.id)}
/>
```

Rarity is a restrained accent line: `common`, `uncommon`, `rare`, `epic`, `legendary`.

## `ConditionChip`

Short status indicator.

```tsx
<ConditionChip label="Bleeding" meta="2 rounds" tone="danger" />
```

Use a detail card or drawer when the condition has more than one sentence of rules text.

## `SystemModal`

System notification/confirmation dialog.

```tsx
<SystemModal open={open} title="Apply Damage" onClose={close}>
  ...
</SystemModal>
```

The component includes dialog semantics and Escape handling. Production integration should add focus trapping/restoration through the app's preferred modal primitive if one exists.

## `SyncStatus`

Small live-state indicator.

```tsx
<SyncStatus status="synced" version={128} />
```

Statuses: `connecting`, `synced`, `pending`, `disconnected`, `error`.

---

## Composition recipes

### Player status tab

1. `StatusHeader`
2. resource grid containing HP, mana, actions/reactions
3. defense facts (resistance, armor, movement)
4. `StatGrid`
5. derived stat cards

### Combat actions tab

1. sticky list toolbar: search, category, roll mode default
2. favorite/quick actions
3. action list using `ActionCard`
4. reaction section separated visually

### Equipment tab

1. equipped slots summary
2. carry weight/resource line
3. search and filters
4. `InventoryItemCard` list/grid
5. selected item details drawer

### Conditions tab

1. critical chips pinned at top
2. active condition cards
3. active standalone effects
4. GM-only remove/source tools

### GM edit mode

Wrap authored controls in a visually distinct `.r6-authoring-surface`. Keep final calculated values visible while editing so the GM sees the consequence of changes.
