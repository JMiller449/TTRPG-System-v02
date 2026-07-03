# Accessibility and QA Checklist

## Contrast and transparency

- [ ] Normal text reaches at least 4.5:1 against the actual composited panel background.
- [ ] Large text and meaningful UI boundaries reach at least 3:1.
- [ ] Muted text is still readable; it is not implemented as opacity alone.
- [ ] A solid panel fallback works when `backdrop-filter` is unsupported.
- [ ] `prefers-reduced-transparency` or the supplied `.r6-theme--solid` class produces opaque surfaces.
- [ ] Campaign/background art cannot make text unreadable.

## Keyboard

- [ ] Every roll/action control is a real `<button>`.
- [ ] Tabs are reachable in a logical order and selected state is exposed.
- [ ] Focus is visibly outlined, not indicated only by a subtle glow.
- [ ] Modal closes with Escape.
- [ ] Focus returns to the triggering control after production modal close.
- [ ] No focusable control is hidden behind a collapsed/disabled surface.

## Screen readers

- [ ] Resource meters expose label, current, and maximum.
- [ ] Icon-only controls have accessible names.
- [ ] Roll and sync feedback uses an `aria-live` region.
- [ ] Tab panels reference their tabs.
- [ ] Condition color is accompanied by text/severity.
- [ ] Form errors are connected to the relevant input.

## Touch and responsive behavior

- [ ] Primary controls are 44px high where practical.
- [ ] No required interaction is hover-only.
- [ ] Horizontal tab scrolling has a visible selected tab.
- [ ] Long names and four-digit statistics do not overflow.
- [ ] Quantity steppers remain usable at 320px viewport width.
- [ ] On-screen keyboard does not hide resource/form confirmation controls.

## Motion

- [ ] Nonessential animation is disabled under `prefers-reduced-motion`.
- [ ] No continuous flashing/pulsing decoration.
- [ ] Resource change animation does not obscure the new value.
- [ ] Loading state communicates progress without motion dependence.

## State and trust

- [ ] Connected, pending, disconnected, and error states are distinct in text.
- [ ] Disabled rolls explain why they are unavailable.
- [ ] Optimistic UI reconciles to the authoritative server response.
- [ ] A state-version gap leads to visible resync feedback.
- [ ] Destructive GM actions name the affected entity.

## Browser smoke test

- [ ] Current Chrome/Edge.
- [ ] Current Firefox.
- [ ] Current Safari if deployment includes macOS/iOS.
- [ ] Browser zoom at 200%.
- [ ] Windows high-contrast/forced-colors mode.
- [ ] Reduced motion enabled.
- [ ] Keyboard-only complete player flow.
