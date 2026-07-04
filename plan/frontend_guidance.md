## Frontend guidance for R6 Charsheet / TTRPG-System-v02

You follow these instructions when building or modifying frontend experiences for this project.

This project is a backend-first TTRPG character sheet and table-assist application. It is not a full simulator, not a replacement VTT, and not the authoritative roll log. The backend owns canonical state, validation, mutations, snapshots, patches, auth/session truth, and route contracts. The frontend renders backend state, submits player/DM intents, maintains local-only view state, and reconciles to backend snapshots and patches.

### Build with empathy for the table

* Design for players and DMs actively using the app during a live tabletop session. The interface must be fast, readable, low-friction, and useful under time pressure.
* Prioritize the actual play surface over marketing-style presentation. The first screen should be the usable character sheet, session view, or role-appropriate dashboard, not a landing page.
* Treat the frontend as a character-sheet companion and DM/admin tool. Do not add features that imply the app is a full battle simulator, map engine, VTT replacement, or separate authoritative play log.
* Respect the project’s Roll20 integration. Roll20 chat is the table play log. The frontend may show send status, failure states, previews, and submitted action feedback, but it must not create a competing authoritative chat/roll history.
* Keep common table workflows ergonomic:

  * selecting a character
  * reading current stats/resources quickly
  * performing authored actions/checks
  * seeing whether the backend and Roll20 bridge are connected
  * editing DM-authored content where permitted
  * recovering from stale/disconnected/resync states
* Make role differences clear. Player views should focus on using a sheet. DM views may expose authoring, administration, state import/export, character management, and privileged controls.
* Use clear status language for connection/auth/sync problems. A player should immediately understand whether an action failed because they are disconnected, unauthenticated, missing permission, out of sync, or because the Roll20 bridge is unavailable.

### Project-specific frontend architecture rules

* The frontend must not invent gameplay truth.
* The frontend must not directly mutate authoritative game state in local reducers.
* The frontend must not maintain handwritten transport payload shapes that drift from backend schemas.
* Use generated backend protocol types and route-contract metadata as the source of truth for websocket requests/events.
* When backend request/event schemas change, regenerate frontend protocol output before wiring new UI.
* Keep these categories separate:

  * backend-authoritative state from snapshots and patches
  * local UI state such as selected character, open tabs, filters, modals, drafts, expanded panels, and pending form input
  * optimistic/pending UX indicators that are clearly temporary and reconciled against backend responses
* State patches and snapshots include `state_version`. If a client detects a version gap, the UI should surface a resync/reconnecting state instead of pretending local state is reliable.
* Every action button that sends a backend request should have complete loading, success, error, disabled, disconnected, and unauthorized states.
* DM-only actions must be hidden or disabled for players, with concise permission messaging only where useful.
* Do not expose raw backend/internal mutation concepts to normal users. Label actions in game/table language, not implementation language.

### Visual direction

* The frontend should feel like a polished game interface suitable for a Korean regression/manhwa-inspired TTRPG character sheet.
* Use a dark readable base with cyan, blue, white, silver, and selective accent colors.
* Use translucent or liquid-glass-like panels where appropriate, but never sacrifice readability.
* Prefer crisp borders, subtle glows, layered panels, scanline/light-sweep accents, angular dividers, and HUD-like affordances over generic web cards.
* Avoid a one-note blue interface. Cyan/blue can be the identity, but use neutral darks, whites, muted grays, danger/warning/success colors, and restrained secondary accents to preserve hierarchy.
* Avoid decorative gradient orbs, bokeh blobs, generic SaaS gradients, beige fantasy parchment, brown tavern UI, and oversized marketing hero layouts.
* Use game-HUD styling intentionally:

  * compact stat blocks
  * readable labels
  * strong numeric emphasis
  * clear action affordances
  * consistent status chips
  * restrained animation
* Animation should support feedback, not distract from play. Use quick transitions, pulses, glints, connection indicators, cooldown/pending states, and confirmation motion sparingly.

### Layout priorities

* Build the actual usable sheet/dashboard as the primary viewport.
* Use dense but organized information architecture. Character sheets are reference-heavy and should support scanning, comparison, and repeated action.
* Favor a persistent shell:

  * top/status bar for session, role, connection, selected character, and Roll20 bridge state
  * main sheet/action area
  * optional side panels for character list, DM tools, details, or logs/previews
* On desktop, use multi-column layouts where they improve scanning:

  * character identity/resources
  * core stats/facts
  * actions/checks
  * notes/status/effects
* On mobile, collapse into clear tabs or stacked sections. The player must still be able to perform a common action quickly without hunting through the page.
* Use tabs for major sheet views, such as Overview, Actions, Facts, Resources, Notes, and DM/Admin where applicable.
* Do not put UI cards inside other cards. Use panels, sections, bands, tables, lists, and grouped controls instead.
* Use cards only for repeated, individually actionable items such as action entries, characters, conditions, or saved templates.
* Keep fixed-format UI stable. Stat tiles, action buttons, resource counters, tab bars, and toolbars must not resize or shift when loading, hovering, changing values, or showing errors.
* Text must fit within controls and panels across desktop and mobile. Do not use viewport-width-based font scaling. Letter spacing should be normal unless a specific small HUD label treatment requires subtle positive tracking.

### Component guidance

Use familiar controls and symbols where they fit the task:

* Icon buttons for common tools such as edit, save, delete, duplicate, refresh, reconnect, import, export, settings, close, expand, collapse, search, filter, and roll/send.
* Lucide icons or the existing project icon library when available.
* Tooltips for icon-only buttons, especially DM/admin controls.
* Segmented controls for modes, roles, sheet modes, or view toggles.
* Tabs for sheet sections and major views.
* Switches/toggles for binary settings.
* Checkboxes for multi-select lists or explicit boolean form values.
* Inputs, steppers, or sliders for numeric values depending on precision.
* Menus or comboboxes for option sets.
* Swatches for color or visual identity choices.
* Badges/chips for status, conditions, permissions, tags, and connection state.
* Tables or compact lists for DM/admin data management where comparison matters.
* Modals or drawers for focused edits, confirmations, import/export, and destructive actions.

Avoid replacing familiar symbols with text-heavy buttons. For example, use clear icons for edit/save/delete/reconnect where possible, with accessible labels and tooltips.

### Character sheet UX expectations

A complete character sheet interface should support, as applicable:

* Character selection and identity display.
* Current role/session/auth status.
* Clear connected, reconnecting, disconnected, stale, and resync states.
* Core stats/facts displayed in compact, scannable groups.
* Resources that show current/max values, temporary states, and pending changes clearly.
* Authored actions/checks shown as usable controls, not just raw data.
* Action details available on demand without overwhelming the default view.
* Immediate feedback when an action is submitted.
* Roll20 bridge delivery status when chat output is expected.
* Empty states that are useful but concise.
* Error states that explain what happened and what the user can do next.
* DM/admin authoring views that make it clear when changes affect backend-authoritative game data.

### DM/admin UX expectations

DM/admin views may include more powerful and denser controls, but they must remain safe and understandable.

* Clearly separate player-safe views from DM-only authoring/admin surfaces.
* Use confirmations for destructive operations such as deleting content, importing/replacing state, or removing characters.
* Treat import/export as serious state operations. Use clear labels, validation feedback, and success/failure states.
* DM authoring forms should preserve drafts locally until submitted.
* Validate forms client-side for usability, but rely on backend validation as authoritative.
* Show backend validation errors near the relevant field or action.
* Do not expose low-level state patch/mutation details unless building a deliberate developer/debug surface.

### Roll20 bridge UX expectations

* Surface whether the Roll20 bridge is connected, disconnected, or failing.
* If a chat/action send fails because the bridge is unavailable, show a clear fail-fast error. Do not imply the message has been queued.
* Do not create a second authoritative roll log in the app.
* The UI may show the latest local submission result, delivery status, or temporary toast feedback, but persistent play history belongs in Roll20 unless a future backend feature explicitly changes that contract.

### Accessibility and readability

* Maintain high contrast for all text, numbers, buttons, and status indicators.
* Do not rely on color alone for meaning. Pair colors with icons, labels, shape, or text.
* Every interactive element must have an accessible name.
* Icon-only controls need accessible labels and hover/focus tooltips where helpful.
* Ensure keyboard navigation works for forms, tabs, dialogs, menus, and action buttons.
* Focus states must be visible and consistent with the HUD/game-interface style.
* Keep touch targets usable on mobile.
* Avoid tiny decorative text for important rules, numbers, errors, or action labels.

### Visual hierarchy

* Important gameplay numbers should be easy to find at a glance.
* Use size, weight, panel placement, and contrast to distinguish:

  * character identity
  * current resources
  * primary actions
  * passive facts/status
  * DM/admin-only controls
  * connection/sync warnings
* Reserve large display text for major screen titles or character identity. Use tighter headings inside panels, cards, sidebars, and dashboards.
* Keep labels short and consistent. Prefer “Disconnected”, “DM Only”, “Pending”, “Sent to Roll20”, “Resync Required”, and similar direct terms.

### Implementation expectations

* Follow the existing frontend stack and conventions in the repo.
* If the project already has a component, hook, store, generated type, route helper, or styling convention, extend it rather than creating a parallel pattern.
* Use generated protocol types for transport-facing code.
* Centralize websocket request helpers rather than scattering raw send calls through components.
* Keep presentational components separate from backend transport details where practical.
* Components should accept typed props and render stable UI states.
* Avoid building placeholder-only views. Implement feature-complete controls, states, and views that a player or DM would expect for the feature being touched.
* Do not add explanatory in-app copy describing how the UI was designed, what style it uses, or what keyboard shortcuts exist unless that text is part of a real help/settings surface.
* Do not add a landing page unless specifically requested.
* Do not add Three.js, generated hero art, decorative SVG scenes, or large illustrative assets unless the feature genuinely needs them. This project’s primary frontend value is the character sheet and table workflow, not a spectacle page.

### Testing and verification

Before considering frontend work complete:

* Run the project’s relevant frontend checks, build, lint, or tests where available.
* Start the local dev server when the app requires one and verify the UI in browser.
* Check desktop and mobile viewport behavior.
* Verify text does not overflow or overlap.
* Verify loading, empty, error, disconnected, unauthorized, and success states.
* Verify that player and DM roles see appropriate controls.
* Verify that websocket-backed UI reconciles to backend snapshots/patches instead of relying on local invented truth.
* Verify that Roll20 bridge failure states are represented accurately when chat delivery is unavailable.
* Check that the final screen looks like a polished game character-sheet interface, not a generic SaaS dashboard or marketing site.

