# Character Sheet Product Research Matrix

## Scope

This matrix focuses on recurring UI/UX patterns rather than feature parity. Products vary substantially by game license, automation depth, and whether they are primarily a builder, sheet, or VTT.

| Product / family | Strong pattern observed | Common risk | Design lesson for TTRPG-System-v02 |
|---|---|---|---|
| D&D Beyond | Persistent digital sheet, automatic resource calculations, integrated rolling, cross-device sync, and strong character identity | Automation can obscure where a value came from | Keep live values persistent, but expose base/modifier/source details to the GM |
| Demiplane / Roll20 NEXUS | Thematic but structured sheets, cross-linked rules, tooltips, search, and direct VTT continuity | Rich visual styling can increase density and scroll length | Use thematic framing sparingly; make rules detail one layer deeper than the play action |
| Roll20 sheets | Roll buttons embedded beside relevant values and a strong “sheet as play control” model | Legacy/custom sheets vary in accessibility and consistency | Put the roll affordance on the value/action, not in a detached generic roller |
| Quest Portal | Block-based authoring, tabs, reusable templates, roll buttons, points/slots widgets | Unlimited composition can fragment the product language | Keep configurable content inside a stable set of responsive slots |
| Foundry VTT systems | Highly customizable system-specific surfaces built with web primitives | Module freedom can create inconsistent patterns and upgrade burden | Keep this repo’s components dependency-free and define an internal contract before broad customization |
| Pathbuilder 2e | Builder/planner/sheet continuum and dense system-aware progression choices | Desktop-first density can leave mobile behind | Treat build/authoring and at-table play as different modes; design mobile from the start |
| DiceCloud | Formula-oriented custom sheets and flexible derived values | Formula power can overwhelm casual play | Display resolved values first; formula inspection belongs in GM/detail views |
| System-specific community sheets | Compact category tabs, collapsible detail, action favorites, and dense inventory tables | Copying paper layouts produces tiny controls and unclear hierarchy | Use layered density rather than paper-field density |

## Pattern synthesis

### Pattern A — Summary shell + detail destinations

The shared shell typically includes character identity and current resources. Tabs or destinations change the detail content below it. This keeps orientation stable and reduces the cost of moving between combat, inventory, and reference tasks.

### Pattern B — Contextual rolling

Rollability is most understandable when the roll control sits on the stat, skill, save, weapon, or action it represents. A generic dice roller is useful as a supplement but should not be the main path.

### Pattern C — System-aware controls

A good digital sheet knows that HP differs from inventory quantity and that an action differs from a note. Purpose-built widgets are clearer than universal text inputs.

### Pattern D — Guided complexity

Cross-links, tooltips, summaries, and expansion panels allow complex systems to remain usable without flattening their rules. The first layer should answer a play question, not reproduce the rules book.

### Pattern E — Templates and reusable structures

Custom systems need repeatable layouts. A template should define the stable responsive grammar while authored definitions fill its slots.

### Pattern F — Feedback at the point of intent

Connected tools show when a roll was sent, a value was saved, or a connection failed. For this project, that feedback is especially important because Roll20 is the public play log and the backend is authoritative.

## Direct product implications

| Observed pattern | Adopt | Adapt | Avoid |
|---|:---:|:---:|:---:|
| Persistent resource summary | ✓ |  |  |
| Contextual roll buttons | ✓ |  |  |
| Search/filter actions | ✓ |  |  |
| Rich rules cross-linking |  | ✓ later |  |
| Fully free-form sheet canvas |  |  | ✓ |
| Paper-sheet visual mimicry |  |  | ✓ |
| Deep automatic combat resolution in the frontend |  |  | ✓ |
| Builder and play mode in one dense surface |  |  | ✓ |
| Themeable token system | ✓ |  |  |
| Local action favorites | ✓ |  |  |

## Source notes

Official and primary sources reviewed on 2026-07-02:

- D&D Beyond player tools / character sheets: https://www.dndbeyond.com/players
- Roll20 and Demiplane integration announcement: https://blog.roll20.net/posts/roll20-x-demiplane-next-gen-character-tools-inside-the-vtt/
- Quest Portal character sheet editor documentation: https://help.questportal.com/en/articles/8631041-how-to-use-the-character-sheet-editor
- Foundry Virtual Tabletop product and developer framework: https://foundryvtt.com/
- Pathbuilder 2e product landing page: https://pathbuilder2e.com/
- WAI-ARIA Authoring Practices — Tabs: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- WCAG 2.2 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG 2.2 Status Messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html

Visual observations from live/app screenshots were used to identify broad layout patterns only. No proprietary artwork or exact product layout is included in the deliverable.
