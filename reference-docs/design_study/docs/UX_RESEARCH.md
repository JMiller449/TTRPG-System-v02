# Character Sheet Site UX Research

## Scope

This study looks for durable interaction patterns across browser-based character sheets and VTT-adjacent tools, then adapts them to the R6/Chip system and the supplied Korean manhwa interface direction. It is not a visual clone of any existing product.

## Sources reviewed

1. **D&D Beyond — official character builder page**  
   https://www.dndbeyond.com/characters  
   Publicly highlights cross-device synchronization, HP/spell/feature/inventory tracking, automatic healing/damage math, and click-to-roll dice.

2. **Roll20 — platform feature model**  
   https://roll20.net/  
   Established pattern: dynamic character sheets integrated with automated rolling, chat, compendium content, and a live game session.

3. **Demiplane Nexus — digital toolset pattern**  
   https://www.demiplane.com/  
   Established pattern: character building plus searchable/cross-linked digital rules and tooltips.

4. **Foundry Virtual Tabletop — modular system model**  
   https://foundryvtt.com/  
   Established pattern: system-specific actor sheets, item relationships, permissions, and modular customization.

5. **W3C WCAG 2.2 understanding documents**  
   https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html  
   https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html  
   https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html  
   https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html

6. **MDN CSS references**  
   https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter  
   https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion

7. **Target repository architecture and current sheet structure**  
   Repository README, current React package, `PlayerCharacterSheet`, and current CSS class contracts were reviewed to ensure the kit can be staged into the existing frontend without taking ownership away from the backend.

---

## Common successful patterns

### 1. A persistent identity and resource summary

Digital sheets consistently place character identity and volatile resources above or beside deeper content. This reduces tab switching during combat.

**Adoption:** `StatusHeader` plus compact `ResourceMeter` components remain above the active tab panel.

### 2. Click-to-roll directly from the value

The digital advantage over paper is that the displayed value can also be the action target. The user should not need to copy a stat into a separate dice interface.

**Adoption:** `StatCard` and `ActionCard` expose explicit roll buttons/callbacks. The visual value remains readable even when rolling is disabled.

### 3. Tabs and progressive disclosure

A complete character cannot fit in a single undifferentiated screen. Strong sheets group content into a small number of predictable tabs and reveal long descriptions on demand.

**Adoption:** six player-facing categories, horizontally scrollable on small screens. Long action/item text belongs in `<details>` or a side/modal detail view.

### 4. Automatic values are visually distinguished from authored values

Digital sheets often mix base data, modifiers, and calculated results. Users lose trust when they cannot tell which value they can change.

**Adoption:**

- final value: large white number;
- modifier: smaller colored delta;
- formula/source: muted metadata;
- edit control appears only in explicit edit mode.

### 5. Search and filtering for long lists

Actions, spells, and inventory scale poorly without search, categories, and “equipped/prepared/favorite” shortcuts.

**Adoption:** component catalog recommends a shared list toolbar. The example inventory/action cards expose stable metadata fields for filtering.

### 6. Integrated rules references

Cross-linked compendiums and tooltips reduce context switching. However, giant hover cards are poor on touch devices.

**Adoption:** use a small info affordance that opens a keyboard-accessible popover or drawer. Do not rely on hover alone.

### 7. Role-aware editing

VTT tools separate player operation from GM/system authoring. Mixing them creates accidental edits and visual clutter.

**Adoption:** all example components receive callbacks and flags; they do not assume authority. Omit edit callbacks in player mode.

### 8. Explicit synchronization and request feedback

A real-time sheet needs visible connection, pending, success, and failure states. Silent failures are especially damaging when rolls are expected to appear in Roll20/chat.

**Adoption:** `SyncStatus`, disabled roll states, and live-region feedback are first-class components.

### 9. Responsive prioritization, not simple shrinking

Mobile character sheets work when volatile combat information remains easy to reach and less frequent details move deeper.

**Adoption:** identity/resources first, horizontally scrolling tabs, stacked content, comfortable controls, and no desktop-only hover dependency.

### 10. Personalization within guardrails

Theme color and portrait customization can improve ownership, but arbitrary colors can destroy contrast.

**Adoption:** expose a small semantic theme set later (cyan, violet, green, amber), each with tested tokens. Do not expose raw foreground/background color pickers by default.

---

## Specific recommendations for this system

The Chip/R6 rules emphasize very large statistics, analog proficiency progression, action management, reactions, HP/mana, resistance, and opposed rolls. The sheet should therefore prioritize:

- large stat values with stable alignment;
- visible actions/reactions remaining;
- resource bars that tolerate values in the thousands;
- proficiency rank/progress rows;
- defenses and resistance near HP;
- action cards that show governing stat and formula;
- clear roll-mode controls for normal/advantage/disadvantage;
- conditions and effects that show their mechanical source;
- a GM-only formula/source inspection mode.

A conventional D&D-like “six small ability boxes plus lots of prose” would undersell the system's progression fantasy. The status screen should make growth feel dramatic while preserving table usability.

---

## Research-to-design matrix

| Observed need | Design response | Included artifact |
|---|---|---|
| Fast combat scanning | persistent identity/resources | `StatusHeader`, `ResourceMeter` |
| Direct digital action | clickable values and roll cards | `StatGrid`, `ActionCard` |
| Large content volume | tabs + disclosure | `SheetTabs`, catalog patterns |
| Trust in calculations | base/modifier/formula hierarchy | `StatCard`, action metadata |
| Inventory scale | compact cards, tags, equipped state | `InventoryItemCard` |
| Progression visibility | ranked progress meter | `ProficiencyRow` |
| Live backend | sync and request feedback | `SyncStatus`, showcase toast |
| Role separation | optional callbacks/edit flags | all React APIs |
| Mobile play | auto-fit grids and scrollable tabs | CSS foundations/components |
| Manhwa identity | system frames, cyan glass, clipped corners | all style sheets |
| Accessibility | contrast, focus, target, reduced motion | tokens + checklist |

---

## What was deliberately not copied

- Product-specific navigation structures.
- Proprietary icons, fonts, art, logos, or panel imagery.
- D&D-specific mechanics or terminology.
- Any exact manhwa screenshot layout.
- Existing frontend bible content from the repository.
