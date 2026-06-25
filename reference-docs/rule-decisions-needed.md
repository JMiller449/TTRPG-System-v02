# Rule Decisions Needed

This document collects rule questions the app needs answered before deeper automation. It is written for a DM or common rules author to fill in directly.

Source authority order:

1. `reference-docs/Chip TTRPG System_2-20-26.pdf`
2. DM/common rules author decisions recorded here
3. `plan/active/PLAN.md`

If a rule is not explicit, the app should not invent behavior. Record the decision here first, then implement it.

Format:

```md
Q: Question that needs a ruling.
PA: Expected answer shape.
A:
```

`PA` means the expected answer format or kind of ruling needed.

## Current App Boundary

The app is backend-authoritative for sheet state, action execution, resources, conditions, item/augmentation records, proficiency progress, and damage mutations.

Roll20 remains authoritative/manual for maps, positioning, token movement, full combat flow, contested cross-sheet combat, and dice/macros that are intentionally emitted as Roll20 chat commands.

The app currently avoids intersheet action execution. Cross-sheet combat effects are manual/Roll20 unless a future rule decision explicitly changes that.

## High-Priority Decisions

These decisions affect near-term feature work.

### Advantage And Disadvantage

Current understanding:

- Advantage means roll two of the same check and take the higher.
- Disadvantage means roll two of the same check and take the lower.
- No super advantage or super disadvantage for MVP.
- Runtime parameters are allowed for predefined GM-configured options, currently advantage/disadvantage.

```md
Q: Should advantage/disadvantage apply only to d100 checks, or also to damage rolls?
PA: Scope list, such as checks only, checks and attacks, damage too, or specific exceptions.
A: Advantage/disadvantage applies to hit/check rolls, not damage rolls. Hit and damage are separate action-resolution rolls. Damage does not have advantage/disadvantage; damage can be affected by critical-hit rules.
```

```md
Q: Should advantage/disadvantage wrap the whole authored Roll20 expression or only the d100 component?
PA: One rule with examples for a basic stat check and an attack roll.
A: The rules describe rolling two of the same check and taking the higher/lower value. Treat advantage/disadvantage as applying to the full hit/check result, not damage. For standard formulas this is equivalent to rolling the d100 component twice while keeping the same stat/proficiency multipliers.
```

```md
Q: What exact Roll20 chat syntax should be emitted for advantage and disadvantage?
PA: Concrete Roll20 formula examples for normal, advantage, and disadvantage.
A:
```

```md
Q: Can a single action have both advantage and disadvantage selected?
PA: One of: impossible, cancel to normal, stack by source, or GM chooses.
A:
```

```md
Q: Are there named sources that automatically grant advantage/disadvantage?
PA: Source list, such as shield block, heavy armor, conditions, terrain, or none.
A: Yes. Stated sources include shield-equipped block actions gaining advantage, dodge having disadvantage when used in melee range, flanking granting advantage on contested checks, grappled characters attacking at disadvantage, and GM/situation/skill discretion for skill checks.
```

```md
Q: Should Roll20 chat show the selected advantage/disadvantage mode?
PA: Public label rule, such as show `[Advantage]`/`[Disadvantage]`, include it in the action text, or omit the mode label.
A: Yes. Since Roll20 rolls are public by default, the selected mode should be shown publicly when advantage or disadvantage is used.
```

### Weapon And Equipment Attack Rules

Current understanding:

- Equipped/active weapon selection exists for attack rolls.
- Equipment is an inventory-list model, not a slot layout for MVP.
- Weapons define damage, governing stat, reach, damage type, and proficiency reference.
- Equipment-specific mechanical effects should use the generic augmentation interface whenever possible.
- Item type fields should be reserved for core resolver inputs or play-reference metadata, not bespoke per-equipment rule branches.

```md
Q: What fields are required to define a weapon?
PA: Required and optional field list, including damage, stat, reach, damage type, proficiency, tags, and notes.
A: Required resolver/reference fields from the rules are weapon damage modifier/base damage, weapon type, reach, physical damage type, governing attack stat, and proficiency reference. Weapons may also have attached skills and stat bonuses/effects.
```

```md
Q: How should an active weapon be selected when a sheet has multiple weapons?
PA: Selection rule, such as one active weapon, multiple active weapons, action-specific weapon selection, or manual only.
A: The rules require a weapon to be equipped for its weapon skill to be used, and physical attacks are declared with a weapon. Exact multi-weapon selection behavior is not specified; use equipped/active weapon selection as the app reference until a more detailed rule is provided.
```

```md
Q: Does each weapon reference one proficiency, multiple proficiencies, or a category proficiency?
PA: Proficiency-reference rule with examples for weapon type and specific weapon.
A: Weapons generally use weapon-type proficiency. More powerful or special weapons may require mastery of a weapon type and then use their own specific proficiency. Example from the rules: a legendary blade may require 100% longsword mastery to wield, then use a distinct Excalibur proficiency for its rolls.
```

```md
Q: How is a weapon's governing stat chosen?
PA: One of: fixed by weapon, chosen at action time, derived from action, derived from weapon category, or mixed rule.
A: Physical weapon attacks are weapon-based. The rules name Strength for strength-based weapons and blocking, Dexterity for dexterity-based weapons and dodging, and weapon-based stats for attack/parry. Use the weapon or weapon category to define the governing stat.
```

```md
Q: Does reach matter mechanically in the app?
PA: One of: display/manual only, formula input, Roll20 chat output, positioning rule, or later.
A: Reach is display/manual reference only. The app should store/show it so players and the DM can reference it while playing in Roll20, but it should not affect app-side mechanics, formulas, targeting, or positioning.
```

```md
Q: How should offhand, two-handed, thrown, ranged, and improvised weapons be represented?
PA: Tags/fields and any mechanical effects for each weapon mode.
A: Represent them as item tags or reference metadata by default. Any mechanical effects from those tags should be expressed through generic augmentations or authored actions unless a future core resolver explicitly needs a first-class field.
```

```md
Q: Which equipment effects must be first-class fields instead of generic augmentations?
PA: Minimal field list that cannot be represented as augmentations, plus the reason each field needs resolver support.
A: Prefer generic augmentations for equipment modifiers. First-class equipment fields should be limited to values the core resolver must read directly, such as weapon base damage, damage type, governing stat, proficiency reference, and display/reference fields like reach.
```

### Physical Attack Resolution

Current understanding:

- To hit: `Proficiency * (1d100 / 100) * Attack Stat`
- Damage: `Weapon Damage + Proficiency * (d100 / 100) * Governing Stat`
- Critical 1: GM-determined failure, usually no damage.
- Critical 100: double total damage.

```md
Q: Should proficiency be represented in formulas as `0..100` or `0.0..1.0`?
PA: Formula convention for player-visible formulas and backend internal values.
A: Player-facing proficiency is 0 to 100 percent. Formula examples use fractional coefficients, such as `Proficiency=.5`, so formulas should evaluate proficiency as `0.0..1.0` while displaying it as `0..100%`.
```

```md
Q: Is the attack stat always the same as the weapon governing stat?
PA: Relationship rule with exceptions if any.
A: The rules imply the attack stat is weapon-based and determined by the weapon/category. Damage examples use the weapon governing stat, such as longsword using Strength. No separate attack-stat-vs-damage-stat split is specified.
```

```md
Q: Does the hit roll compare against a DC/AC or against a defender roll?
PA: Hit-resolution rule for normal attacks, dodge, parry, and block.
A: If the defender has no reaction available, the attack roll is checked against the defender's AC. If the defender has and chooses a reaction, the attack becomes an opposed roll against the selected defense: dodge uses Dexterity, block uses Strength, and parry uses weapon proficiency or Parry Skill.
```

```md
Q: What exactly doubles on critical 100?
PA: One of: weapon damage only, stat/proficiency contribution only, total pre-resistance damage, total post-resistance damage, or action-specific.
A: The rules say critical 100 is a critical success that doubles total damage. Attack flow rolls damage before applying resistance, so treat this as doubling total rolled/pre-resistance damage unless the DM clarifies otherwise. Attacks on unconscious targets are automatic critical hits with maximum damage doubled.
```

```md
Q: Does critical 1 always fail, even if modifiers would otherwise succeed?
PA: Critical failure rule and exceptions.
A: The rules state `1 -> Critical Failure` and that the effect is determined by the GM, usually no damage. No exception is specified.
```

```md
Q: How do defensive actions and active augmentation effects interact with attack resolution?
PA: Step-by-step order of operations for hit roll, defender response, active augmentations, criticals, and damage.
A: Attack flow from the rules: attacker declares weapon attack and target; if defender has no reaction, attacker rolls to hit against AC, then on success rolls damage and applies resistance. If defender has a reaction, defender chooses block, parry, or dodge and resolves the opposed roll. Parry success lets defender immediately roll damage against attacker; parry failure lets attacker roll damage normally. Block success prevents damage; block failure causes half damage. Dodge success prevents damage and moves defender 5 feet; dodge failure causes full damage and still moves defender 5 feet. AOE dodge can produce 0 damage if out of radius or half damage if still inside radius. Active augmentation effects should be applied where their target stat/effect participates in this flow.
```

```md
Q: Are attack and damage separate rolls or derived from one d100 roll?
PA: Roll-count rule with examples.
A: Attack/hit and damage are separate rolls. The hit roll determines whether the attack connects. The damage roll is resolved separately after a hit and is modified by critical-hit rules when applicable.
```

### Damage And Resistance

Current understanding:

- Physical damage types: Piercing, Slashing, Bludgeoning.
- Magical damage types: Arcane, Fire, Water, Earth, Wind, Light, Dark, Lightning, Ice, Time, Gravity, Psychic.
- Resistance is additive and capped at 100 percent.
- Internal convention prefers fractions, where `0.25` means 25 percent.
- Effective resistance combines total resistance, physical/magical category resistance, and specific damage-type resistance, then caps at 100 percent.
- Damage taken: `Damage Inflicted - (Damage Inflicted * Resistance)`.

```md
Q: Are resistances always additive before the cap, or do any sources multiply?
PA: Stacking rule by source type.
A: Resistance is additive. Example: 20% resistance plus 20% armor resistance becomes 40% total resistance.
```

```md
Q: Can resistance go below 0 percent as vulnerability?
PA: Yes/no plus vulnerability formula if yes.
A:
```

```md
Q: Can resistance exceed 100 percent before capping for penetration or special effects?
PA: Cap and penetration rule.
A: Resistance is capped at 100%. At 100% resistance, the character is immune to that damage type. No penetration or over-cap rule is specified.
```

```md
Q: Are armor-derived resistances different from condition/item resistances?
PA: Source-type distinction or statement that all resistance is equivalent.
A: The rules list armor, shields, level, skills, and items as sources that increase resistance, and use one additive stacking rule. No special source-type distinction is specified.
```

```md
Q: Does damage round down, round up, round nearest, or keep decimals?
PA: Rounding rule and when it applies.
A: The longsword example produces `34.05 -> 34 damage`, which implies rounding down/truncating final damage. The exact general rounding rule should still be confirmed.
```

```md
Q: Is there a minimum damage rule after resistance?
PA: Minimum damage number or no-minimum rule.
A:
```

```md
Q: Should healing use negative damage, a separate semantic healing step, or generic bounded mutation only?
PA: Healing model and whether resistance can ever affect healing.
A:
```

### Armor Rules

Current understanding:

- Armor is equipment.
- Armor effects, including resistance and penalties, should use generic augmentation templates where possible.
- Armor does not need bespoke app-side mechanics unless a future resolver requires a first-class field.

```md
Q: What armor fields are required?
PA: Required and optional fields, such as resistance values, weight, category, penalties, durability, notes.
A: Prefer normal item fields plus augmentation templates. Armor-specific fields should be display/reference metadata unless the damage resolver needs a direct field.
```

```md
Q: Should heavy armor penalties be modeled as generic augmentations?
PA: Yes/no plus any exceptions that need first-class resolver support.
A: Yes by default. Heavy armor penalties should be authored as augmentations or action/condition effects, not hardcoded equipment-type behavior.
```

```md
Q: Should armor effects on spellcasting, overload, initiative, or proficiency gain use the same augmentation interface?
PA: Yes/no plus any effect type that cannot be represented generically.
A: Yes by default. Use generic augmentations or authored actions unless a specific effect cannot be represented by the generic model.
```

```md
Q: Can armor augmentation templates modify total, physical, magical, and specific damage-type resistances?
PA: Allowed resistance target list and stacking behavior.
A: Yes. The rules support total physical resistance, total magical resistance, total damage resistance, and specific physical/magical damage-type resistance. Armor may add resistance, with exact values unique to the armor.
```

```md
Q: Do armor-provided resistance augmentations stack with item/condition resistance augmentations by normal resistance rules?
PA: Stacking rule and examples.
A: Yes. Resistance from armor stacks additively with other resistance sources and caps at 100%.
```

### Proficiency Growth

Current understanding:

- Proficiency is separate from stats.
- Categories include weapon type, specific weapon, skill, and spell.
- Range is 0 to 100 percent.
- 100 percent is mastery.
- Increments happen on approved use and are configurable per weapon/spell/skill.
- Players cannot manually edit proficiency.
- GM can manually correct/edit proficiency.
- Actions can declare which proficiency or proficiencies they train.
- Multiple actions can feed the same proficiency.
- MVP is strict: action references must point to existing global proficiency definitions and sheet proficiency bridges.

```md
Q: What is the exact formula for increasing proficiency on use?
PA: Formula using current proficiency, action amount, growth rate, and any caps.
A: Each use increases proficiency by that weapon/spell/skill's distinct increase rate until the 100% cap. Example rates from the rules: longsword may increase by 1% per use, while a more complicated/powerful weapon type may increase by 0.1% per use.
```

```md
Q: Does `growth_rate` multiply the gained amount, cap the amount, or represent something else?
PA: Definition of `growth_rate` with example values.
A: `growth_rate` represents the per-use proficiency increase rate for that weapon/spell/skill. Example: `1%` per use for longsword or `0.1%` per use for a harder weapon type.
```

```md
Q: Is every action use automatically approved for proficiency gain?
PA: Approval rule: automatic, GM-approved, only on success, or action-specific.
A: The rules say every time you use an ability, skill, weapon, or spell, you gain proficiency, and that proficiency increases upon use. They do not state a separate approval gate.
```

```md
Q: Should failed actions train proficiency?
PA: Yes/no/partial rule with examples.
A:
```

```md
Q: Should downtime training use the same growth formula as action use?
PA: Same formula, separate formula, or manual-only decision.
A: Downtime can be allocated to practice a skill/spell/weapon in order to increase proficiency, but the exact downtime gain formula is not specified.
```

```md
Q: Can one action train multiple proficiencies?
PA: Full value, split value, weighted value, capped value, or disallowed.
A:
```

```md
Q: Can proficiency decay, be capped by level, or be blocked by lack of teacher/materials?
PA: Constraints list or explicit no-constraint answer.
A: Proficiency is capped at 100%. The supplied rules do not specify decay, level caps, teacher requirements, or material requirements.
```

```md
Q: What happens at 100 percent mastery beyond display?
PA: Unlocks, bonuses, caps, title-only, or no automatic effect.
A: At 100% proficiency, the character has mastered that skill/spell/weapon. Mastery can unlock access to higher ranked spells/skills or more powerful weapons, and some spells/skills require mastery of another spell or skill to unlock.
```

### Mastery Unlocks

Current understanding:

- Mastery can unlock actions, items, or spells later.
- Backend enforcement can wait unless rules become clear.

```md
Q: What unlock types exist?
PA: List of unlock types, such as actions, spells, items, passive bonuses, titles, recipes, other.
A: Mastery can unlock higher ranked spells, higher ranked skills, and more powerful weapons. Proficiency can also grant modifiers such as lower mana cost, more damage, better range, secondary features, and similar improvements depending on rank.
```

```md
Q: Are unlocks automatic at threshold or manually granted by GM?
PA: Granting policy and approval flow.
A: The rules present mastery as a requirement for access once 100% is reached, but acquisition/availability of higher ranked spells, skills, or powerful weapons still appears campaign/GM controlled.
```

```md
Q: Is 100 percent the only threshold, or are there intermediate thresholds?
PA: Threshold list and effects.
A: 100% is the explicit mastery threshold. The rules mention that increasing proficiency can grant modifiers depending on rank, but do not define intermediate percentage thresholds.
```

```md
Q: Should unavailable actions/items/spells be hidden or shown disabled?
PA: Visibility/UX rule.
A:
```

```md
Q: Can unlock requirements depend on multiple proficiencies?
PA: Requirement rule with examples.
A: The rules explicitly allow unlock requirements based on another proficiency: higher ranked spells may require mastery of lower ranked spells, and powerful weapons may require mastery of a weapon type before use. Multiple simultaneous proficiency requirements are not specified.
```

```md
Q: Can mastery be lost, and if so do unlocks remain?
PA: Mastery-loss and unlock-retention rule.
A:
```

### Downtime Training

Current understanding:

- Downtime training exists in the rules.
- It can stay manual/Roll20 until rules are settled.

```md
Q: What resources does downtime training consume?
PA: Resource list, such as time, money, teacher, location, materials, fatigue, or none.
A: Downtime consumes a period of time, such as days, weeks, months, or years. During downtime, each player is asked what they wish to do. Money, teacher, location, materials, and fatigue costs are not specified.
```

```md
Q: What is the downtime training gain formula?
PA: Formula and examples.
A: Downtime training can increase proficiency by practicing a skill/spell/weapon, but no exact gain formula is specified.
```

```md
Q: Is training capped by current proficiency, level, teacher quality, or equipment?
PA: Cap/limit rules.
A: Training/proficiency is capped at 100%. No level, teacher quality, or equipment training cap is specified in the supplied rules.
```

```md
Q: How does downtime training interact with normal action-use proficiency gain?
PA: Same pool, separate pool, daily cap, stacking rule, or manual-only.
A: Downtime training increases the same proficiency concept as normal use. The rules do not define daily caps, stacking, or whether downtime uses the exact same per-use rate.
```

```md
Q: Can players request downtime training, or is it GM-only?
PA: Permission and approval flow.
A: When downtime happens, each player is asked what they wish to do, so players can request/choose training activity during downtime. GM adjudication is implied but not fully specified.
```

```md
Q: Does training require rolls, and can it fail?
PA: Roll rule, failure rule, and success/failure outcomes.
A: The supplied downtime rules do not specify training rolls or training failure.
```

### Level-Up Policy

Current understanding:

- Manual value edits are enough until rules are settled.
- Player-facing manual level-up drafts were removed because they were not authoritative.

```md
Q: What triggers level-up?
PA: Trigger rule, such as XP, milestone, proficiency threshold, GM decision, or mixed.
A: Characters gain XP from fighting monsters. Each level has an XP threshold that must be reached before leveling up.
```

```md
Q: Which values change on level-up?
PA: Field list, such as HP, mana, stats, proficiencies, spells, actions, resistances, other.
A: Leveling up grants stat points assigned randomly or by GM discretion across core statistics. The rules state that statistics are the only aspect of the character that improves upon leveling; skills and spells are not limited by player level, only by statistics.
```

```md
Q: Are HP, mana, stats, proficiencies, spells, and actions all part of level-up?
PA: Inclusion/exclusion list with formulas where applicable.
A: Core statistics change through level-up stat points. HP, mana, action points, and other derived values may change indirectly because they derive from stats. Proficiencies, spells, and skills do not level directly through character level in the supplied rules.
```

```md
Q: What is the exact HP max formula and race modifier behavior?
PA: Formula and source fields.
A: The supplied rules state that every race has an HP modifier and give examples `Human: 10 * 50 = 500 HP` and `Demon: 100 * 50 = 5000 HP`. The exact source of the `50` multiplier and how this combines with Constitution/Health needs confirmation.
```

```md
Q: What is the exact Strength-to-carry-weight formula?
PA: Formula and rounding rule.
A: Strength determines total carry weight, but the supplied rules do not provide an exact formula.
```

```md
Q: Who can apply level-up changes?
PA: One of: player request, GM approval, GM-only, automatic, or mixed.
A: The GM assigns level-up stat points randomly across core statistics, or by GM discretion. Unassigned stat points may be allocated by the player when the GM grants them.
```

```md
Q: Should level-up changes be reversible/auditable?
PA: Audit and undo policy.
A:
```

## Lower-Priority Or Later Decisions

These are not immediate blockers, but they should be answered before automating the related systems.

### Magical Attacks And Spells

Current understanding:

- To hit: `Proficiency * (d100 / 100) * Arcane`
- Damage: `Proficiency * (d100 / 100) * Base Spell Damage`
- Spell ranks: F, F+, E, E+, D, D+, C, C+, B, B+, A, A+, S, S+, SS, SS+.

```md
Q: What fields define a spell?
PA: Required and optional spell fields.
A: The supplied rules imply spell fields for rank, base mana cost/minimum mana requirement, base spell damage, damage type, spell proficiency, and overload behavior. Exact required fields are not fully specified.
```

```md
Q: How is base spell damage derived from rank?
PA: Rank-to-damage table or formula.
A: The supplied rules provide rank-based overload percentage increases, but not a base spell damage table or formula.
```

```md
Q: Do spells always use Arcane, or can they use other stats?
PA: Stat-selection rule.
A: Magical attack to-hit rolls use Arcane.
```

```md
Q: Do spells have proficiency categories separate from spell identity?
PA: Spell proficiency model with examples.
A: Each individual spell has its own proficiency, and spell proficiency increases upon spell use.
```

```md
Q: Do spells consume mana, actions, components, or cooldowns?
PA: Resource/cost rules.
A: Spells require mana. A caster must have at least the spell's minimum base mana available to channel; if the caster has less mana than required, the spell cannot be cast. The supplied text does not specify components or cooldowns.
```

```md
Q: Do spell critical rules differ from physical attacks?
PA: Spell critical rule.
A: The supplied rules do not define spell critical behavior.
```

```md
Q: How do spell damage type, resistance, and armor interact?
PA: Damage/resistance/armor order of operations.
A: Magical attacks use magical damage types, and resistance includes magical, total, and specific damage-type resistance. The supplied rules do not provide a spell-specific resistance/armor order beyond the general resistance formula.
```

### Overload

Current understanding:

- Overload is not MVP.
- Exact DC formula is deferred.
- Selected mode and overload alternatives are later work.

```md
Q: What does overload do mechanically?
PA: Rule summary and affected action/spell types.
A: Overloading forces more mana into a spell than it can normally contain, increasing damage based on spell rank and overload tier while increasing failure risk. It can be overloaded up to a maximum of five tiers.
```

```md
Q: What is the exact overload DC formula?
PA: Formula with variables and rounding rule.
A: Overload requires a DC check based on the caster's Control stat and spell rank. The supplied text includes reference DC tables by rank/tier/control assumptions, but does not provide a single exact formula.
```

```md
Q: What stats/proficiencies/resources affect overload?
PA: Field list and formulas.
A: Overload is affected by spell rank, overload tier, mana cost, and the caster's Control stat for the DC check. The text does not mention proficiency affecting overload.
```

```md
Q: What happens on overload success, failure, and critical results?
PA: Outcome table or bullet list.
A: Each overload tier doubles the normal mana cost and increases damage based on spell rank. The caster rolls separately for each additional tier. If any overload attempt fails, the spent mana is wasted and the spell explodes, dealing area-of-effect damage centered on the caster. Failed overload damage is based on spell rank and the highest overload tier successfully reached, and the text says failure deals half of the overloaded damage around the caster. Critical behavior is not specified.
```

```md
Q: Can overload be selected as an action mode, spell mode, or separate action?
PA: Selection model.
A: The rules describe overload as a way to cast/modify a spell, not as a separate non-spell action. Exact UI selection model is not specified.
```

```md
Q: Does overload increase proficiency, consume resources, or apply conditions?
PA: Side-effect rules.
A: Overload consumes mana: each tier doubles the normal mana cost. Failure wastes the spent mana and causes an explosion. The rules do not state whether overload increases proficiency or applies conditions.
```

### Critical Rules Outside Physical Attacks

Current understanding:

- Physical attack critical 1 and 100 have partial rules.
- Critical behavior outside physical weapon attacks is unresolved.

```md
Q: Do skill checks, spells, defenses, downtime rolls, and overload rolls use critical 1/100?
PA: Critical applicability list by roll type.
A: Critical 1/100 is explicitly described for physical weapon attacks. An unconscious target is automatically critically hit. The supplied text does not clearly define critical rules for skill checks, spells, defenses, downtime, or overload.
```

```md
Q: Does critical 100 always double output, or does it depend on action type?
PA: Critical success effect by roll/action type.
A: For physical weapon attacks, critical 100 doubles total damage. Attacks on unconscious targets cause maximum damage doubled. Other action types are not specified.
```

```md
Q: Does critical 1 always fail?
PA: Critical failure rule and exceptions.
A: For physical weapon attacks, a roll of 1 is a critical failure with effect determined by the GM, usually no damage. Other action types are not specified.
```

```md
Q: Are critical effects public, GM-only, or narrated manually?
PA: Visibility/narration policy.
A: Roll20 rolls are public by default per the current project decision. The supplied rules state critical failure effect is determined by the GM; narration details are not otherwise specified.
```

### Combat And Turn Tracking

Current understanding:

- Turn order, action point reset, reactions, contested reactions, opportunity attacks, flanking, grappling, AOE positioning, and cross-sheet damage application are Roll20/manual.
- The app should not automate cross-sheet combat workflows for MVP.

```md
Q: Should the app ever track initiative/turn order, or should that remain Roll20-only?
PA: Automation boundary.
A: The rules define turn order as a Dexterity check by all involved characters: `(d100 / 100) * Dexterity`. Once set, turn order cannot be changed for the duration of combat except by GM discretion. Whether the app or Roll20 should track it remains an implementation boundary decision.
```

```md
Q: How many action points does a sheet have, and when do they reset?
PA: Action point formula and reset timing.
A: Action points are based on Reaction Time thresholds: 0=1, 20=2, 40=3, 60=4, 80=5, 100=8, 130=9, 160=10, 190=11, 220=12, 250=13, 280=14, 310=15, 340=16, 400=20. The text says action points reset at the start of your turn and do not carry over, but a later reaction section says actions/reactions refresh at the start of each round; timing should be confirmed.
```

```md
Q: Which actions consume action points?
PA: Cost table or category rules.
A: Attack, movement dash, disengage, ready action, consumable use in battle, and reactions consume action points. Dodge, block, and parry are reactions. Initial movement is always free unless restricted by external effects.
```

```md
Q: How do reactions work?
PA: Trigger, cost, timing, and reset rules.
A: Reactions are actions spent outside a character's turn in response to an event. Dodge, block, and parry are reactions. General reactions do not need to be readied, but more specific reactions can be readied for a declared trigger by spending the action point immediately. The number of reactions per round equals the character's available actions per round. Dodge uses Dexterity, block uses Strength, and parry uses an equipped weapon or Parry Skill.
```

```md
Q: Should the app track defeated/slayed records automatically or only by GM input?
PA: Automation and permission rule.
A: The supplied rules do not specify automated defeated/slayed tracking.
```

```md
Q: What combat events must be logged for audit/history?
PA: Event list and visibility policy.
A: The supplied rules do not specify app audit/history logging requirements.
```

### Relationship And Bridge Commands

Current understanding:

- The backend has explicit bridge records for sheet actions, sheet items, and sheet proficiencies.
- A later plan item proposes semantic commands such as `attach`, `detach`, `link`, `unlink`, and `instantiate`.

```md
Q: Which relationships should be user-facing commands?
PA: Relationship list and command names.
A:
```

```md
Q: What is the difference between attach, link, equip, assign, instantiate, and apply?
PA: Term definitions.
A:
```

```md
Q: Should bridge operations have permissions, costs, or audit history?
PA: Permission/cost/audit policy.
A:
```

```md
Q: Are bridge changes ever player-requested, or always GM-only?
PA: Permission and approval flow.
A:
```

### Conditions And Augmentations

Current understanding:

- Conditions are authored as presets with augmentation templates.
- MVP leaves duration, expiry, and removal conditions manual.
- Lifecycle fields are descriptive notes only, not executable predicates or formulas.
- Future automatic condition logic requires a validated backend-owned condition/effect expression model.

```md
Q: What condition durations exist?
PA: Duration types and allowed values.
A: The supplied text defines example conditions/status effects such as grappled, but does not define duration types.
```

```md
Q: When do durations tick down?
PA: Timing rule, such as start of turn, end of turn, real time, or manual.
A:
```

```md
Q: What removes conditions?
PA: Removal triggers, actions, saves, durations, GM-only, or manual.
A: For grappled, the character can attempt to break free by spending action points on another contested Strength check against the opponent. Other condition removal rules are not specified.
```

```md
Q: Can conditions affect other sheets, or only the current instance?
PA: Scope rule.
A: The supplied rules describe conditions/status effects on characters, such as grappled affecting the grappled character. App data scope is not specified.
```

```md
Q: Can conditions trigger automatic effects?
PA: Trigger/effect rule or explicit manual-only decision.
A:
```

```md
Q: Are condition details public, GM-only, or mixed?
PA: Visibility policy for name, description, effects, formulas, and notes.
A:
```

### Export, Campaigns, And Persistence

Current understanding:

- Export/import JSON, multi-campaign support, migrations, and schema versions are later work.

```md
Q: What data belongs to a campaign?
PA: Campaign data model list.
A:
```

```md
Q: What should export/import include or exclude?
PA: Include/exclude list.
A:
```

```md
Q: Are global rules/proficiencies/items shared between campaigns or copied per campaign?
PA: Sharing/copying rule.
A:
```

```md
Q: Should imported content preserve IDs or remap them?
PA: ID policy and conflict behavior.
A:
```
