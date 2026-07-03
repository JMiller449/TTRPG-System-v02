# TTRPG System v02 — Character Sheet Frontend Design Study

A repo-aligned UI/UX study and dependency-free React component kit for `JMiller449/TTRPG-System-v02`.

## Recommendation in one sentence

Build the player sheet as a **dark industrial table console**: identity and live resources remain visible, high-frequency rolls are one action away, dense reference material is progressively disclosed, and every mutation visibly reconciles with the authoritative backend.

## Package contents

- `design-bible/FRONTEND_DESIGN_BIBLE.md` — complete design direction, IA, tokens, states, interaction rules, and acceptance criteria.
- `design-bible/RESEARCH_MATRIX.md` — cross-product study of current online character-sheet patterns.
- `design-bible/ACCESSIBILITY_AND_RESPONSIVE.md` — keyboard, screen-reader, touch, contrast, motion, and breakpoint requirements.
- `design-bible/SYSTEM_ALIGNMENT.md` — direct translation of the supplied Chip rules/stat structure into UI requirements.
- `design-bible/INTEGRATION_GUIDE.md` — precise mapping to the current repo and incremental adoption sequence.
- `design-bible/COMPONENT_API.md` — component contracts and composition guidance.
- `drop-in/frontend/src/shared/ui/character-sheet-study/` — reusable React/TypeScript components.
- `drop-in/frontend/src/styles/character-sheet-study.css` — isolated, tokenized CSS with no third-party dependency.
- `drop-in/frontend/src/features/sheets/characterSheetStudyAdapter.ts` — adapter examples for the repo’s current domain models.
- `preview/` — a static, interactive visual preview that opens without a build step.
- `validation/` — smoke-test configuration and validation notes.

## Fastest way to inspect it

Open `preview/index.html` in a browser.

## Fastest way to try it in the repo

1. Copy `drop-in/frontend/src/shared/ui/character-sheet-study` into the matching repo path.
2. Copy `drop-in/frontend/src/styles/character-sheet-study.css` into `frontend/src/styles/`.
3. Add this as the last line of `frontend/src/styles/index.css`:

```css
@import "./character-sheet-study.css";
```

4. Wrap a test surface in `className="cs-theme"` and render one component at a time. Start with `CharacterHeroBar` or `ActionDeck` rather than replacing `PlayerCharacterSheet` wholesale.

## Architectural promise

The kit does not own canonical stats, resources, rolls, inventory, conditions, or action results. It owns only presentation and ephemeral UI concerns such as active tab, search text, and favorites filtering. All durable changes are emitted through callbacks intended to call the repo’s existing request builders and `GameClient`.

## Visual direction

The default theme is black/dark gray with warm amber accents and a restrained control-room character. It is modern and readable rather than neon or cyberpunk. A parchment-compatible token preset is included for gradual migration, but the design bible recommends the command theme as the product identity.

## Validation

The reusable component folder is TypeScript smoke-tested against React type definitions. The preview uses no remote assets, fonts, or scripts.
