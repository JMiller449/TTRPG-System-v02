# Frontend Design Bible

## 1. Product thesis

The character sheet is not a document viewer. During play it is an **instrument panel**: players repeatedly check four or five live values, trigger a small set of actions, inspect results, and only occasionally open the full rules detail behind them.

The recommended design is therefore **Functional Fantasy / Table Console**:

- Functional: fast recognition, direct actions, explicit feedback, strong keyboard support.
- Fantasy: names, category language, restrained texture, and thematic framing.
- Table console: large numeric telemetry, compact controls, status lights, and predictable panels.

The UI should feel like equipment used by an adventuring party, not like a scanned paper sheet and not like a generic admin dashboard.

## 2. Research scope and method

The study compared patterns from D&D Beyond, Roll20/Demiplane, Quest Portal, Foundry VTT, Pathbuilder 2e, DiceCloud, and other system-specific sheet implementations. Official product pages and documentation were prioritized for feature claims. Screenshots and live surfaces were used only for visual-pattern observation.

The study also inspected the current `TTRPG-System-v02` frontend architecture, current styles, `PlayerCharacterSheet`, its feature sections, the generated-backend-contract approach, and the uploaded Chip rules/stat material.

This is a pattern study, not a visual clone. No product’s branded trade dress, proprietary icons, artwork, or exact layout is reproduced.

## 3. What successful online sheets consistently do

### 3.1 Keep identity and live resources persistent

The character name, level/archetype, HP, mana or equivalent, and a connection/sync indicator remain visually stable while deeper content changes. This reduces reorientation and makes damage, healing, and resource spending auditable.

**Decision for this project:** the hero bar stays at the top of the sheet. On desktop it is sticky within the sheet scroll container. On mobile, identity compacts while resources remain visible.

### 3.2 Put frequent play actions ahead of reference data

Strong sheets distinguish “what can I do now?” from “what do I know?” Action buttons, rollable stats, favorites, and current conditions are surfaced before long descriptions or build details.

**Decision:** the first three player destinations are Overview, Actions, and Conditions. Equipment, Proficiencies, Kills, and Notes are secondary destinations.

### 3.3 Use progressive disclosure to control density

Online sheets are inherently information-dense. The best examples show a useful summary first, then expose descriptions, formulas, provenance, and edit controls on demand.

**Decision:** cards display name, value, cost, availability, and a one-line summary. Detailed formulas, effect steps, source item, and GM metadata live in an expandable detail region or dedicated authoring view.

### 3.4 Make calculated values feel trustworthy

Automatic calculation is only helpful when the user can understand the current number and the system clearly distinguishes base, modifier, and resolved value.

**Decision:** use a three-layer value model where needed:

- Current value — visually dominant.
- Base or maximum — secondary.
- Modifier/source explanation — expandable, never silently hidden from the GM.

### 3.5 Treat synchronization as a first-class interaction

For an authoritative server, a click is an intent rather than truth. The UI needs pending, confirmed, rejected, disconnected, and stale/resync states.

**Decision:** mutation controls expose a local pending state and are reconciled from snapshots/patches. A compact `SyncStatus` appears in the hero bar; detailed errors remain in the existing intent banners.

### 3.6 Support customization without destroying consistency

Custom systems benefit from flexible blocks, custom facts, and templates, but completely free-form layouts become hard to scan and impossible to support responsively.

**Decision:** customization occurs inside stable slots: resources, key facts, stat groups, actions, conditions, equipment, proficiencies, and notes. Authors configure the content; the product owns the interaction grammar.

### 3.7 Separate play mode from authoring mode

Player sheets optimize for speed and confidence. GM tools optimize for inspection, setup, and correction. Combining them produces accidental edits and visual overload.

**Decision:** retain the repo’s explicit player/GM split. GM edit affordances are not merely disabled player controls; authoring remains in purpose-built GM surfaces.

## 4. Information architecture

### 4.1 Player sheet hierarchy

1. **Hero bar**
   - name, archetype/race, level, status badges
   - HP, mana, actions, reactions
   - backend sync state
2. **Primary navigation**
   - Overview
   - Actions
   - Conditions
3. **Secondary navigation**
   - Equipment
   - Proficiencies
   - Kills
   - Notes
4. **Mobile quick-roll dock**
   - up to four pinned actions or checks

### 4.2 Overview content order

1. Alerting conditions or blockers.
2. Six main-stat clusters with related substats.
3. Public facts and resistances.
4. Passive effects and derived values.
5. Low-priority metadata.

### 4.3 Action destination

- Search.
- Filter chips: All, Favorite, Attack, Defense, Utility, Magic, Item.
- Availability summary.
- Action cards ordered by: pinned, available, category, authored order.
- Unavailable actions remain visible when useful, with a plain-language reason.

### 4.4 GM authoring hierarchy

The GM console should not inherit the player navigation. Use object libraries and editor workflows:

- browse/search definitions
- select an object
- edit in a focused form
- preview player-facing result
- save through a backend request
- show validation and mutation status

## 5. Visual language

### 5.1 Default command-theme tokens

| Token | Value | Use |
|---|---:|---|
| Canvas | `#0e1012` | app background |
| Surface | `#15191d` | sheet background |
| Elevated | `#1b2025` | cards and sticky regions |
| Panel | `#20262b` | interactive cards |
| Border | `#343c43` | structure |
| Text | `#f4f2e9` | primary text |
| Muted | `#a7aca7` | supporting text |
| Amber | `#f2bd3a` | primary action/focus identity |
| Health | `#ff7b72` | HP and damage |
| Mana | `#6fa8dc` | mana/arcane |
| Reaction | `#8bc4a5` | reaction economy |
| Success | `#91d18b` | confirmed state |
| Danger | `#ff7b72` | errors/destructive state |

Primary text on canvas is approximately 17:1 contrast. Amber on the standard surface is approximately 10:1. Muted text on the standard surface is approximately 7.7:1. These values provide substantial headroom for normal text.

### 5.2 Color rules

- Amber means “interactive, selected, or primary,” not “warning.”
- Health, mana, actions, and reactions each have a stable semantic tone.
- Never rely on hue alone. Pair status color with label, icon, border style, or text.
- Reserve red for HP/damage and errors; distinguish them through context and iconography.
- Avoid rainbow category coding. Categories use labels and subtle neutral borders.

### 5.3 Typography

Use the existing system-friendly stack. Do not add a font dependency merely to create fantasy flavor.

- UI: `IBM Plex Sans`, `Segoe UI`, system sans-serif.
- Numeric telemetry: tabular numerals.
- Headings: slightly condensed feel through weight, uppercase, and tracking—not a decorative font.
- Body text: 15–16 px desktop, 16 px minimum for form inputs on mobile.

Hierarchy:

- Character name: 1.5–2rem, weight 750.
- Resource value: 1.25–1.6rem, tabular.
- Section title: 0.75–0.85rem uppercase with tracking.
- Card title: 0.95–1rem, weight 700.
- Metadata: 0.75–0.85rem.

### 5.4 Shape and depth

- Corners: 8 px controls, 12 px cards, 16 px major surfaces.
- Borders do most grouping work; shadows are shallow and sparse.
- Use one-pixel lines and narrow accent rails to suggest a control console.
- Texture is CSS-only and extremely subtle. Never place noisy textures behind text.

### 5.5 Spacing

Use a 4 px base rhythm.

- 4 px: icon/text micro-gap.
- 8 px: compact control gap.
- 12 px: card internal gap.
- 16 px: normal panel padding.
- 24 px: section separation.
- 32 px: major region separation.

## 6. Grid and responsive behavior

### Desktop: 1180 px and above

- Sheet max width: 1440 px.
- Hero bar: identity on left, four resources on right.
- Overview: six stat clusters in a 3-column grid.
- Actions: 2–3 columns depending on available width.
- Sticky primary navigation below the hero bar.

### Tablet: 760–1179 px

- Hero resources become a full-width second row.
- Stats use 2 columns.
- Actions use 2 columns.
- GM forms stack labels above controls.

### Mobile: below 760 px

- One-column flow.
- Hero avatar becomes compact initials.
- Resource controls remain at least 44 px high.
- Tab strip scrolls horizontally and preserves the selected tab in view.
- Action cards use a single large perform button.
- Quick-roll dock becomes sticky/fixed above the safe-area inset.
- Avoid nested independent vertical scroll regions.

## 7. Component grammar

### CharacterHeroBar

Use for identity, live resources, compact tags, and sync state. It is not an edit form. Identity changes belong in GM authoring.

### ResourceMeter

Use for current/max values with optional decrement/increment intent controls. The bar is supplemental; exact numeric values are always present.

Rules:

- Clamp visual percentage between 0 and 100, but do not silently clamp backend data.
- Disable mutation controls while the corresponding intent is pending.
- Name the control in accessible text: “Reduce Health” rather than “minus.”

### StatCluster

Each main stat owns its related substats. The main value is visually dominant; rollability is shown through button styling and a dice icon.

The project’s core groups are:

- Strength → Lifting, Carry Weight
- Dexterity → Acrobatics, Stamina, Reaction Time
- Constitution → Health, Endurance, Pain Tolerance
- Perception → Sight Distance, Intuition, Registration
- Arcane → Mana, Control, Sensitivity
- Will → Charisma, Mental Fortitude, Courage

### ActionDeck and ActionCard

Action cards answer five questions without expansion:

1. What is it?
2. What kind of action is it?
3. What does it cost?
4. Can I use it now?
5. What happens when I press the button?

The “perform” button contains the roll mode in its label when helpful: `Roll Damage`, `Make Check`, or `Use Action`.

### ConditionTray

Active conditions are status, not inventory. Show severity, duration/source when available, and a brief impact. GM-only removal is a secondary destructive control.

### AccessibleSheetTabs

Use the WAI-ARIA tabs pattern with roving `tabIndex`, arrow navigation, Home/End, `aria-selected`, and `aria-controls`. The current repo already implements much of this; the study component adds badges, disabled states, and reusable IDs.

### SyncStatus

Expose `offline`, `connecting`, `synced`, `pending`, `stale`, and `error`. A status change is announced, but routine repeated confirmations should not flood assistive technology.

### QuickRollDock

Player-only mobile affordance for up to four pinned actions. It is a shortcut, not a second source of action state.

## 8. Interaction rules

### 8.1 Clicking a rollable value

- Use a real `button` element.
- Label includes stat/action and current value.
- On activation, call the parent callback once.
- Show pending state on the originating control.
- Do not manufacture a local result.
- Reconcile with backend events and existing Roll20 delivery feedback.

### 8.2 Editing a resource

- Player presses +/− or opens an explicit adjustment menu.
- The UI emits an intent with context.
- Current value changes only after authoritative state arrives, unless the app adopts a clearly reversible optimistic layer.
- Errors stay associated with the action and also surface in the global intent feedback area.

### 8.3 Favorites

Favorites are frontend-local preference unless a backend preference model is intentionally added later. They may persist locally because they do not alter gameplay truth.

### 8.4 Empty states

Every empty state explains the next meaningful action:

- Player: “No actions are assigned to this sheet.”
- GM: “No actions are assigned. Open action assignment to add one.”

Avoid decorative empty illustrations that consume play-space.

### 8.5 Destructive actions

Use confirmation only for irreversible or high-impact operations. Removing a transient condition can be direct if backend undo exists and the result is clearly announced. Deleting authored definitions should require confirmation and dependency impact information.

## 9. Authoritative-state UX

The frontend needs two distinct state families:

### Server state

- stats and formulas
- current HP/mana
- actions and action availability
- equipment and quantities
- proficiencies and XP
- facts, conditions, effects
- permissions and role
- state version

### Local UI state

- active tab/view
- collapsed/expanded cards
- search and filters
- temporary form drafts
- focus restoration
- favorite display preferences
- pending intent presentation

Never derive a second canonical combat model in the component kit. The backend remains the only source of gameplay truth.

## 10. Content and microcopy

- Prefer verbs: `Roll`, `Use`, `Equip`, `Remove`, `Apply`, `Save`.
- State why disabled: `Unavailable — no reactions remaining`.
- Use `GM` consistently; do not alternate between DM and GM in the same surface.
- Use sentence case for controls and title case only for authored names.
- Expose units beside values, never only in tooltips.
- Avoid raw IDs in player view. IDs may appear in a GM diagnostics disclosure.

## 11. Accessibility requirements

- All interactive targets are 44 px in the mobile layout; 36 px compact desktop controls are acceptable when spaced.
- Visible focus uses a high-contrast amber outline plus offset.
- Tabs follow the ARIA pattern and maintain a single tab stop.
- Status updates use `role="status"`; errors use `role="alert"` only when immediate interruption is warranted.
- Progress bars expose exact value and maximum.
- Icons are decorative unless they convey unique information.
- Motion respects `prefers-reduced-motion`.
- Zoom to 200% must not cause two-dimensional page scrolling for normal player workflows.
- Color is never the only signal.

See `ACCESSIBILITY_AND_RESPONSIVE.md` for the test checklist.

## 12. What not to do

- Do not mimic a paper form with dozens of tiny bordered inputs.
- Do not hide core resources behind tabs.
- Do not put GM editing controls into every player card.
- Do not use hover as the only way to discover rollability.
- Do not show formulas as the primary value.
- Do not introduce a component library solely for this refresh.
- Do not handwrite transport payloads in components.
- Do not let optimistic UI become a parallel game state.
- Do not turn every card into an accordion; expansion should be purposeful.
- Do not use neon glows, noisy animated backgrounds, or faux-terminal monospace body text.

## 13. Recommended implementation sequence

### Phase 1 — Foundation

- Add design tokens and the isolated stylesheet.
- Add `SyncStatus` and pending/error conventions.
- Replace only the player sheet header with `CharacterHeroBar` and `ResourceMeter`.

### Phase 2 — Play speed

- Introduce `ActionDeck` using existing assigned-action selectors and perform-action request builder.
- Add clear availability reasons.
- Add mobile `QuickRollDock` for pinned actions.

### Phase 3 — Scanability

- Re-present existing stats as `StatCluster` cards.
- Re-present conditions through `ConditionTray`.
- Preserve existing GM editors behind dedicated edit affordances.

### Phase 4 — System-wide consistency

- Apply the token vocabulary to GM toolbars, authoring lists, empty states, and intent banners.
- Add density preference only after the default layout is proven.

## 14. Acceptance criteria

A player can:

- identify current HP, mana, actions, and reactions within two seconds;
- perform a favorite action in one interaction from the Actions tab or mobile dock;
- tell whether an action is unavailable and why;
- reach every sheet section by keyboard;
- distinguish pending, confirmed, disconnected, and rejected intents;
- use the sheet at 320 CSS px without horizontal page scrolling;
- use the sheet at 200% zoom without losing controls;
- understand every color-coded state without color perception.

A developer can:

- adopt each component independently;
- connect mutations through existing request builders;
- use the components without adding a package;
- replace the sample data with current selectors without changing component internals;
- remove the study kit without affecting backend state or protocol code.
