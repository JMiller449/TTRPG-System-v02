# System Goals Questionnaire

> Consolidation note: Active planning has moved to [PLAN.md](/home/devinphillips20/Desktop/Projects/TTRPG-System-v02/plan/active/PLAN.md). This file is retained as source/history.

Use this as an answer sheet for tightening the project scope. Short answers are fine. If a question is not decided yet, mark it `TBD`.

## 1. Product Definition

1. Is the core product best described as a backend-authoritative variable store and roll executor for the Chip TTRPG system?
Yes, we would have used roll 20's sheet if it was flexible enough to accomidate the system we are currently trying to run which is similar to dnd but deviates in some ways, here is some examples:
proficiency(every time the user uses something they slowly get better at it)
more scalable(we want to reach very high levels), this has alot of side effects(roll formulas, custom equipment, custom stats)

2. Should Roll20 remain the table surface/play log, while this app owns state, variables, formulas, and roll resolution?
yes this app should be a state store for both the player's base sheet and it's instanced variants that players can keep track of health and mana(as overides) while allowing the spells to apply conditions and other things. Notably we don't want to take over the following(at least for v1):
- turn counting
- intersheet interactions
- spell generating and skill check needed(this is dm descration and just letting him fill in what he want's action's subactions should happen)
Which leaves us as a state store which has macros which generates numbers and allows to edit thier own sheets

3. Is this project intended to replace any part of Roll20 beyond roll/chat automation?
It's supposed to replace only the sheet for the time being, there may be a future where we take over combat, turns and other things. However I see we could continue to expand even to the point of taking over VTT and documents but that would be really late game into the project

4. What is the one-sentence MVP goal?
character builder with sheet instancer with abilities which are comprised of many sub actions(macros over variable and likely based on variables) which keeps track of the users temporary state(conditions,mana, etc...) and increment's thier proficiency with use of abilities (which can see as another side affect of an ability) with some description and flavor text.

5. What should a player be able to do in the first usable version?
- work over an instanced sheet use the abilities(macros), overide the health and mana directly or through thier resistance calculators and view a subset of the sheet which will be helpful to be rolled off but hiding some DM only logic

6. What should a GM be able to do in the first usable version?
- CRUD characters, items, conditions, formulas, macros 
- Instance sheets for enemies and players alike to keep track of fights and character growth
- have some modulation and reusability for common things across sheets and other things to reduce the tediousness
## 2. Non-Goals

1. Should the MVP avoid full VTT features such as maps, tokens, initiative boards, and encounter automation?
none of that
2. Should the MVP avoid full combat automation?
only automation is what comes from macros(abilities/equipment can edit the users stats temporarily(conditions) and permananty for both sheet(mostly proficiency) and instance(remove health and mana until replenishment))
also doing the calculations based on the damage and type would be nice to keep track with what resistances the player should be getting used to and to do the calculations for the user
3. Should the MVP avoid building a second authoritative roll history inside the app?
no need for internal roll history we just need the state and utilize the chat if included in the macros

4. Should the MVP avoid syncing data back into Roll20 character sheets?
Not at all, we are not that married to roll 20, after having to set up firefox made me rethink our choice with paying for it since thier api is a javascript script which only works over thier chat and sheet

5. Should the MVP avoid Roll20 token targeting or selected-token reads?
only thing it will use from roll 20 is it's chat
6. Are there any features that should be explicitly out of scope even if they sound useful?(mostly things that I don't want in V1 as we already have alot of complexity)
- turn counting
- trying to integrate/lock into in roll 20 when it's not api freindly
- intersheet interactions
- own roll system or chat history (we should handle unwrapping the variables but provide the math back in it's base form back to roll 20)

## 3. Roll20 Integration Boundary

1. For MVP, is Roll20 integration output-only chat delivery?
yes the only roll20 integration will be a chat output macro which routes through our firefox extension to keep it simple and if we pivot off of roll 20 we can change it with ease

2. Should the backend send final resolved roll results to Roll20, or should it send Roll20 dice expressions for Roll20 to resolve?
it should just be a chat output which utilizes formulas to provide variables such that they can build it as:
action: send chat
message(formula): '/r [player.strength]+[player.current.health]'

3. Should Roll20 ever be allowed to mutate backend state?
nope

4. Should the Firefox extension remain the integration path for now?
yes there is not a better way due to thier 'api' being just a javascript script which can't reach outside thier network

5. Is browser-extension-based Roll20 access a temporary bridge or the long-term approach?
long term for roll 20

6. What should happen when the Roll20 bridge is disconnected?
requests fail with error noting bridge is not active toast

7. Should the frontend show Roll20 bridge connection status?
sure if it's not a pain

8. Should the backend queue Roll20 messages while disconnected, or fail immediately?
fail immediatly for if the user is spamming a roll it does not see, it does buffer

9. Should Roll20 chat output support whispers/GM-only messages?
this would be quirky given it

10. Should Roll20 output use plain text, `/roll`, `/w gm`, templates, or HTML/direct messages?
plain text, full DM discression and to not tie to variables that might change one day, the convience I could see would be is having the subactions duplicatable

## 4. Canonical Variable Model

1. Should variables be a first-class backend concept?
variables exist through formulas which refrences state and provides shortcuted paths based on who casted it and from what instanced sheet. I think it treat formulas as  first class and allow a dropdown array to navigrate down the path which can be converted to a generic path.to.variable

2. What are the canonical variable categories?
State: the core state which allows you to navigate outside of the caster themselves
Base Sheet: the permanant variables of the entity to cast
Instanced Sheet: the temporary variables of the entity to case

3. Should variables use stable paths such as `sheet.stats.core.strength`?
yes but a dynamic drop down would probably better for UX
for example the dynamic dropdown above the stable paths:
first choose from the dropdown |core|sheet|instance|
then if they choose sheet, another  dropdown apears that shows thins in that sheet like stats as the next dropdown
and so on and so forth until they reach a primative value.
See "Questions For User" for whether common variable paths should become first-class shortcuts.

4. Should variable paths be visible to the GM for formula authoring?
preferable dropdown guidance

5. Should players see raw variable paths, friendly labels only, or both?
labels

6. What variable types are needed?
   - Number
   - Percent
   - Boolean
   - Text
   - Enum
   - Resource current/max
   - Formula result
   - Other

7. Which variables are manually editable?
for players only instanced health and mana
8. Which variables are derived/computed?
instanced values after temproary and permanant changes are applied
9. Which variables are temporary or encounter-scoped?
health mana
10. Which variables are character/template-scoped?
Core stats, sub stats, defensive stats/resistances, proficiencies, equipment, items, spells/skills/actions, max resource formulas, and permanent stat changes.
11. Should variables support GM-only visibility?
Yes, at least for hidden action/formula logic and anything the player sheet should not expose.
12. Should variables support player-editable flags?
Yes, because players should only directly edit the small allowed set such as instance current HP/mana.
13. Should variables support notes/descriptions?
Yes, useful for GM-authored equipment, items, actions, conditions, and formulas.
14. Should variables support min/max constraints?
Yes. Proficiency is 0-100%, resistance caps at 100%, and resources need current/max bounds.
15. Should variables support units such as feet, percent, HP, mana, or actions?
Yes. The rules use feet, percent resistance/proficiency, HP, mana, action points, and damage values.

## 5. Sheets And Ownership

1. Should there be one sheet model for both player characters and enemies?
Yes, this matches the repo architecture policy. Player characters and enemies differ by metadata/access, not by separate model families.
2. Should sheets have `template` and `instance` modes?
Yes. Templates hold reusable/base data; instances hold session/current overrides.
3. Are player characters templates, instances, or both?
Both. A player has a base/template sheet and can work from an instanced sheet for current HP/mana/conditions.
4. Should enemies be spawned from reusable templates?
Yes, per the template/instance model.
5. Should current HP/mana/actions live only on instances?
Yes for MVP current-state tracking. Base/max values and formulas belong on the base/template or computed state.
6. Should base stats live on templates, instances, or both?
Templates/base sheets are authoritative for base stats; instances can carry computed/temporary overlays.
7. Should players be assigned explicit sheet access?
Yes.
8. Can one player control multiple sheets?
Yes if explicitly assigned, but this is not required for the first MVP demo.
9. Can multiple players view/control the same sheet?
See "Questions For User".
10. Should GM be able to roll from any sheet?
Yes.

## 6. Permissions

1. Can players edit base core stats?no
2. Can players edit sub stats?no
3. Can players edit current HP?yes via direct or damage applier or actions
4. Can players edit max HP?no
5. Can players edit current mana?yes via direct or actions
6. Can players edit max mana?no
7. Can players edit proficiency values?only though actions
8. Can players add or edit actions?no
9. Can players add or edit items/equipment?no
10. Can players edit notes?no
11. Can players trigger attacks/damage against other sheets?no intersheet interactions
12. Can players apply damage or healing directly?only if it's to thierself for now
13. Are all stat/resource mutations GM-only unless triggered by a backend-approved action? yes via directly or condition via actions
14. Should service/Roll20 bridge sessions be output-only? Yes. The Roll20 bridge should deliver chat output only and must not mutate backend game state.
15. Should failed permission attempts return explicit errors to the client?yes but frontend should just hide things they shoulnt be able to doe theoretically

## 7. Formulas

1. Should formulas be authored by GM only? yes
2. Should formulas reference variables by stable paths? yes via stable and relative paths
3. Should formulas allow only arithmetic, dice, and approved functions?
See "Questions For User".
4. Should formulas support conditionals? No for MVP.
5. Should formulas support references to target sheets? if you mean target as in the caster, yes, as in enemy, no
6. Should formulas support references to equipped item values? No for MVP; formulas can reference derived stats caused by items if needed.
7. Should formulas support references to action parameters?
See "Questions For User".
8. Should formula evaluation be explainable step-by-step in output?
Yes for GM/debug output and for user trust when a macro resolves variables.
9. Should formulas be reusable named records, inline action fields, or both?
Both: reusable named formulas for common mechanics, inline action fields for one-off macro output/steps.
10. Should formulas be versioned so old actions remain stable?
Yes eventually, before serious data entry. For MVP, stable IDs plus cautious editing is enough.
11. What should happen if a formula references a missing variable?
Reject the action/formula evaluation with an explicit error. Do not silently treat it as zero.
12. Should formulas be allowed to mutate state, or only actions can mutate state?
Only actions/subactions should mutate state. Formulas should produce values used by those steps.

## 8. Dice And Roll Resolution

1. Should all dice be rolled by the backend?
For backend-authoritative mutations, yes. For Roll20-only chat output, Roll20 can resolve `/r` expressions when the action is just emitting chat.
2. Should the backend store roll inputs/results for audit even if Roll20 chat is the play log?
No player-facing roll log for MVP. Keep only enough metadata/errors for debugging authoritative mutations.
3. Should roll results be reproducible after the fact from stored metadata?
Not required for MVP if Roll20 is the play log.
4. Is a d100 roll always an integer 1-100?
Yes, the rules consistently use `d100`, with `1` and `100` called out as critical endpoints.
5. How should critical 1 and 100 be represented?
For physical attacks: `1` is a critical failure with GM-determined effect, usually no damage; `100` is a critical success and doubles total damage.
6. Does critical behavior apply to skill checks, attacks, damage rolls, or all roll types?
See "Questions For User". The markdown explicitly defines critical rolls under physical weapon attacks only.
7. How should advantage work mechanically?
Roll two of the same check and take the higher value.
8. How should disadvantage work mechanically?
Roll two of the same check and take the lower value.
9. Do super advantage or super disadvantage exist?
See "Questions For User".
10. Should hidden GM rolls be supported?
See "Questions For User".
11. Should players be able to make custom dice-only rolls?
See "Questions For User".
12. Should dice-only rolls affect backend state?
No.

## 9. Roll Request Types

1. What roll types are required for MVP?
   - Basic stat check
   - Skill check
   - Attack
   - Damage
   - Dodge
   - Block
   - Parry
   - Grapple
   - Spell cast
   - Custom formula
   - Dice-only
roll types should be just generic where I suppose we would add some generics to all sheets but they should all be subactions on actions and not thier own types or db entries

2. Should `attack`, `dodge`, `block`, and `parry` be quick-roll buttons that prefill a composer or immediately submit?
See "Questions For User": whether these are first-class locked defaults, ordinary searchable actions, or composer shortcuts.

3. Should roll requests always include `sheet_id` explicitly?
yes this ensables the relativity of sheet; instance id should likely be included too.

4. Should roll requests optionally include `target_sheet_id`?
there should be no targets for now

5. Should roll requests support DC values?
see 1

6. Should roll requests support advantage/disadvantage?
See "Questions For User".
7. Should roll requests support visibility: public, GM-only, private player?
See "Questions For User".

8. Should roll requests support freeform situational modifiers?
No for MVP. If a modifier is common, make it another macro/action; one-off visible adjustments can be handled manually in chat.

9. Who is allowed to add situational modifiers?
actions made by gms proced by players
directly applyable by gms for if thier npc applies things like blindness
might make sense in the future to allow them to apply common conditions
the player would need to be able to remove them because we are not automating round counting

10. Should each roll request produce a structured backend event in addition to Roll20 chat output?
each roll  is a subaction of a macro which is abilities/actions


## 10. Actions

1. Should an action be a named backend-authored operation that can read variables, roll dice, mutate state, and emit Roll20 output?
yes
2. Should actions be GM-authored only?
yes
3. Should players be able to execute assigned actions?
yes
4. Should actions be attached to sheets through explicit bridges?
yes
5. Should actions support target selection?
No for MVP.
6. Should actions support parameters entered at runtime?
See "Questions For User".
7. Should actions support resource costs?
a subaction would mutate the instancedes current mana and health as a subaction if needed, if that's what you mean
8. Should actions support proficiency gain on use?
it would be a subaction, just a sheet mutation on use
9. Should actions support cooldowns or once-per-turn limits?
we are not using a turn system yet in the sheet, keeping it stateless of combate rounds and such
10. Should actions support multiple ordered steps?
yes sub actions
11. Which action step types are needed for MVP?
   - Send Roll20 message :already is
   - Set variable :already kinda is
   - Increment/decrement variable : already kinda as in
   - Roll dice : same as send roll 20 message but I guess we could make it explicity so we can prompt for adv and disadv
   - Compare against DC: flat checks, probably should add a roll with conditional but we can probably do that via roll 20 as well
   - Apply damage/healing: yes this is special because it needs to do damage based on type etc, should be a diffrent type of subaction
   - Spend resource: like mana and health? can do it
   - Gain proficiency: yeah it's basically a variable set / increment but is probably common enough to add a specific action
   - Apply augmentation/status: have not touched this but is very much so needed, also have not built out temp/ computed state
   - Other

## 11. Derived Stats

1. Which values should be derived automatically?
   - HP max: see "Questions For User". The doc examples show `stat * 50` style HP (`Human: 10 x 50 = 500 HP`, `Demon: 100 x 50 = 5000 HP`), but the exact governing stat/race modifier is not specified.
   - Mana max: `Arcane * Mana`.
   - Mana regeneration: base mana pool regen is 10% per hour.
   - Armor class: `Dexterity * 0.5`.
   - Action points: derived from Reaction Time thresholds.
   - Movement: derived from Dexterity thresholds.
   - Resistance totals: additive by damage type, capped at 100%.
   - Carry weight: Strength determines carry capacity, but exact formula is not provided.
   - Other: attack, damage, skill-check, block/parry/dodge, overload, and resistance calculations are rule formulas but not necessarily persisted derived stats.
2. Should derived stats be persisted or computed on demand?
See "Questions For User".
3. Should derived values be recalculated immediately when dependencies change?
Yes, if the backend owns derived/computed state. Otherwise recompute on demand from authoritative base values.
4. Should GMs be able to override derived values?yes
5. Should overrides be visible as overrides?yes
6. Should derived formulas be hardcoded by backend or authored/configurable by GM?
Core rule formulas can be backend-known, but MVP should prefer GM-authored/configurable formulas where the rules are still unstable.
7. Should the frontend show formula breakdowns for derived stats?
Yes for GM/debug views; optional for player simplified views.

## 12. Proficiency

1. Should proficiency be a first-class model separate from stats? yes as it does more than just stats because it can affect actions, stats and more
2. Which proficiency categories are required?
   - Weapon type
   - Specific weapon
   - Skill
   - Spell
   - Other
The markdown explicitly requires weapon type, specific weapon, skill, and spell proficiencies.
3. Should proficiency range from 0 to 100 percent? Yes. The document says proficiency goes from 0 to 100%, where 100% is mastery.
4. Should proficiency increments happen automatically on action use?
Yes for authored actions that represent using a weapon/spell/skill.
5. Should increments be configurable per action/weapon/spell?
Yes. The rules say each skill, spell, and weapon has a distinct increase rate, such as 1% or 0.1%.
6. Should downtime training be supported in MVP?
Not required in code for MVP. The rules support downtime training, but this can be manual/Roll20 until downtime tooling exists.
7. Should mastery at 100 percent unlock other actions/items/spells?
Yes. The rules say mastery can unlock higher-ranked spells/skills or more powerful weapons.
8. Should unlock requirements be enforced by backend?
Eventually yes for backend-authored actions/items/spells. For MVP, GM can enforce manually unless unlock gating is easy to model.
9. Can GM manually edit proficiency?
Yes, for correction/import/admin control.
10. Can players manually edit proficiency?
No. Players should gain proficiency through approved actions or GM-managed downtime/training.

## 13. Equipment And Items

1. Is MVP equipment an inventory list only, with no slot-based model?
No. The rules distinguish equipped weapons, armor, shields, and accessories; attack and block rules depend on equipped gear.
2. Should equipped/active weapon selection exist for attack rolls?
Yes. Weapon attacks use a weapon, and weapon skills can only be used when the weapon is equipped.
3. Should weapons define damage, governing stat, reach, damage type, and proficiency reference?
Yes. The rules require weapon damage modifiers, governing attack stat, reach, physical damage type, and weapon-type/specific-weapon proficiency.
4. Should armor define resistance only, not AC?
Mostly yes. Armor adds resistance and does not increase AC; heavy armor applies disadvantage on AC, which still needs exact handling.
5. Should shields grant block advantage?
Yes. Equipping a shield gives advantage on blocking actions. Shields do not affect resistance or AC unless the shield specifies it.
6. Should items provide augmentations/effects through the general augmentation system?
Yes. Items/accessories/consumables can give stats, skills, resistance, temporary stats, permanent stats, abilities, or special GM-defined properties.
7. Should consumables be actions, items, or both?
Both. They are items, and using one in battle costs an action point.
8. Should items support GM-only notes?
Yes, because the rules allow GM-specified special item properties.
9. Should items support World Anvil links?
See "Questions For User".
10. Should players be able to use consumables without GM approval?
Yes if the consumable is on their sheet and the use is represented by an approved action/subaction.

## 14. Augmentations, Statuses, And Effects

1. Should all temporary/permanent buffs/debuffs use one general augmentation system?
Yes, this fits the rules better than one-off fields: accessories, consumables, conditions, skills, armor, shields, items, and spells can all modify stats/resistance/abilities.
2. Should item bonuses, poison, ally buffs, statuses, and conditional effects share the same model?
Yes where practical. Their shared job is to add temporary/permanent changes to variables or capabilities.
3. Should augmentations have stable IDs?
Yes.
4. Should augmentations include source metadata?
Yes: source item/action/spell/condition, caster/owner, and whether it is base-sheet or instance-scoped.
5. Should augmentations be reversible?
Yes for temporary buffs/debuffs and conditions.
6. Should augmentations support duration/expiry?
Yes eventually, but MVP can leave expiry manual because turn counting is out of scope.
7. Should augmentations support stacking rules?
Yes, at least additive resistance with a 100% cap. See "Questions For User" for other stacking rules.
8. Should augmentations support conditional logic?
Not for MVP.
9. Should augmentations target validated variable paths only?
Yes.
10. Who can apply augmentations?
GM directly; players only through backend-approved actions that target their allowed sheet/instance.
11. Who can remove augmentations?
GM directly; players may remove/adjust their own manually tracked temporary conditions when the campaign workflow requires it, since round counting is not automated.

## 15. Combat Scope

1. Is combat automation in MVP, later, or out of scope?
Later. The rules define combat, but MVP should avoid full combat automation and only support action/macro-driven state changes plus manual/Roll20 handling.
2. Should the app track encounters?
Not for MVP beyond instanced sheets.
3. Should the app track initiative/turn order?
Not for MVP. The rule is dexterity check `(d100 / 100) * Dexterity`, then fixed turn order unless GM changes it, but this can be manual/Roll20.
4. Should the app track current action points per turn?
Not automatically for MVP. Action points are rule-derived, but turn tracking is out of scope.
5. Should action points reset automatically?
No for MVP. Rules say action points reset at the start of your turn and do not carry over, but the app is not tracking turns yet.
6. Should reactions be tracked automatically?
No for MVP. Rules say Dodge/Block/Parry are reactions and reaction count equals actions available per round, but this is combat automation.
7. Should contested reactions be fully resolved by backend?
Later/manual. The rules define formulas, but automatic target/reaction resolution requires intersheet interactions.
8. Should the app apply damage automatically after attacks?
Only for explicit self/instance damage-healing calculator actions in MVP. Full attack-to-target damage application is later.
9. Should GM confirmation be required before applying attack results?
Yes if/when intersheet attack automation is added.
10. Should the app support opportunity attacks, flanking, grappling, and AOE in MVP?
No. These rules can be demonstrated/manual in Roll20 until map/target/turn automation exists.

## 16. Roll20 Output Format

1. What should a basic stat check message look like?
Plain text or Roll20 `/r` expression showing sheet/action name and the formula, e.g. `/r (1d100 / 100) * @{governing_stat}` once variables are unwrapped.
2. What should an attack message look like?
Plain text or `/r` output for `Proficiency * (1d100 / 100) * Attack Stat`, plus weapon/action name. Full target resolution can be manual for MVP.
3. What should a damage message look like?
Plain text or `/r` output for `Weapon Damage + Proficiency * (1d100 / 100) * Governing Stat`; if applying resistance, include `Damage Taken = Damage Inflicted - (Damage Inflicted * Resistance)`.
4. What should a hidden GM roll message look like?
See "Questions For User".
5. Should output include:
   - Character/sheet name
   - Action name
   - Dice rolled
   - Variables used
   - Formula
   - Final result
   - DC/target
   - Success/failure
   - State mutations applied
For MVP, include sheet name, action name, variables/formula, and the Roll20 dice expression or resolved result. DC/target/success/failure/state mutation details are optional per action and may remain manual.
6. Should output be compact by default or verbose by default?
Compact by default, with enough formula detail that the GM/player can see what happened.
7. Should GM be able to choose compact/verbose output per roll?
Later; useful, but not required for MVP.
8. Should Roll20 output include clickable command buttons later?
See "Questions For User". Not required while Roll20 integration is output-only chat.

## 17. State Sync And Persistence

1. Should `state_dumpy.json` remain the local persistence mechanism for now?
Yes, for local development/MVP.
2. Is multi-campaign support required?
No for MVP.
3. Is multi-user/networked play required beyond local WebSocket clients?
No for MVP beyond authenticated local app clients.
4. Should the app support export/import JSON?
Eventually yes, but not required before the core sheet/action workflow works.
5. Should state schema versions be added?
Yes before serious data entry.
6. Should migrations be required before serious data entry?
Yes, once schemas stabilize enough that data will be kept long term.
7. Should every authoritative mutation increment `state_version`?
Yes.
8. Should clients always resync on version gaps?
Yes.
9. Should duplicate intent/idempotency handling be required for MVP?
See "Questions For User".

## 18. Audit And Trust

1. Should roll details be stored anywhere besides Roll20 chat?
No player-facing roll history for MVP. Roll20 remains the play log.
2. If stored, should that be a debug/audit log rather than a player-facing roll log?
Yes.
3. Should every mutation include source request/action metadata?
Yes eventually, especially for debugging state changes and proficiency/resource mutations.
4. Should the frontend show pending/rejected intent feedback?
Yes.
5. Should rejected rolls/mutations be visible to GM?
Yes for GM/admin debugging where practical.
6. Should players see why an action was rejected?
Yes, with user-safe error text.
7. Should formula errors be user-facing or GM-only?
GM-facing in detail; players should get a concise failure message unless they are allowed to author/debug that formula.

## 19. Frontend Scope

1. Is frontend responsible only for rendering state and submitting intents?
Yes.
2. Should frontend avoid final gameplay math completely?
Yes. Backend-authoritative calculations only; Roll20 may resolve chat-only dice expressions.
3. Should frontend previews be allowed if clearly marked as non-authoritative?
Yes.
4. Should active sheet selection remain frontend-local?
Yes.
5. Should the frontend include a roll composer?
Yes, as an action/macro executor/composer rather than a separate roll system.
6. Should the frontend include GM authoring screens for variables/formulas/actions?
Yes for MVP, because GM CRUD for characters/items/conditions/formulas/macros is core to the product.
7. Should the frontend include a player-only simplified sheet?
Yes.
8. Should the frontend include bridge status and send-failure UI?
Yes if reasonable; bridge-disconnected sends should fail immediately with a clear error/toast.
9. Should the frontend include mobile support in MVP?
See "Questions For User".

## 20. Backend Contract And API

1. Should all public operations be typed WebSocket routes?
Yes.
2. Should raw path mutation remain internal only?
Yes.
3. Should frontend request helpers be generated from backend route contracts?
Yes.
4. Should every request declare role requirements in the backend registry?
Yes.
5. Should every request declare emitted event types for code generation?
Yes.
6. Should admin operations be semantic commands instead of generic CRUD where relationships are involved?
Yes, especially for attaching actions, spawning instances, applying mutations, and permission-sensitive updates.
7. Which backend routes are required for MVP?
   - Authenticate
   - Resync state
   - Create/update sheet
   - Update variable
   - Create/update formula
   - Create/update action
   - Attach action to sheet
   - Execute action
   - Submit roll
   - Send Roll20 chat
   - Other
Required MVP set: authenticate, resync state, create/update sheet, update variable/current resource, create/update formula, create/update action, attach action to sheet, execute action, send Roll20 chat. A separate submit-roll route is optional if rolls are action substeps.

## 21. MVP Acceptance Criteria

1. What exact demo should prove the MVP works?
A GM creates/edits a sheet, creates a formula-backed action with ordered substeps, attaches it to a sheet, a player executes it from an instance, state patches sync to clients, and Roll20 receives the chat output through the bridge.
2. Should the demo include creating a sheet from scratch?
Yes.
3. Should the demo include editing a stat and seeing clients sync?
Yes.
4. Should the demo include a backend-resolved skill check sent to Roll20?
Yes if using backend-resolved actions; otherwise send a Roll20 `/r` expression with variables unwrapped and make clear Roll20 resolved the dice.
5. Should the demo include an attack roll using weapon/proficiency variables?
Nice to have, but not required if equipment/weapon support is still in progress.
6. Should the demo include a failed Roll20 bridge case?
Yes.
7. Should the demo include permission rejection for a player attempting a GM-only edit?
Yes.
8. Should the demo include export/import or persistence across restart?
Persistence across restart via `state_dumpy.json` yes; export/import can be later.
9. What tests must pass before calling the MVP done?
Backend websocket contract tests for auth, permission rejection, state snapshot/patch sync, formula/action execution, variable mutation, Roll20 bridge failure, and generated protocol consistency.

## 22. Rule Ambiguities To Resolve

1. What are the exact formulas for attack rolls?
Physical to-hit: `Proficiency * (1d100 / 100) * Attack Stat`. Magical to-hit: `Proficiency * (d100 / 100) * Arcane`.
2. What are the exact formulas for defensive rolls?
No reaction: attack to-hit rolls against `AC = Dexterity * 0.5`. Block defender roll: `Strength * (1d100 / 100)`. Dodge defender roll: `Dexterity * (1d100 / 100)`. Parry defender roll is listed as `Proficiency * (1d100 / 100) * Dexterity`, with note that parry may use equipped weapon proficiency or Parry Skill proficiency.
3. How exactly does proficiency modify attack, damage, and skill checks?
Physical attack to-hit and damage multiply by proficiency. Magical to-hit and damage multiply by proficiency. Skill checks are listed as `(d100 / 100) * Governing Stat`; the markdown does not say skill proficiency modifies generic skill checks.
4. How should resistance stack and cap?
Resistance is additive and caps at 100%. At 100%, the character is immune to that damage type.
5. How should critical failures/successes apply outside attacks?
See "Questions For User". The markdown only defines critical rolls under physical weapon attacks.
6. How should armor disadvantage on AC work if armor does not increase AC?
See "Questions For User". The markdown says light/medium armor have no AC effect, heavy armor has disadvantage on AC, and AC is `Dexterity * 0.5`; it does not define how to apply disadvantage to a fixed AC value.
7. How should shields affect block rolls?
Equipping a shield gives advantage on block actions. Shields otherwise do not affect resistance or AC unless the shield specifies it.
8. How should melee dodge disadvantage be detected without a map/token system?
Manual/GM decision for MVP. The rule exists, but detection requires map/token/targeting context the app is not taking over yet.
9. How should AOE dodge be handled without Roll20 token positions?
Manual/GM decision for MVP. Rules say a successful dodge out of radius takes 0 damage; a successful dodge while still in radius takes half damage.
10. What exact damage types are canonical?
Physical: Piercing, Slashing, Bludgeoning. Magical: Fire, Water, Earth, Wind, Light, Dark, Lightning, Ice, Time, Gravity, Psychic.
11. What exact spell ranks are canonical?
F, F+, E, E+, D, D+, C, C+, B, B+, A, A+, S, S+, SS, SS+.
12. What exact overload DC formula is canonical?
See "Questions For User". The markdown gives a reference DC table by assumed max Control/rank/tier and says each overload tier requires a separate Control-based DC check, but it does not provide a clean formula.

## 23. Priority Ranking

Rank these in order of importance for the next implementation phase:

1. Variable registry
2. Backend roll submission route
3. Roll20 output formatting
4. Player sheet view
5. GM sheet/formula/action authoring
6. Permission hardening
7. Derived stat recalculation
8. Proficiency tracking
9. Equipment/weapon attack support
10. Augmentation system
11. Combat/turn tracking
12. Export/import

## 24. Open Notes

Add anything else that should constrain the system goals:

- Several rules are explicit enough to store as formulas, but not all should become MVP automation. Combat turn order, targeting, intersheet attack resolution, AOE position checks, opportunity attacks, flanking, grapple handling, and overload failure effects can stay manual/Roll20 until the app intentionally takes over combat.

## 25. Questions For User

These are the remaining open questions that were not answered clearly by `temp/Chip TTRPG System.md` or the current project scope notes.

### Product And Permissions

1. Can multiple players view/control the same sheet?
Answer: DM and a Single player will be handling a sheet, not multiple

2. Should common variable paths become first-class shortcuts in addition to generic path navigation?
Answer: yes

3. Should the frontend include mobile support in MVP?
Answer: no

4. Should item records support World Anvil links?
Answer: yes

### Formulas And Actions

1. What exact operations should formulas allow beyond arithmetic, dice, and variable references?
Answer: For now, formulas should support `min(value, max_hp)`, `max(0, damage)`, `floor()`, `ceil()`, and `round()`. Roll20 can handle `floor()`, `ceil()`, and `round()` in chat formulas, and may be able to express some min/max-style dice cases with keep-high/keep-low syntax such as `kh1`/`kl1`. Backend formulas should still own `min()`/`max()` for authoritative state changes, resource caps, HP not below 0, mana not above max, and other non-chat validation.

2. Should formulas support references to runtime action parameters?
Answer: just advantage/disadvantage

3. Should attack/dodge/block/parry be first-class locked defaults, ordinary searchable actions, or composer shortcuts?
Answer: They should be apart of a preset for a sheet but should be treated like any other action, incase the specific person  can no longer use that or they get a diffrent variant and edit replace etc

4. Should action execution support runtime parameters such as advantage/disadvantage?
Answer: yes

5. Should derived stats be persisted, computed on demand, or both?
Answer: Both. Base values and explicit overrides should be persisted. Derived values should be computed by the backend from authoritative formulas, then may be cached/persisted as part of the sheet/instance snapshot for display and sync. Cached derived values are not editable directly and must be recalculated whenever dependencies change. GM overrides should be stored separately and clearly marked as overrides.

6. Should duplicate intent/idempotency handling be required for MVP?
Answer: Not required for MVP. If an action is accidentally applied twice, the DM can manually correct the affected values by increasing/decreasing resources, stats, or proficiency. A DM-only undo button would be useful later.

### Rolls And Roll20 Output

1. Should roll requests support advantage/disadvantage as a first-class runtime option, or should that stay inside Roll20/output formulas?
Answer: we could do some light wrapping of the roll20 endpoint for prefixing

2. Should roll requests support visibility modes such as public, GM-only, and private player?
Answer: we could do some light wrapping of the roll20 endpoint for prefixing

3. Should hidden GM rolls be supported in MVP?
Answer: we could do some light wrapping of the roll20 endpoint for prefixing

4. If hidden GM rolls are supported, what should the Roll20 message format be?
Answer: we could do some light wrapping of the roll20 endpoint for prefixing

5. Should players be able to make custom dice-only rolls from this app?
Answer: no, if they are doing one offs, they can do it via roll 20, unless later needed

6. Do super advantage or super disadvantage exist?
Answer: no

7. Should Roll20 output include clickable command buttons later?
Answer: no

### Rules Decisions

1. What is the exact HP max formula, including governing stat and race modifier behavior?
Answer: this should dm decided, is this not noted in the ttrpg system

2. How should critical failures/successes apply outside physical weapon attacks?
Answer:TBD

3. How should heavy armor disadvantage on AC work if armor does not increase AC and AC is `Dexterity * 0.5`?
Answer: unsure what this means

4. What is the exact overload DC formula?
Answer: we are not doing this yet

5. What stacking rules are needed beyond additive resistance capped at 100%?
Answer:TBD
