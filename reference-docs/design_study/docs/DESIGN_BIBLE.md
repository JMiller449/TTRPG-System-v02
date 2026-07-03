# Frontend Design Bible — “System Glass”

## 1. Product intent

This character sheet should feel like a **diegetic status interface**: a supernatural system window the character could plausibly see, rather than a paper form placed on a webpage. It must still behave like a professional tool used for hours at a table.

The visual target is not “generic sci-fi.” It is the Korean manhwa system-screen vocabulary visible in the supplied references:

- luminous cyan and electric blue;
- deep navy translucent surfaces;
- thin double-line frames and corner brackets;
- clipped or stepped silhouettes;
- compact uppercase labels paired with large numeric values;
- white text with cyan interaction states;
- subtle depth, scanlines, and inner glow;
- very little decorative clutter inside the data region.

The implementation should capture the *grammar* of these interfaces without reproducing any specific copyrighted panel.

---

## 2. Design principles

### 2.1 Status first

The first viewport answers five questions immediately:

1. Who is this character?
2. What level/rank/title are they?
3. Are they healthy and able to act?
4. What are their primary stats?
5. What action should the player take next?

Identity, resources, and primary stats remain visually dominant. Notes, lore, and authoring controls are one level deeper.

### 2.2 Dense, not cramped

A tabletop sheet contains many related values. Do not imitate consumer dashboards that hide information inside excessive whitespace.

- Use an 8px spacing rhythm.
- Keep labels short.
- Align numeric values vertically.
- Use tabular numerals.
- Separate groups with lines, tint shifts, or section headers rather than giant gaps.
- Default panel padding: 16–20px desktop, 12–16px mobile.

### 2.3 Glow communicates state

Glow is functional, not ambient decoration.

Use cyan glow for:

- active tabs;
- keyboard focus;
- clickable roll targets on hover/focus;
- selected equipment;
- connected/synced state;
- a newly changed value for a brief moment.

Do not glow every border, every label, and every card simultaneously. The interface becomes unreadable when everything claims the same priority.

### 2.4 Glass requires a stable substrate

Translucency only works when the content plane remains predictable.

- Top-level system panels may use `backdrop-filter`.
- Nested cards should use mostly opaque navy fills.
- Text never sits directly on a busy image.
- Every glass surface has a solid fallback.
- Avoid stacking more than two blurred surfaces.

### 2.5 Numbers are the hero asset

The system emphasizes large statistics and visible progression. Numeric styling should feel intentional:

- `font-variant-numeric: tabular-nums`;
- strong value/label contrast;
- positive modifiers rendered separately from base values;
- progress toward the next rank represented spatially;
- large values allowed to scale down with `clamp()` rather than overflow.

### 2.6 Read mode and edit mode are different products

Player read/roll mode should be clean and game-like. GM authoring mode can reveal form controls, formulas, IDs, and relationship tools, but should not force those controls into the player's visual hierarchy.

Recommended behavior:

- player: click a stat/action to roll;
- GM: an explicit **Edit System Data** toggle reveals edit affordances;
- changes are staged locally, then submitted through existing request helpers;
- destructive operations use a confirmation system modal.

---

## 3. Visual anatomy

### 3.1 Background plane

Use a dark radial/linear gradient rather than a flat black:

- center: `#07182a`;
- edge: `#020610`;
- subtle cyan atmospheric bloom behind primary content;
- optional fine grid/scanline texture at ≤ 3% opacity.

The background may later accept campaign art, but a navy scrim must preserve contrast.

### 3.2 System panel silhouette

A top-level panel uses four layers:

1. dark translucent fill;
2. 1px cyan-gray outer line;
3. inset inner line;
4. isolated bright corner segments.

The default radius is deliberately small: 6–10px. The manhwa references feel engineered, not soft and bubbly.

Clipped corners are created with `clip-path`, but content should not rely on the clipped region. A rectangular fallback remains valid.

### 3.3 Header plate

Section titles sit inside a compact plate rather than floating as plain text.

- uppercase;
- 0.08–0.16em letter spacing;
- 14–18px;
- centered for major screens, left-aligned for working sections;
- thin border and dark fill;
- optional short cyan rail extending from one side.

### 3.4 Dividers

Use three divider tiers:

- major: bright 1px line plus faint glow;
- regular: `rgba(150, 222, 255, 0.28)`;
- nested: tint change only, no extra line.

Dashed borders should be rare. The reference style is precise and continuous.

---

## 4. Color system

### 4.1 Core tokens

| Role | Token | Value | Usage |
|---|---|---:|---|
| Void | `--r6-bg-void` | `#020610` | page edge/background |
| Deep | `--r6-bg-deep` | `#03111f` | opaque fallback |
| Panel | `--r6-bg-panel` | `rgba(7, 24, 42, .82)` | top-level glass |
| Card | `--r6-bg-card` | `rgba(8, 31, 52, .92)` | nested data card |
| Text | `--r6-text` | `#f4fbff` | primary content |
| Muted | `--r6-text-muted` | `#abc6d9` | secondary labels |
| Cyan | `--r6-cyan` | `#5eeeff` | primary interaction |
| Blue | `--r6-blue` | `#1fa8ff` | active gradient partner |
| Success | `--r6-success` | `#58f0b3` | connected, healed, valid |
| Warning | `--r6-warning` | `#ffd166` | fatigue, low resource |
| Danger | `--r6-danger` | `#ff5f83` | damage, failure, destructive |
| Arcane | `--r6-arcane` | `#a98cff` | magic/rare highlight |

### 4.2 Semantic rules

- Cyan means **interactive, current, selected, or system-owned**.
- Green means **successful or restored**, not “clickable.”
- Red/pink means **damage, failure, or destructive action**, not general emphasis.
- Amber means **attention or dwindling capacity**.
- Violet means **arcane, exceptional, or rare**.
- Never encode meaning by color alone; pair with text, icons, shape, or position.

### 4.3 Resource gradients

- HP: cyan → green at healthy values; amber below 35%; danger below 15%.
- Mana: blue → violet.
- Actions/reactions: cyan segmented bar.
- XP/proficiency: blue → cyan with a brighter leading edge.

---

## 5. Typography

The kit uses system fonts so it can be integrated without licensing or loading risk.

### 5.1 Stack

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
```

A future licensed font should preserve:

- high x-height;
- clear `1/I/l` distinction;
- strong numerals;
- medium rather than ultra-thin strokes.

### 5.2 Type scale

| Role | Size |
|---|---:|
| Character name | `clamp(1.5rem, 3vw, 2.5rem)` |
| Level number | `clamp(2.5rem, 6vw, 4.75rem)` |
| Panel title | `1rem–1.25rem` |
| Body | `0.92rem–1rem` |
| Label | `0.72rem–0.8rem` |
| Micro metadata | `0.68rem–0.75rem` |

Uppercase is reserved for labels and screen titles. Descriptions remain sentence case.

---

## 6. Layout system

### 6.1 Desktop

Recommended 12-column shell:

- identity/status header: full width;
- left rail (3 columns): portrait, quick resources, defenses;
- center (6 columns): active tab content;
- right rail (3 columns): quick actions, conditions, sync state.

The included showcase uses a simpler 4/8 split so it can slot into the existing frontend without requiring a new page framework.

### 6.2 Tablet

- identity remains full width;
- resources become a horizontal two- or three-column row;
- side rails collapse into the content flow;
- tabs remain horizontally scrollable.

### 6.3 Mobile

- one column;
- character identity is compact;
- level moves beside the name;
- resource meters remain visible near the top;
- tabs horizontally scroll with visible selected state;
- critical roll buttons use a 44px minimum comfortable target;
- secondary metadata collapses behind “Details.”

### 6.4 Container behavior

Components use container-friendly widths and do not depend on the viewport. Grid definitions rely on `auto-fit` and `minmax()` so they work inside the existing `.panel` and `.app-grid-player` shells.

---

## 7. Information architecture

Recommended player tabs:

1. **Status** — main stats, derived facts, defenses, resources.
2. **Actions** — attacks, abilities, checks, reaction options.
3. **Equipment** — equipped items first, inventory below, filters/search.
4. **Proficiencies** — progression rows, ranks, specialization.
5. **Conditions** — active conditions/effects with duration/source.
6. **Journal** — notes, goals, kills/XP, session details.

The existing application can retain its current tab names. The design kit focuses on hierarchy and component appearance rather than forcing a domain-model migration.

### Persistent information

Keep visible across tabs when space allows:

- character name and level;
- HP and mana;
- remaining actions/reactions;
- connection/sync state;
- active critical conditions.

---

## 8. Component behavior rules

### 8.1 Stats

A stat card is a button in play mode.

- short code and full name both visible;
- current value is dominant;
- modifier is secondary;
- hover/focus reveals “Roll” without moving layout;
- result feedback appears in a toast/banner and is also announced to assistive technology.

### 8.2 Resources

A resource meter contains:

- label;
- current/max numeric values;
- bar;
- optional decrement/increment controls in GM or resource-edit mode.

Do not make the bar itself the only representation of value.

### 8.3 Actions

Action cards prioritize execution:

- name;
- category and governing stat;
- cost;
- concise formula;
- primary roll button;
- expandable description/details.

Long rules text should not be permanently expanded in a combat list.

### 8.4 Inventory

Inventory uses cards/rows, not a decorative item grid that hides names.

- equipped items sort first;
- quantity controls are explicit;
- depleted state remains readable;
- tags are terse;
- rarity changes one accent line, not the whole background;
- item actions are grouped consistently.

### 8.5 Conditions

Conditions use chips for scanning and cards for detail.

- chip: name + severity/duration;
- detail card: source, mechanical effect, expiration, remove control;
- critical conditions may pin beside resources.

### 8.6 Dialogs and notifications

System dialogs use the brightest panel treatment because they interrupt gameplay.

- one clear title;
- one concise consequence statement;
- primary action on the right;
- destructive action explicitly labeled;
- escape and close button supported;
- no fake “YES/NO” if the real actions can be named.

---

## 9. Motion

Motion should imply a responsive magical system, not a cinematic HUD.

Recommended:

- hover/focus glow: 120ms;
- panel entrance: 180ms opacity + 4px translate;
- resource change flash: 300ms;
- modal entrance: 160ms;
- no constant pulsing except a truly urgent condition.

All nonessential animation is removed when `prefers-reduced-motion: reduce` is active.

---

## 10. Content voice

Interface copy is concise and declarative.

Good:

- `Roll Strength`
- `3 actions remaining`
- `Disconnected — rolls cannot reach Roll20`
- `Take 24 physical damage?`

Avoid:

- vague fantasy flavor inside control labels;
- unexplained abbreviations;
- “Something went wrong” when the request error is known;
- excessive all-caps paragraphs.

---

## 11. Accessibility contract

The manhwa style is only successful if the data remains readable.

- normal text contrast target: at least 4.5:1;
- large text and meaningful UI boundaries: at least 3:1;
- comfortable target size: 44×44px where practical, never below the WCAG 2.2 minimum without spacing compensation;
- visible focus ring that is not glow alone;
- real buttons for rolls and tabs;
- tab panels linked with `aria-controls`/`aria-labelledby`;
- progress bars expose label, current, and maximum values;
- status changes announced with `aria-live`;
- transparency-reduction fallback;
- keyboard and screen-reader QA included before merge.

---

## 12. Anti-patterns

Do not:

- use cyan body text everywhere;
- place low-opacity gray text on blurred art;
- stack glass on glass on glass;
- hide core values behind hover;
- make every stat a different color;
- animate scanlines over text;
- use 10px body copy to fit more data;
- rely on icons without text labels;
- put GM-only IDs and formula editors into the default player hierarchy;
- reproduce an existing manhwa panel one-for-one.
