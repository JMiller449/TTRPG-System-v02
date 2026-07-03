# Component API and Composition

All components live under:

```text
frontend/src/shared/ui/character-sheet-study/
```

They are controlled where gameplay state is concerned and may keep only ephemeral display state.

## CharacterHeroBar

```ts
interface CharacterHeroBarProps {
  name: string;
  eyebrow?: string;
  subtitle?: string;
  level?: number;
  portraitUrl?: string;
  badges?: string[];
  resources: ResourceViewModel[];
  syncStatus?: SyncStatusViewModel;
  actions?: ReactNode;
}
```

Use once per active sheet. Do not place identity edit inputs inside it.

## ResourceMeter

```ts
interface ResourceViewModel {
  id: string;
  label: string;
  value: number;
  max?: number;
  unit?: string;
  tone?: "health" | "mana" | "action" | "reaction" | "neutral";
  status?: AsyncUiStatus;
  errorMessage?: string;
  onDecrease?: () => void | Promise<void>;
  onIncrease?: () => void | Promise<void>;
}
```

Omit callbacks for read-only resources. The visual percentage is clamped, but the exact received value is displayed.

## AccessibleSheetTabs

```ts
interface SheetTabDefinition {
  id: string;
  label: string;
  badge?: number | string;
  disabled?: boolean;
}
```

The parent owns `activeTab` and the actual panels. Use the same `idPrefix` when assigning panel IDs.

## StatCluster

```ts
interface StatGroupViewModel {
  id: string;
  label: string;
  value: number;
  modifier?: number;
  hint?: string;
  onRoll?: () => void | Promise<void>;
  substats: SubstatViewModel[];
}
```

A missing `onRoll` renders a static value. This makes resources such as Health or Mana readable without falsely implying a roll.

## ActionDeck

```ts
interface ActionViewModel {
  id: string;
  name: string;
  summary?: string;
  category: string;
  tags?: string[];
  cost?: string;
  rollLabel?: string;
  isFavorite?: boolean;
  pending?: boolean;
  disabledReason?: string;
  onPerform?: () => void | Promise<void>;
  onToggleFavorite?: () => void;
}
```

`ActionDeck` owns only query/filter state. It never edits action availability or cost.

## ConditionTray

```ts
interface ConditionViewModel {
  id: string;
  name: string;
  summary?: string;
  source?: string;
  duration?: string;
  severity?: "info" | "warning" | "danger";
  removable?: boolean;
  pending?: boolean;
  onRemove?: () => void | Promise<void>;
}
```

Player mode normally omits `onRemove`.

## SyncStatus

```ts
interface SyncStatusViewModel {
  state: "offline" | "connecting" | "synced" | "pending" | "stale" | "error";
  label?: string;
  detail?: string;
}
```

Use one persistent status region per sheet, not one per card.

## QuickRollDock

```ts
interface QuickRollItem {
  id: string;
  label: string;
  shortLabel?: string;
  pending?: boolean;
  disabledReason?: string;
  onTrigger?: () => void | Promise<void>;
}
```

Supply at most four items. The dock is hidden at desktop widths by the stylesheet.

## CharacterSheetStudyDemo

A composite reference implementation. It is useful for visual testing, not intended as a direct replacement for `PlayerCharacterSheet`. Production integration should adopt the smaller components around current selectors and hooks.
