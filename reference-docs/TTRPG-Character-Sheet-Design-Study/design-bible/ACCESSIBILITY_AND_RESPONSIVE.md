# Accessibility and Responsive Requirements

## Baseline

Target WCAG 2.2 AA for the player sheet and GM authoring surfaces. The kit is designed around semantic HTML and native controls; do not replace them with generic clickable elements.

## Keyboard

### Global

- All actions are reachable with Tab/Shift+Tab.
- Enter or Space activates buttons.
- Focus is never trapped outside an intentional modal.
- When content is removed, focus moves to a logical surviving control.
- Closing a dialog returns focus to the opener.

### Tabs

- Tab enters the selected tab.
- Left/Right changes horizontal tabs.
- Up/Down is also supported for compatibility.
- Home selects the first tab; End selects the last.
- Only the active tab has `tabIndex=0`.
- Each tab references its panel with `aria-controls`.
- Each panel references its tab with `aria-labelledby`.

### Action deck

- Search is first in the section order.
- Filter buttons use `aria-pressed`.
- Card actions follow a consistent order: favorite, details, perform.
- Disabled actions use `disabled` where activation is impossible and display a visible reason.

## Focus treatment

Use a 3 px amber outline with 3 px offset. Do not remove the browser outline unless this replacement is present. Focus must remain visible over health, mana, and selected backgrounds.

## Touch and pointer

- Mobile primary targets: 44 × 44 CSS px or larger.
- Desktop compact targets: no smaller than 32 px and separated from adjacent destructive actions.
- Do not require precision dragging for core tasks.
- Hover styles are enhancements only.
- Tooltips must also open through keyboard focus and should not contain essential instructions.

WCAG 2.2’s minimum target criterion allows 24 × 24 CSS px or sufficient spacing, but this design intentionally uses the more comfortable 44 px mobile target.

## Screen readers

- Decorative SVGs use `aria-hidden="true"`.
- Resource bars expose label, current value, and maximum.
- A resource control says “Reduce Health” rather than “minus.”
- Status changes use a persistent `role="status"` region.
- Immediate errors use `role="alert"` sparingly.
- Card headings are real headings, maintaining a logical outline.
- Avoid repeating every card’s category and state in both visible and hidden text.

## Status and async feedback

| State | Visual | Announcement |
|---|---|---|
| Synced | neutral/success dot + “Synced” | Announce only on meaningful transition |
| Connecting | animated-neutral indicator + text | Polite status |
| Pending mutation | amber indicator + specific verb | Polite status once |
| Rejected | error border + reason | Alert or focused inline error |
| Offline | disconnected icon + text | Polite status; alert when an attempted action fails |
| Stale/resyncing | warning indicator + “Resyncing” | Polite status |

Never announce high-frequency passive patch traffic.

## Color and contrast

- Normal text: at least 4.5:1.
- Large text and icons needed to understand state: at least 3:1.
- Focus indicator and control boundaries: at least 3:1 against adjacent colors.
- Error, success, and pending states include text or icon shape in addition to hue.
- The supplied command-theme core pairs exceed these targets.

## Motion

- Use transitions only for orientation: 120–180 ms.
- Do not animate numeric values through intermediate fake states.
- Disable nonessential transition/animation under `prefers-reduced-motion: reduce`.
- Avoid pulsing health or flashing error states.

## Reflow and zoom

At 320 CSS px and 200% zoom:

- no page-level horizontal scrolling;
- tabs may horizontally scroll inside their own strip;
- data tables become cards or have an explicitly labeled horizontal region;
- resource cards wrap rather than shrink numbers;
- sticky elements must not cover focused controls;
- dialogs fit the viewport and have internal scrolling only when needed.

## Breakpoint behavior

### ≥1180 px

- 3-column stats.
- 2–3-column actions.
- sticky hero and navigation inside the sheet workspace.

### 760–1179 px

- 2-column stats/actions.
- hero resources become a second row.
- authoring forms use fewer columns.

### <760 px

- single column.
- horizontally scrollable tabs.
- fixed/sticky quick-roll dock with safe-area padding.
- 44 px controls.
- no nested vertical scrolling.

## Manual test checklist

### Keyboard

- [ ] Reach all header controls.
- [ ] Traverse tabs with arrows, Home, and End.
- [ ] Search/filter and perform an action without a pointer.
- [ ] Open/close details and return focus.
- [ ] Trigger and recover from an inline error.

### Screen reader

- [ ] Character and resource summary is understandable in reading order.
- [ ] Resource values include max/unit.
- [ ] Tabs announce position and selected state.
- [ ] Pending and error states are announced once.
- [ ] Disabled reason is discoverable.

### Visual

- [ ] 200% zoom.
- [ ] 320, 375, 768, 1024, 1440 px widths.
- [ ] Windows high contrast / forced colors.
- [ ] Reduced motion.
- [ ] Grayscale simulation.
- [ ] Long character/action names.
- [ ] Values from 0 through five digits.

### Interaction resilience

- [ ] Slow websocket response.
- [ ] Duplicate click while pending.
- [ ] Backend rejection.
- [ ] Disconnect during mutation.
- [ ] State-version gap and resync.
- [ ] Empty and very large action/equipment lists.
