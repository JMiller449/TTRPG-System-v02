# Rule Decisions Needed

This document collects rule questions the app needs answered before deeper automation. It is written for a DM or common rules author to fill in directly.

This revision answers rule questions from the revised system document and records explicit MVP/app decisions where the rulebook is intentionally silent.

Source authority order:

1. `Chip_TTRPG_System.md` (Revised and Corrected Rulebook)
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
A: Emit the normal authored formula with `1d100`. For advantage, replace that die with `2d100kh1`; for disadvantage, replace it with `2d100kl1`. Keep the existing `FLOOR(...)`, stat, and proficiency terms unchanged, and include a public mode label. Example check at 50% proficiency and Stat 40: normal `/roll floor((1 + 0.50) * (1d100 / 100) * 40) Normal`; advantage `/roll floor((1 + 0.50) * (2d100kh1 / 100) * 40) Advantage`; disadvantage `/roll floor((1 + 0.50) * (2d100kl1 / 100) * 40) Disadvantage`. Attack rolls use the same substitution inside the weapon or spell to-hit formula.
```

```md
Q: If one source gives advantage and another source gives disadvantage to the same hit/check roll, what should happen?
PA: One of: cancel to normal, GM chooses which applies, strongest source wins, or another conflict rule.
A: They cancel to a normal roll. Multiple sources of advantage do not stack, and multiple sources of disadvantage do not stack. If at least one source of each applies, roll one d100 normally unless a more specific rule explicitly overrides this.
```

```md
Q: Are there named sources that automatically grant advantage/disadvantage?
PA: Source list, such as shield block, heavy armor, conditions, terrain, or none.
A: Yes. A shield normally grants advantage on Block. Dodge has disadvantage in melee range, in heavy armor, and while grappled. A grappled character makes attacks with disadvantage and makes the special check to maneuver the grappler into an incoming attack with disadvantage. Flanking grants advantage on contested checks against the target. Specific skills, spells, equipment, conditions, or GM rulings may add other sources.
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
A: Required resolver/reference fields are name, weapon type, base damage, governing stat, one or more physical damage types, reach, proficiency reference, and proficiency growth rate. Optional fields include stat bonuses, attached skills, traits, special effects, prerequisites, tags, and notes.
```

```md
Q: How should an active weapon be selected when a sheet has multiple weapons?
PA: Selection rule, such as one active weapon, multiple active weapons, action-specific weapon selection, or manual only.
A: A sheet may have multiple equipped weapons, but each attack action selects exactly one active weapon for that resolution. The selected weapon supplies the base damage, governing stat, damage type, reach, proficiency reference, and attached effects. Dual-wield or multi-weapon actions must be authored explicitly rather than inferred.
```

```md
Q: Does each weapon reference one proficiency, multiple proficiencies, or a category proficiency?
PA: Proficiency-reference rule with examples for weapon type and specific weapon.
A: Weapons generally use weapon-type proficiency. More powerful or special weapons may require mastery of a weapon type and then use their own specific proficiency. Example from the rules: a legendary blade may require 100% longsword mastery to wield, then use a distinct Excalibur proficiency for its rolls.
```

```md
Q: How is a weapon's governing stat chosen?
PA: One of: fixed by weapon, chosen at action time, derived from action, derived from weapon category, or mixed rule.
A: The governing stat is fixed by the weapon definition. Commonly, heavy or power-focused weapons use Strength and finesse, bow, or precision weapons use Dexterity, but the specific weapon entry is authoritative.
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
A: First-class weapon fields are the values the core resolver or play reference must read directly: weapon type, base damage, governing stat, damage type or types, reach, proficiency reference, and proficiency growth rate. Other bonuses, penalties, skills, traits, resistances, and special effects should use generic augmentations or authored actions whenever possible.
```

### Physical Attack Resolution

Current understanding:

- To hit: `FLOOR((1 + Weapon Proficiency) * (d100 / 100) * Weapon Governing Stat)`
- Damage: `FLOOR(Weapon Base Damage + (1 + Weapon Proficiency) * (d100 / 100) * Weapon Governing Stat)`
- Critical 1: automatic miss; any additional physical-attack consequence is GM-determined.
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
A: For a damaging physical or spell attack, roll and calculate damage normally, then double the total before defense-based reductions and resistance. A natural 100 Parry doubles the counterattack's final pre-resistance damage. Attacks against unconscious targets use maximum possible damage and then double it.
```

```md
Q: Does critical 1 always fail, even if modifiers would otherwise succeed?
PA: Critical failure rule and exceptions.
A: Yes. A natural 1 automatically fails regardless of the calculated result. The additional consequence depends on the roll type: physical attacks miss with any extra consequence set by the GM; spell to-hit rolls miss and still spend mana; Dodge, Block, and Parry use their listed natural-1 outcomes; other roll types use GM discretion.
```

```md
Q: How do defensive actions and active augmentation effects interact with attack resolution?
PA: Step-by-step order of operations for hit roll, defender response, active augmentations, criticals, and damage.
A: Resolve in this order: (1) attacker declares the attack and applicable modifiers; (2) defender chooses no reaction, Dodge, Block, or Parry before opposed rolls are resolved; (3) apply active/passive augmentations to the stats, proficiency, advantage state, or other values they modify; (4) roll the attack and defense, with the defender winning ties; (5) if damage is dealt, roll damage separately; (6) apply critical doubling; (7) apply Dodge or Block reduction; (8) apply resistance. Parry success replaces incoming damage with its immediate counterattack, which the original attacker cannot react to.
```

```md
Q: Are attack and damage separate rolls or derived from one d100 roll?
PA: Roll-count rule with examples.
A: Attack/hit and damage are separate rolls. The hit roll determines whether the attack connects. The damage roll is resolved separately after a hit and is modified by critical-hit rules when applicable.
```

### Damage And Resistance

Current understanding:

- Physical damage types: Piercing, Slashing, Bludgeoning.
- Magical damage types: Fire, Water, Earth, Wind, Light, Dark, Lightning, Ice, Time, Gravity, Psychic; spells may define additional types.
- Resistance is additive and capped at 100 percent.
- Internal convention prefers fractions, where `0.25` means 25 percent.
- Effective resistance combines total resistance, physical/magical category resistance, and specific damage-type resistance, then caps at 100 percent.
- Damage taken: `FLOOR(Damage Inflicted * (1 - Resistance))`.

```md
Q: Are resistances always additive before the cap, or do any sources multiply?
PA: Stacking rule by source type.
A: Resistance is additive. Example: 20% resistance plus 20% armor resistance becomes 40% total resistance.
```

```md
Q: Can resistance go below 0 percent as vulnerability?
PA: Yes/no plus vulnerability formula if yes.
A: No under the base rules. Resistance is a damage-reduction value and should be clamped to the range `0.00..1.00`. Vulnerability or bonus damage must be represented by a separate explicit effect unless a future rule defines negative resistance.
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
A: Always round fractional results down whenever a formula produces a final whole-number game value, unless a more specific rule explicitly says otherwise. Use `FLOOR(...)` for damage, post-reduction damage, resistance results, mana-cost calculations, checks, and other derived roll results.
```

```md
Q: Is there a minimum damage rule after resistance?
PA: Minimum damage number or no-minimum rule.
A: No. Damage may be reduced to 0. The resistance formula is `FLOOR(Damage × (1 - Resistance))`, and 100% resistance produces immunity unless a special rule bypasses it.
```

```md
Q: Should healing use negative damage, a separate semantic healing step, or generic bounded mutation only?
PA: Healing model and whether resistance can ever affect healing.
A: Use a separate semantic healing step, not negative damage. Healing increases current HP up to maximum HP unless an explicit effect permits temporary or over-max HP. Resistance and damage-type modifiers do not affect healing unless a healing effect specifically says they do.
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
A: Yes in the data model, but the standard heavy-armor template must always impose disadvantage on Dodge. The armor category may automatically attach that standard augmentation so individual heavy-armor items do not need to redefine it.
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
A: For each qualifying meaningful use, `New Proficiency = MIN(1.00, Current Proficiency + Growth Rate)`. Growth Rate is the weapon, skill, or spell's configured per-use increase, such as `0.01` for 1% or `0.001` for 0.1%.
```

```md
Q: Does `growth_rate` multiply the gained amount, cap the amount, or represent something else?
PA: Definition of `growth_rate` with example values.
A: `growth_rate` represents the per-use proficiency increase rate for that weapon/spell/skill. Example: `1%` per use for longsword or `0.1%` per use for a harder weapon type.
```

```md
Q: Is every action use automatically approved for proficiency gain?
PA: Approval rule: automatic, GM-approved, only on success, or action-specific.
A: A qualifying meaningful use grants proficiency even if it fails. The GM determines what counts as meaningful use and may deny gains from repetitive, consequence-free actions performed only to farm proficiency. The app should grant growth automatically only when the authored action declares the proficiency it trains and the use is not marked ineligible by the GM.
```

```md
Q: Should failed actions train proficiency?
PA: Yes/no/partial rule with examples.
A: Yes. Failure does not prevent proficiency gain. Missing with a weapon, casting a spell that is Dodged, and failing a skill check may all grant the normal configured growth rate, provided the attempt was a meaningful qualifying use.
```

```md
Q: Should downtime training use the same growth formula as action use?
PA: Same formula, separate formula, or manual-only decision.
A: No universal formula is required. Downtime training is GM-awarded/manual: the GM determines the time, resources, teacher or facility effects, and the total proficiency gained. The final value remains capped at 100%.
```

```md
Q: Can one action train multiple proficiencies?
PA: Full value, split value, weighted value, capped value, or disallowed.
A: Yes, but only when the authored action explicitly lists multiple proficiency training targets. Each listed proficiency receives its full configured per-use gain once; gains are not split or inferred automatically. The GM may remove a target when the associated proficiency was not meaningfully used.
```

```md
Q: Can proficiency decay, be capped by level, or be blocked by lack of teacher/materials?
PA: Constraints list or explicit no-constraint answer.
A: Under the base rules, proficiency does not decay and is not capped by character level. It is capped at 100%. Teachers, manuals, facilities, and materials may modify downtime training at GM discretion, but they are not general prerequisites for ordinary proficiency gain through meaningful use.
```

```md
Q: What happens at 100 percent mastery beyond display?
PA: Unlocks, bonuses, caps, title-only, or no automatic effect.
A: At 100% proficiency, the character has mastered that skill/spell/weapon. Mastery can unlock access to higher ranked spells/skills or more powerful weapons, and some spells/skills require mastery of another spell or skill to unlock.
```

### Mastery Unlocks

Current understanding:

- Mastery can unlock actions, items, or spells later.
- The app may enforce explicitly authored mastery prerequisites while leaving discovery and acquisition under GM control.

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
A: Show them disabled when the character can reasonably know they exist, with the unmet prerequisite or mastery requirement displayed. Content that is secret, undiscovered, or explicitly GM-only remains hidden.
```

```md
Q: Can unlock requirements depend on multiple proficiencies?
PA: Requirement rule with examples.
A: Yes. An authored unlock may require one or multiple proficiency thresholds. Multiple requirements use explicit `all`/AND or `any`/OR grouping; do not infer the grouping. Examples include requiring mastery of two prerequisite spells or mastery of both a weapon type and a related skill.
```

```md
Q: Can mastery be lost, and if so do unlocks remain?
PA: Mastery-loss and unlock-retention rule.
A: Mastery is not lost under the base rules because proficiency does not decay. Once the character reaches 100%, mastery and its earned unlock eligibility remain unless a specific curse, effect, campaign rule, or GM ruling explicitly removes them.
```

## Lower-Priority Or Later Decisions

These are not immediate blockers, but they should be answered before automating the related systems.

### Magical Attacks And Spells

Current understanding:

- To hit: `FLOOR((1 + Spell Proficiency) * (d100 / 100) * Arcane)`
- Damage: `FLOOR((1 + Spell Proficiency) * (d100 / 100) * Arcane + Base Spell Damage)`
- Spell ranks: F, F+, E, E+, D, D+, C, C+, B, B+, A, A+, S, S+, SS, SS+.

```md
Q: What fields define a spell?
PA: Required and optional spell fields.
A: A spell entry should list name, rank, damage type, base mana cost, base damage, range, area of effect if any, overload modifier, proficiency reference and growth rate, special effects, and prerequisites. Optional authored fields may define whether the spell can be Dodged or Blocked and any exception to the standard Arcane-based formulas.
```

```md
Q: How is base spell damage derived from rank?
PA: Rank-to-damage table or formula.
A: It is not derived from rank by a universal formula. Base spell damage is authored per spell. Rank may guide design, prerequisites, overload reference values, or campaign balance, but the spell's listed base damage is authoritative.
```

```md
Q: Do spells always use Arcane, or can they use other stats?
PA: Stat-selection rule.
A: Standard spell to-hit and spell damage formulas use Arcane. A specific spell, skill, item, or campaign rule may explicitly override the governing stat, because specific rules override the general rule.
```

```md
Q: Do spells have proficiency categories separate from spell identity?
PA: Spell proficiency model with examples.
A: Each individual spell has its own proficiency, and spell proficiency increases upon spell use.
```

```md
Q: Do spells consume mana, actions, components, or cooldowns?
PA: Resource/cost rules.
A: A spell consumes its complete mana cost when the cast is committed, including mana committed to an overload attempt. An attack spell uses the normal action-point cost for attacking unless its entry says otherwise. Components and cooldowns do not exist by default; add them only when the specific spell or campaign rule defines them.
```

```md
Q: Do spell critical rules differ from physical attacks?
PA: Spell critical rule.
A: Spell to-hit has explicit critical rules. A natural 1 automatically misses, requires no defense roll, and still spends mana unless the spell says otherwise. A natural 100 is a critical spell attack; the defender still chooses Dodge or Block, and if the spell is not successfully defended against, roll damage normally and double the total before defense reduction and resistance.
```

```md
Q: How do spell damage type, resistance, and armor interact?
PA: Damage/resistance/armor order of operations.
A: Resolve spell damage by damage type. First calculate the spell's damage, including overloaded base damage if applicable; then apply critical doubling; then apply Dodge or Block reduction; then apply the target's applicable total, magical-category, and specific damage-type resistances additively, capped at 100%. Armor matters only through any resistance or special effect it grants.
```

### Overload

Current understanding:

- Overload remains later work, but its rules and required data are now defined.
- The Overload Check formula is defined; the Overload DC remains GM-assigned.
- Overload is a selectable spell-cast mode with tiers 1 through 5.

```md
Q: What does overload do mechanically?
PA: Rule summary and affected action/spell types.
A: Overloading modifies a spell cast up to five tiers. The caster pays the tier's increased mana cost, makes a sequential Control check for each tier using spell proficiency, and replaces Base Spell Damage with `Base Spell Damage × (1 + Overload Modifier × Tier)` if all attempted tiers succeed. Failure consumes the committed mana, prevents the intended effect, and causes a half-damage overloaded explosion centered on the caster.
```

```md
Q: What is the exact overload DC formula?
PA: Formula with variables and rounding rule.
A: There is no universal overload-DC formula. The check formula is `FLOOR((d100 / 100) × Control × (1 + Spell Proficiency))`, but the GM assigns the DC using spell rank/design, tier, expected Control, situation, campaign power level, and other effects. The rulebook's DC table is guidance only.
```

```md
Q: What stats/proficiencies/resources affect overload?
PA: Field list and formulas.
A: The overload check uses Control and the spell's proficiency. The attempt also depends on the selected overload tier, GM-assigned DC, the spell's overload modifier, base damage, base mana cost, and the caster having enough mana to pay the selected tier's complete cost. Spell rank is a design/DC reference rather than a direct term in the check formula.
```

```md
Q: What happens on overload success, failure, and critical results?
PA: Outcome table or bullet list.
A: For a requested tier, roll tiers sequentially from 1 upward. If all succeed, cast at the selected tier using the tier's total mana cost and overloaded base damage. Tier costs are 1.10×, 1.50×, 2.00×, 3.00×, and 6.00× base mana for tiers 1-5. If a tier fails, consume all committed mana, the intended target is unaffected, and the spell explodes around the caster using the failed tier's overloaded spell damage, halved, then reduced by resistance. The caster cannot Dodge their own explosion; other creatures may use normal AOE Dodge. Natural 1 is GM discretion and usually catastrophic; natural 100 is GM discretion.
```

```md
Q: Can overload be selected as an action mode, spell mode, or separate action?
PA: Selection model.
A: Treat overload as a spell-cast mode selected while declaring the spell, not as a separate action. The caster selects the intended overload tier before paying mana and rolling the sequential tier checks.
```

```md
Q: Does overload increase proficiency, consume resources, or apply conditions?
PA: Side-effect rules.
A: The overloaded cast is one qualifying use of the underlying spell and may grant that spell's normal proficiency growth once, even if an overload check fails, provided it was a meaningful attempt. It consumes the selected tier's complete mana cost when committed. Overload applies no condition by default, though a specific spell, failure effect, or GM ruling may do so.
```

### Critical Rules Outside Physical Attacks

Current understanding:

- Physical attacks, spell to-hit, Dodge, Block, and Parry have explicit natural 1/100 rules.
- Skill, grapple, and overload critical consequences remain GM-discretion; downtime has no required roll.

```md
Q: Do skill checks, spells, defenses, downtime rolls, and overload rolls use critical 1/100?
PA: Critical applicability list by roll type.
A: Yes, but effects depend on roll type. Physical attacks, spell to-hit, Dodge, Block, and Parry use their explicit natural-1 and natural-100 outcomes. Skill checks and grapple checks use GM discretion. Overload checks use GM discretion, with natural 1 usually catastrophic. Downtime training has no required roll or universal critical rule.
```

```md
Q: Does critical 100 always double output, or does it depend on action type?
PA: Critical success effect by roll/action type.
A: It depends on the roll type. Physical attack and successful damaging spell criticals double total damage; a natural 100 Parry doubles counterattack damage; a natural 100 Dodge improves movement to as far as 10 feet; a natural 100 Block may protect an adjacent ally; skill, grapple, and overload natural-100 effects are determined by the GM.
```

```md
Q: Does critical 1 always fail?
PA: Critical failure rule and exceptions.
A: Yes. A natural 1 automatically fails regardless of the calculated numerical result. The additional consequence depends on the roll type and follows the critical reference table or GM discretion.
```

```md
Q: Are critical effects public, GM-only, or narrated manually?
PA: Visibility/narration policy.
A: The rolled result and any rules-defined critical effect are public in Roll20 by default. GM-discretion consequences may be narrated manually and may remain hidden until they affect play. The app should display the detected natural 1/100 and the standard effect, while leaving any GM-added consequence as a separate manual entry.
```

### Combat And Turn Tracking

Current understanding:

- Turn order, action point reset, reactions, contested reactions, opportunity attacks, flanking, grappling, AOE positioning, and cross-sheet damage application are Roll20/manual.
- The app should not automate cross-sheet combat workflows for MVP.

```md
Q: Should the app ever track initiative/turn order, or should that remain Roll20-only?
PA: Automation boundary.
A: For MVP, initiative and turn order remain Roll20-authoritative/manual. The app may emit the initiative formula or result, but it should not own or synchronize the turn tracker unless a future decision expands the app boundary.
```

```md
Q: How many action points does a sheet have, and when do they reset?
PA: Action point formula and reset timing.
A: Action points use the Reaction Time threshold table: 0=1, 20=2, 40=3, 60=4, 80=5, 100=8, 130=9, 160=10, 190=11, 220=12, 250=13, 280=14, 310=15, 340=16, and 400=20. Use the greatest threshold met. The pool resets at the start of that character's own turn; unspent points do not carry across that reset, and points spent on the turn or as reactions remain spent until then.
```

```md
Q: Which actions consume action points?
PA: Cost table or category rules.
A: One action point is normally spent for an attack or attack spell, Dash, Disengage, Ready an Action, physical Dodge, Block, Parry, Spell Block, opportunity attack, consumable use in combat, grapple attempt, grapple escape attempt, retrieving a reachable disarmed weapon, and any skill, spell, item, or GM-defined action that specifies a cost. Each character receives one free normal movement allocation on their turn, and each defender receives one free Dodge against a Dodgeable spell.
```

```md
Q: How do reactions work?
PA: Trigger, cost, timing, and reset rules.
A: There is no separate reaction pool. A reaction is an action point spent outside the character's turn. A character may make any number of reactions while action points remain and valid triggers occur. Points spent as reactions reduce the pool available until the start of the character's next turn. The defender chooses a physical defense before opposed rolls are resolved; against a spell, the defender chooses either the free Spell Dodge or paid Spell Block before rolling. Readied actions spend their point when readied and resolve out of turn if the declared trigger occurs.
```

```md
Q: Should the app track defeated/slayed records automatically or only by GM input?
PA: Automation and permission rule.
A: GM input only for MVP. Because full combat flow and cross-sheet effects remain Roll20/manual, the app should not infer that a target was defeated. It may record a defeated/slayed entry when the GM explicitly confirms it.
```

```md
Q: What combat events must be logged for audit/history?
PA: Event list and visibility policy.
A: Log every backend-authoritative state mutation with timestamp, actor, campaign/sheet, source action, and before/after values. This includes HP/mana/action-point changes, damage and healing, condition add/remove/update, item/equipment changes, augmentation activation, proficiency gains or GM corrections, and explicit defeated/slayed confirmations. Pure Roll20 positioning, turn order, chat-only rolls, and unconfirmed cross-sheet outcomes are not required in the app log.
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
A: For MVP, conditions are manual-duration records. They may store descriptive duration text such as `until escaped`, `until removed`, or a GM-entered number of rounds/turns, but the backend does not interpret duration types automatically until a formal timing model is approved.
```

```md
Q: When do durations tick down?
PA: Timing rule, such as start of turn, end of turn, real time, or manual.
A: They do not tick down automatically in MVP. The GM or sheet owner updates/removes the condition manually according to the condition text and Roll20 combat timing. A future automated duration model requires an explicit choice of start-of-turn, end-of-turn, round, or real-time semantics.
```

```md
Q: What removes conditions?
PA: Removal triggers, actions, saves, durations, GM-only, or manual.
A: A condition is removed when its specific rule says so or by explicit GM/app action. Grappled ends when the grappled character wins the escape contest or another effect breaks the grapple. Disarmed ends for weapon-dependent restrictions when the weapon is retrieved or another valid weapon is equipped. Unconscious recovery, death, and stabilization are GM/campaign-defined. Unlisted conditions remain manual.
```

```md
Q: Can conditions affect other sheets, or only the current instance?
PA: Scope rule.
A: For MVP, a condition and its automatic augmentations affect only the sheet instance to which the condition is attached. Cross-sheet application or triggered effects remain manual/Roll20 unless a future intersheet resolver is approved.
```

```md
Q: Can conditions trigger automatic effects?
PA: Trigger/effect rule or explicit manual-only decision.
A: Passive modifiers and restrictions represented by validated augmentations may apply automatically while the condition is active. Timed, triggered, recurring, cross-sheet, or formula-authored effects do not execute automatically in MVP; they require a specific backend-owned trigger/effect model or manual GM resolution.
```

```md
Q: Are condition details public, GM-only, or mixed?
PA: Visibility policy for name, description, effects, formulas, and notes.
A: Mixed. The condition name, public description, duration text, and player-relevant mechanical effects are visible to the affected sheet's authorized players by default. Hidden conditions, secret causes, GM notes, and GM-only implementation details remain visible only to the GM. A condition preset should include an explicit visibility flag.
```

### Export, Campaigns, And Persistence

Current understanding:

- Export/import JSON, multi-campaign support, migrations, and schema versions are later work.

```md
Q: What data belongs to a campaign?
PA: Campaign data model list.
A: Campaign-scoped data includes campaign metadata/settings, memberships and roles, character sheets and derived state, HP/mana/action-point resources, proficiency bridges and progress, inventories/equipment/item instances, active augmentations and conditions, campaign-created actions/spells/items/rules, GM overrides, defeated/slayed records, and backend audit/history. Canonical system rules and reusable global definitions remain outside the campaign unless forked into campaign-specific content.
```

```md
Q: What should export/import include or exclude?
PA: Include/exclude list.
A: A campaign export should include schema version, campaign metadata/settings, role mappings by portable identifiers, sheets and resources, proficiency progress and references, inventories/equipment/item instances, conditions/augmentations, campaign-specific definitions, GM overrides, and audit/history when requested. Exclude authentication secrets, access tokens, server configuration, caches, transient jobs, and Roll20-only map/token/turn-tracker state. Imports must validate schema/version, permissions, references, and numeric bounds before mutation.
```

```md
Q: Are global rules/proficiencies/items shared between campaigns or copied per campaign?
PA: Sharing/copying rule.
A: Canonical system rules and reusable proficiency/item/action definitions are shared global records and are referenced by campaigns. A campaign may fork a definition into campaign-scoped content for customization; later global edits do not silently overwrite the fork, and campaign edits never mutate the canonical global record.
```

```md
Q: Should imported content preserve IDs or remap them?
PA: ID policy and conflict behavior.
A: Preserve stable IDs for same-campaign round trips and for canonical global references when the referenced record already exists and matches. On cross-campaign import, collision, or mismatched content, generate new IDs and rewrite all internal references through an import map. Never overwrite an unrelated existing record solely because an imported ID matches.
```
