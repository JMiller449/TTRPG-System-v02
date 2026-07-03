# R6 Manhwa Character Sheet UI Study

A from-scratch frontend design study and reusable React/CSS component kit for **TTRPG-System-v02**.

The kit translates the supplied Korean manhwa “system window” references into a practical character-sheet interface: cyan/blue glass panels, precise double-line frames, clipped corners, luminous but restrained active states, and dense information that remains easy to scan.

## What is included

- `docs/DESIGN_BIBLE.md` — full visual and interaction language.
- `docs/UX_RESEARCH.md` — character-sheet UX findings and product-pattern analysis.
- `docs/COMPONENT_CATALOG.md` — component APIs, usage guidance, and composition recipes.
- `docs/REPO_INTEGRATION.md` — two integration paths for the target repository.
- `docs/ACCESSIBILITY_CHECKLIST.md` — implementation and QA checklist.
- `drop-in/frontend/src/design-system/r6-system-ui/` — dependency-free React + TypeScript components.
- `drop-in/frontend/src/styles/r6-system-ui/` — tokens, foundations, component styles, and a compatibility skin for existing repo classes.
- `preview/index.html` — static interactive visual preview; no build step required.
- `preview/status-screen.png` — rendered desktop reference image of the default status view.

## Fastest way to inspect the design

Open `preview/index.html` in a browser. The preview includes functional tabs, roll feedback, resource adjustment, a system notification modal, keyboard focus states, and responsive layouts.

## Fastest repository integration

1. Copy both folders under `drop-in/frontend/src/` into the repository's `frontend/src/`.
2. Add this import at the end of `frontend/src/styles/index.css`:

```css
@import "./r6-system-ui/index.css";
```

3. Add `r6-theme` to the top-level application shell:

```tsx
<div className={`r6-theme app-shell ${role === "player" ? "app-shell--player" : ""}`}>
```

That activates the scoped compatibility skin without requiring a full component rewrite. See `docs/REPO_INTEGRATION.md` for the staged migration.

## Constraints intentionally followed

- React 18 and TypeScript compatible.
- No runtime component or icon dependency.
- No copied manhwa art, logos, fonts, or proprietary UI assets.
- Presentational callbacks only; authoritative state remains outside the components.
- Glass effects have solid-color fallbacks and reduced-transparency handling.
- Motion is disabled under `prefers-reduced-motion`.
