# Chip TTRPG System

**Revised and Corrected Rulebook**  
**Authors:** James and Joe  
**Document status:** Editable working draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Conventions](#2-core-conventions)
3. [Character Statistics](#3-character-statistics)
   - [Core Stats](#31-core-stats)
   - [Substats](#32-substats)
   - [Substat Formulas](#33-substat-formulas)
   - [Direct Substat Bonuses](#34-direct-substat-bonuses)
   - [Health Points](#35-health-points)
   - [Soft Stat Cap](#36-soft-stat-cap)
4. [Defensive Statistics](#4-defensive-statistics)
   - [Armor Class](#41-armor-class)
   - [Resistance](#42-resistance)
5. [Skill Checks](#5-skill-checks)
6. [Equipment](#6-equipment)
   - [Weapons](#61-weapons)
   - [Armor](#62-armor)
   - [Shields](#63-shields)
   - [Accessories](#64-accessories)
   - [Items and Consumables](#65-items-and-consumables)
7. [Proficiency System](#7-proficiency-system)
8. [Leveling and Stat Points](#8-leveling-and-stat-points)
9. [Magic and Mana](#9-magic-and-mana)
10. [Combat](#10-combat)
    - [Turn Order](#101-turn-order)
    - [Action Points](#102-action-points)
    - [Movement](#103-movement)
    - [Ready an Action](#104-ready-an-action)
    - [Armor Class and Reactions](#105-armor-class-and-reactions)
    - [Physical Attacks](#106-physical-attacks)
    - [Dodge](#107-dodge)
    - [Block](#108-block)
    - [Parry](#109-parry)
    - [Opportunity Attacks](#1010-opportunity-attacks)
11. [Magical Combat](#11-magical-combat)
12. [Overloading Spells](#12-overloading-spells)
13. [Critical Rolls](#13-critical-rolls)
14. [Other Actions](#14-other-actions)
    - [Grappling](#141-grappling)
    - [Flanking](#142-flanking)
    - [Attacking Unconscious Targets](#143-attacking-unconscious-targets)
15. [Status Effects and Conditions](#15-status-effects-and-conditions)
16. [Quick Combat Reference](#16-quick-combat-reference)
17. [GM Adjudication and Unlisted Rules](#17-gm-adjudication-and-unlisted-rules)

---

# 1. Overview

The **Chip TTRPG System** is a high-statistics, high-damage tabletop role-playing system inspired by the progression systems common in Korean manhwa. Characters are expected to grow into very large numerical values, and large power disparities between characters, monsters, ranks, and levels are intentional.

The system is built around three major ideas:

1. **Large-scale progression.**  
   Character statistics, health, mana, damage, movement, and action economy can increase dramatically over time.

2. **Analog proficiency.**  
   Weapons, skills, and spells are not simply “proficient” or “not proficient.” Each has a proficiency value from 0% to 100% that improves through use and directly affects performance.

3. **Action-point combat.**  
   Characters use a shared pool of action points for attacks, extra movement, defensive reactions, opportunity attacks, and other combat options. A fast, experienced character may act many times in a single turn, but spending too many action points offensively can leave that character unable to defend later.

The original campaign concept assumes that players portray versions of themselves, with starting statistics determined through testing and rolling. A GM may adapt this character-creation assumption for other campaigns.

---

# 2. Core Conventions

These conventions apply throughout the system unless a more specific rule overrides them.

## 2.1 Dice Notation

- `d100` means roll one one-hundred-sided die, or an equivalent percentile roll.
- Most formulas use the roll as a percentage:

```text
Roll Multiplier = d100 / 100
```

Examples:

- A roll of 1 produces `0.01`.
- A roll of 50 produces `0.50`.
- A roll of 100 produces `1.00`.

## 2.2 Rounding

**Always round fractional results down** unless a rule explicitly states otherwise.

```text
Final Result = FLOOR(calculated result)
```

## 2.3 Proficiency Notation

Proficiency is stored as a decimal from `0.00` to `1.00`.

| Displayed Proficiency | Formula Value |
|---:|---:|
| 0% | 0.00 |
| 25% | 0.25 |
| 50% | 0.50 |
| 80% | 0.80 |
| 100% | 1.00 |

Whenever proficiency is used in a formula, use:

```text
1 + Proficiency
```

This means:

- A character at 0% proficiency still uses their full base statistic.
- A character at 50% proficiency uses a `1.50` multiplier.
- A character at 100% proficiency uses a `2.00` multiplier.

## 2.4 Meeting a Difficulty Class

A check succeeds when its final result **meets or exceeds** the Difficulty Class.

```text
Check Result >= DC
```

## 2.5 Ties

In an opposed or contested roll, **the defender wins ties**.

## 2.6 Advantage and Disadvantage

- **Advantage:** Roll twice and keep the higher die.
- **Disadvantage:** Roll twice and keep the lower die.
- Only the kept die determines whether the roll is a natural 1 or natural 100.
- If any listed condition imposes disadvantage, the roll is made with disadvantage unless a more specific rule says otherwise.

## 2.7 Natural 1

A natural 1 is an automatic failure, regardless of the calculated numerical result.

## 2.8 Natural 100

A natural 100 is a critical success when the relevant rule defines a critical effect. Specific critical effects are listed in [Critical Rolls](#13-critical-rolls).

---

# 3. Character Statistics

A character’s statistics determine what they can accomplish. Statistics are the primary representation of a character’s power, growth, physical capability, magical talent, and mental ability.

Starting core stats normally range from **5 to 12** and are determined through testing and rolling, subject to GM approval.

There are six core stats and eighteen substats.

## 3.1 Core Stats

| Core Stat | Description |
|---|---|
| **Strength** | Physical power. Determines how much a character can lift, carry, block, and how effectively they use strength-based weapons. |
| **Dexterity** | Speed, coordination, movement, and reaction speed. |
| **Constitution** | Overall physical health, toughness, and ability to endure harm. |
| **Perception** | Observation, awareness, sight, intuition, and ability to process information. |
| **Arcane** | Magical talent, magical output, and mana capacity. |
| **Will** | Force of personality, confidence, mental resolve, and ability to stand firm under pressure. |

## 3.2 Substats

Substats provide a more detailed representation of a character than core stats alone. They are derived from core stats, other substats, and permanent direct bonuses.

| Substat | Description |
|---|---|
| **Lifting** | How much weight the character can lift. |
| **Carry Weight** | How much weight the character can comfortably carry. |
| **Acrobatics** | Bodily control, balance, stunts, and complex physical movement. |
| **Stamina** | How long the character can continue strenuous activity. |
| **Reaction Time** | How quickly the character responds to danger and changing events. |
| **Health** | The character’s physical vitality and the basis of maximum HP. |
| **Endurance** | How long the character can endure difficult physical conditions. |
| **Pain Tolerance** | The character’s threshold for pain and bodily trauma. |
| **Sight Distance** | How far the character can see clearly. |
| **Intuition** | Ability to infer, predict, and understand situations from context. |
| **Registration** | Ability to process and interpret observed information. |
| **Mana** | The quantity and quality of mana available to the character. |
| **Control** | Ability to regulate, shape, and safely manipulate mana. |
| **Sensitivity** | Ability to detect and feel mana. |
| **Charisma** | Ability to communicate, persuade, and influence others. |
| **Mental Fortitude** | Ability to remain composed and withstand mental strain. |
| **Courage** | Ability to face danger rather than flee or break under pressure. |

## 3.3 Substat Formulas

Each substat may also have a permanent direct bonus. The formulas below show the derived value before that bonus is added.

| Substat | Derived Formula |
|---|---|
| Lifting | `FLOOR(Strength)` |
| Carry Weight | `FLOOR(Strength)` |
| Acrobatics | `FLOOR((Dexterity + Registration) × 0.5)` |
| Stamina | `FLOOR(Dexterity)` |
| Reaction Time | `FLOOR((Dexterity + Intuition) × 0.5)` |
| Health | `FLOOR(Constitution)` |
| Endurance | `FLOOR((Health + Constitution) × 0.5)` |
| Pain Tolerance | `FLOOR((Endurance + Strength) × 0.5)` |
| Sight Distance | `FLOOR(Perception)` |
| Intuition | `FLOOR(Perception)` |
| Registration | `FLOOR(Perception)` |
| Mana | `FLOOR(Arcane)` |
| Control | `FLOOR((Arcane + Mana) × 0.5)` |
| Sensitivity | `FLOOR((Intuition + Arcane) × 0.5)` |
| Charisma | `FLOOR(Will)` |
| Mental Fortitude | `FLOOR((Will + Charisma) × 0.5)` |
| Courage | `FLOOR((Mental Fortitude + Charisma) × 0.5)` |

The complete structure is:

```text
Final Substat = Derived Substat + Permanent Direct Bonus
```

## 3.4 Direct Substat Bonuses

A character may increase a core stat, which automatically improves related substats. A character may also receive or spend an increase directly on one substat.

Direct substat increases are stored as **permanent bonuses** and are not erased when the core stat changes.

Example:

```text
Strength = 25
Lifting derived from Strength = 25
Permanent Lifting bonus = +4
Final Lifting = 29
```

If Strength later increases to 26:

```text
New Lifting derived from Strength = 26
Permanent Lifting bonus remains +4
Final Lifting = 30
```

Final substat values, including permanent direct bonuses, are used by downstream formulas.

Example:

```text
Perception = 20
Registration permanent bonus = +10
Final Registration = 30

Dexterity = 26
Acrobatics = FLOOR((26 + 30) × 0.5)
Acrobatics = 28
```

A direct bonus to Health therefore improves Endurance, and a direct bonus to Endurance improves Pain Tolerance.

## 3.5 Health Points

Maximum HP is based on the Health substat and a racial HP multiplier.

```text
Maximum HP = Health × Racial HP Multiplier
```

Examples:

```text
Human:
Health 10 × Racial Multiplier 50 = 500 HP

Demon:
Health 100 × Racial Multiplier 50 = 5,000 HP
```

Racial HP multipliers are set by the race or creature template approved by the GM.

## 3.6 Soft Stat Cap

A value of **400** is the current soft cap for statistics used by the standard action and movement tables.

Statistics may exceed 400. Progression, thresholds, and benefits beyond 400 are determined by the GM until additional high-level rules are defined.

---

# 4. Defensive Statistics

## 4.1 Armor Class

Armor Class represents a character’s passive ability to avoid an attack when they do not spend an action point on an active defense.

```text
Armor Class = FLOOR(Dexterity × 0.5)
```

Armor does not normally increase Armor Class.

When a defender has no action point available, or chooses not to react, a physical attack roll is compared against AC.

```text
Attack Roll >= Armor Class: Hit
Attack Roll < Armor Class: Miss
```

## 4.2 Resistance

Resistance is percentage-based damage reduction.

A character may have:

- General physical resistance
- General magical resistance
- Resistance to a specific physical damage type
- Resistance to a specific magical damage type
- Total damage resistance from a special effect

Resistance may be granted by:

- Armor
- Shields that explicitly provide it
- Character level
- Skills
- Spells
- Accessories
- Items
- Creature or racial traits

### Stacking Resistance

Resistance is additive.

```text
20% Resistance + 20% Resistance = 40% Resistance
```

Resistance is capped at 100%.

At 100% resistance, the character is immune to that damage type unless a special rule bypasses immunity.

### Resistance Formula

```text
Damage Taken = FLOOR(Damage Inflicted × (1 - Resistance))
```

Resistance is expressed as a decimal in calculations.

Example:

```text
Damage Inflicted = 100
Resistance = 30% = 0.30

Damage Taken = FLOOR(100 × (1 - 0.30))
Damage Taken = 70
```

When an effect halves damage, halve the damage first and apply resistance afterward.

```text
Damage Taken after failed Block
= FLOOR((Damage Inflicted × 0.5) × (1 - Resistance))
```

---

# 5. Skill Checks

Skill checks resolve non-combat actions and actions not given a more specific combat procedure.

Examples include:

- Jumping across a chasm
- Climbing a wall
- Running for an extended period
- Identifying a magical effect
- Persuading an NPC
- Noticing a hidden creature
- Remaining calm under mental pressure

A skill check uses the governing stat or substat and the character’s proficiency with the relevant skill.

```text
Skill Check
= FLOOR((1 + Skill Proficiency) × (d100 / 100) × Governing Stat)
```

If no specific skill proficiency applies, treat proficiency as 0%.

```text
Untrained Check
= FLOOR(1 × (d100 / 100) × Governing Stat)
```

The GM sets a Difficulty Class.

```text
Check Result >= DC: Success
Check Result < DC: Failure
```

### Example: Acrobatics Check

A character has:

- Acrobatics 40
- Relevant proficiency 50%, or `0.50`
- d100 result 70

```text
FLOOR((1 + 0.50) × 0.70 × 40)
= FLOOR(42)
= 42
```

### Advantage and Disadvantage

Roll two d100s and use the higher result for advantage or the lower result for disadvantage.

Natural 1 and natural 100 effects on ordinary skill checks are determined by the GM.

---

# 6. Equipment

## 6.1 Weapons

Weapons provide:

- A base damage value
- A governing stat
- One or more physical damage types
- A reach
- A weapon type
- A proficiency growth rate
- Optional stat bonuses, skills, traits, or special effects

A weapon skill may only be used while the required weapon is equipped unless the skill explicitly says otherwise.

### Weapon Types

Weapon categories may include:

- Long swords
- Short swords
- Spears and polearms
- Shields
- Pugilist weapons
- Staves
- Bows
- Throwing weapons
- Knives
- Axes

Example weapons include:

- Long sword, great sword, claymore, zweihänder, katana
- Short sword, arming sword, falchion, tachi, wakizashi
- Spear, pike, javelin, naginata, halberd
- Great shield, tower shield, round shield, buckler, kite shield
- Gauntlets, knuckles, wraps
- Quarterstaff, fire staff, magical staff
- Longbow, short bow, crossbow, compound bow, recurve bow
- Throwing knives, stones, javelins, slingshots, tomahawks
- Tanto, karambit, bayonet, dagger
- Battleaxe, tomahawk, Viking axe, bardiche

A GM may add additional weapon types and place a weapon in the category that best fits its use.

### Weapon Reach

Weapon reach determines how far away the wielder may be when making an attack.

Reach does not independently change damage or accuracy unless the weapon states otherwise.

## 6.2 Armor

Armor grants resistance rather than Armor Class.

### Light Armor

Examples:

- Padded armor
- Leather armor
- Studded leather armor

Light armor:

- Provides relatively low resistance
- Does not modify AC
- Does not normally impose disadvantage on Dodge

### Medium Armor

Examples:

- Hide armor
- Chain shirt

Medium armor:

- Provides more resistance than light armor
- Does not modify AC
- Does not normally impose disadvantage on Dodge unless the armor says otherwise

### Heavy Armor

Heavy armor:

- Provides high resistance
- Does not increase AC
- Imposes disadvantage on Dodge rolls
- Makes the wearer less likely to avoid all damage, while reducing damage that connects

The older phrase “disadvantage on AC” is replaced by **disadvantage on Dodge rolls**.

## 6.3 Shields

Equipping a shield normally grants advantage on Block attempts.

Shields do not automatically increase AC or resistance unless the specific shield says that they do.

A shield may be required for certain Block actions.

## 6.4 Accessories

Accessories include:

- Rings
- Necklaces
- Capes
- Belts
- Charms
- Other non-armor equipment

Accessories may provide:

- Stat or substat bonuses
- Skills
- Resistance
- Proficiency bonuses
- Special effects
- Other magical properties

Accessories with meaningful bonuses are generally rare or expensive.

## 6.5 Items and Consumables

Items may be ordinary or possess GM-defined special properties.

Consumables:

- Are ingested or otherwise used up
- Are normally single-use
- May grant temporary or permanent effects
- Cost one action point to use during combat unless the item says otherwise

---

# 7. Proficiency System

## 7.1 What Is Proficiency?

Every weapon type, individual special weapon, skill, and spell may have its own proficiency value.

Proficiency ranges from:

```text
0% to 100%
```

A character normally begins at 0% proficiency unless character creation, background, prior history, an item, or the GM grants a different starting value.

Proficiency is capped at 100% under the base rules.

## 7.2 How Proficiency Affects Rolls

Whenever proficiency appears in a formula, use:

```text
1 + Proficiency
```

At 0% proficiency:

```text
1 + 0.00 = 1.00
```

At 100% proficiency:

```text
1 + 1.00 = 2.00
```

A novice can still attempt the action, while a master receives twice the base statistical scaling.

## 7.3 Increasing Proficiency

Proficiency increases by using the associated weapon, spell, or skill.

**The use does not need to succeed.**

Examples:

- Swinging a sword and missing can still increase sword proficiency.
- Casting a spell that is Dodged can still increase spell proficiency.
- Attempting a skill check and failing can still increase skill proficiency.

Each weapon, skill, or spell has its own proficiency growth rate.

Examples:

- A simple weapon might gain 1% per qualifying use.
- A difficult weapon might gain 0.1% per qualifying use.
- A powerful spell might progress more slowly than a basic spell.

The GM determines what counts as meaningful use and may prevent repetitive, consequence-free actions from being exploited solely to gain proficiency.

## 7.4 Downtime Training

During downtime, a character may train with a weapon, spell, or skill to gain proficiency.

Downtime may represent:

- Days
- Weeks
- Months
- Years

The GM determines:

- How much time is available
- What training resources are required
- How much proficiency is gained
- Whether a teacher, manual, facility, or special item changes the result

## 7.5 Mastery

Reaching 100% proficiency means the character has **mastered** that weapon type, skill, or spell.

Mastery may:

- Unlock higher-rank spells
- Unlock more advanced skills
- Permit use of powerful weapons
- Add range, damage, reduced mana cost, or secondary effects
- Fulfill prerequisites for unique abilities

## 7.6 Weapon Proficiency

Most ordinary weapons use a broad weapon-type proficiency.

Example:

- A cutlass, short sword, and similar one-handed blade may use Short Sword proficiency.
- A long sword and comparable blades may use Long Sword proficiency.

A legendary or unique weapon may require mastery of its weapon type before it can be wielded. It may then use its own separate proficiency.

Example:

```text
Requirement to wield Excalibur:
100% Long Sword proficiency

After equipping Excalibur:
Excalibur gains and uses its own proficiency value
```

## 7.7 Skill Proficiency

Each distinct skill may have its own proficiency.

Skill proficiency affects associated skill checks and any special formulas listed by that skill.

## 7.8 Spell Proficiency

Each spell has its own proficiency.

Spell proficiency affects:

- Spell to-hit rolls
- Spell damage
- Overload checks
- Any spell-specific effects that reference proficiency

Some higher-rank spells may require mastery of one or more lower-rank spells.

---

# 8. Leveling and Stat Points

Characters gain experience points by defeating monsters, completing quests, and overcoming challenges.

Each level has an XP threshold. Upon reaching that threshold, the character levels up.

The system does not normally lock skills or spells directly behind character level. Instead, access is determined by:

- Statistics
- Proficiency
- Mastery
- Equipment
- Spell prerequisites
- Story or GM requirements

## 8.1 Assigned Stat Points

When a character levels up, the GM assigns stat points among the six core stats.

These points may be assigned:

- Randomly
- According to character development
- According to recent activity
- By GM discretion

Assigned points normally increase core stats and therefore indirectly increase related substats.

## 8.2 Unassigned Stat Points

Unassigned stat points are rarer rewards that the player may allocate.

They may be granted for:

- Completing a quest
- Using a special item
- Reaching a milestone
- Training
- Other GM-approved accomplishments

An unassigned point may increase:

- A core stat, or
- A single substat directly

A direct substat increase becomes a permanent direct bonus and contributes to downstream formulas.

---

# 9. Magic and Mana

## 9.1 Mana Pool

The Mana substat and Arcane core stat determine total mana.

```text
Maximum Mana = Arcane × Mana
```

Example:

```text
Arcane = 28
Mana = 28

Maximum Mana = 28 × 28
Maximum Mana = 784
```

## 9.2 Mana Regeneration

Base mana regeneration is:

```text
10% of maximum mana per hour
```

The GM may alter regeneration due to:

- Rest
- Environment
- Items
- Skills
- Injuries
- Magical effects
- Race or creature traits

## 9.3 Casting Requirements

Each spell has a minimum mana cost.

A character cannot cast a spell if they do not have enough mana to pay the complete cost.

Mana is spent when the cast is committed, including mana committed to an overload attempt.

## 9.4 Spell Information

A spell entry should normally list:

- Name
- Rank
- Damage type
- Base mana cost
- Base damage
- Range
- Area of effect, if any
- Overload modifier
- Proficiency growth rate
- Special effects
- Prerequisites

---

# 10. Combat

## 10.1 Turn Order

A surprise round grants the surprising side a free round before normal turn order takes effect, as determined by the GM.

Normal turn order is determined by a Dexterity check.

```text
Initiative = FLOOR((d100 / 100) × Dexterity)
```

The highest result acts first.

Ties are resolved by GM discretion unless another rule determines priority.

Once established, turn order remains unchanged for the combat unless the GM or a specific effect changes it.

## 10.2 Action Points

Action points are the shared resource used for actions and reactions.

They may be spent on:

- Attacking
- Extra movement
- Disengaging
- Blocking
- Dodging physical attacks
- Parrying
- Opportunity attacks
- Readied actions
- Using consumables
- Breaking a grapple
- Other actions defined by a skill, spell, item, or the GM

There is no separate reaction pool.

A reaction is simply an action point spent outside the character’s own turn.

### Action Pool Rules

- Action points reset at the start of the character’s own turn.
- Unspent action points do not carry over after that reset.
- Action points spent during the character’s turn are unavailable for reactions before the next turn.
- Action points spent as reactions reduce what remains until the character’s next turn.
- A character may make any number of reactions while action points remain and the trigger conditions are met.

### Reaction Time Thresholds

| Reaction Time | Action Points |
|---:|---:|
| 0 | 1 |
| 20 | 2 |
| 40 | 3 |
| 60 | 4 |
| 80 | 5 |
| 100 | 8 |
| 130 | 9 |
| 160 | 10 |
| 190 | 11 |
| 220 | 12 |
| 250 | 13 |
| 280 | 14 |
| 310 | 15 |
| 340 | 16 |
| 400 | 20 |

Use the greatest threshold that the character meets.

Example:

```text
Reaction Time 175 meets the 160 threshold.
The character has 10 action points.
```

Values beyond 400 are handled by GM discretion.

## 10.3 Movement

Each character receives one free normal movement allocation on their turn unless an external effect prevents or modifies it.

Movement may be spent at any point during the character’s turn.

A character may spend one action point to Dash, gaining another full normal movement allocation.

A character may Dash multiple times if action points remain.

Example:

```text
Normal Movement = 30 feet

Free movement = 30 feet
One Dash = +30 feet
Two Dashes = +60 feet

Total with two Dashes = 90 feet
```

### Dexterity Movement Thresholds

| Dexterity | Movement |
|---:|---:|
| 0 | 10 ft |
| 20 | 20 ft |
| 40 | 30 ft |
| 60 | 40 ft |
| 80 | 50 ft |
| 100 | 100 ft |
| 130 | 120 ft |
| 160 | 140 ft |
| 190 | 160 ft |
| 220 | 180 ft |
| 250 | 200 ft |
| 280 | 220 ft |
| 310 | 240 ft |
| 340 | 260 ft |
| 400 | 300 ft |

Use the greatest threshold that the character meets.

Values beyond 400 are handled by GM discretion.

## 10.4 Ready an Action

A character may ready an action instead of resolving it immediately.

To ready an action:

1. Declare the action being prepared.
2. Declare the triggering condition.
3. Spend the action point immediately.
4. Resolve the prepared action out of turn when the trigger occurs.

Example:

> “I ready an action to cast Fireball when the goblin takes a step.”

Rules:

- A character may ready only one action per turn.
- The action point is spent when the action is readied.
- If the trigger does not occur before the character’s next turn, the readied action is lost.
- A readied action resolves out of turn.
- Readied actions use normal attack, spell, and defense rules.

## 10.5 Armor Class and Reactions

When targeted by a physical attack, the defender chooses whether to spend an action point on a reaction before the opposed rolls are resolved.

The defender may choose:

- No reaction
- Dodge
- Block
- Parry

If no reaction is used, the attack is compared against AC.

If a reaction is used, the attack is resolved as an opposed roll instead of using AC.

The defender wins ties.

## 10.6 Physical Attacks

### Physical Damage Types

The basic physical damage types are:

- **Piercing:** Spears, arrows, thrusting weapons, and other attacks that puncture
- **Slashing:** Swords, knives, scimitars, axes, and other cutting attacks
- **Bludgeoning:** Maces, clubs, fists, impacts, and other crushing attacks

A weapon may deal more than one damage type.

### Governing Stat

Each weapon identifies its governing stat.

Common examples:

- Strength for heavy blades, axes, clubs, and powerful melee weapons
- Dexterity for finesse weapons, bows, and precision attacks

### Step 1: Declare the Attack

The attacker declares:

- The weapon or attack
- The target
- Any special skill or modifier being used

### Step 2: Defender Chooses a Reaction

The defender chooses whether to spend an action point on Dodge, Block, or Parry.

If the defender has no action point, or chooses not to react, the attack uses AC.

### Step 3: Roll to Hit

```text
Physical Attack Roll
= FLOOR((1 + Weapon Proficiency)
× (d100 / 100)
× Weapon Governing Stat)
```

This is a separate roll from damage.

### Step 4A: No Reaction

Compare the attack roll to AC.

```text
Attack Roll >= AC: Hit
Attack Roll < AC: Miss
```

### Step 4B: Reaction

Compare the physical attack roll against the defender’s reaction result.

```text
Attack Roll > Defense Roll: Attacker wins
Defense Roll >= Attack Roll: Defender wins
```

The defender wins ties.

### Step 5: Roll Damage

On a successful hit, make a separate damage roll.

```text
Physical Damage
= FLOOR(
Weapon Base Damage
+ (1 + Weapon Proficiency)
× (d100 / 100)
× Weapon Governing Stat
)
```

Apply critical effects, Block reductions, and resistance in the appropriate order.

### Natural 1 and Natural 100

- Natural 1 on the physical attack roll is an automatic critical failure. The attack misses, and the GM may apply an additional consequence.
- Natural 100 on the physical attack roll is a critical hit. Roll damage normally, then double the total.

## 10.7 Dodge

Dodge is an active attempt to avoid an attack completely.

A physical Dodge costs one action point.

```text
Dodge Roll
= FLOOR(Dexterity × (d100 / 100))
```

Dodge is rolled with disadvantage when:

- Used while in melee range
- The defender is wearing heavy armor
- The defender is grappled
- Another effect explicitly imposes disadvantage

### Dodge Outcomes

If the Dodge result meets or exceeds the attack roll:

- The defender takes no damage.
- The defender moves 5 feet in a direction of their choice.

If the Dodge fails:

- The defender takes full damage.
- The defender still moves 5 feet in a direction of their choice.

The forced 5-foot Dodge movement:

- Occurs on success or ordinary failure
- Does not occur while the defender is grappled
- May provoke opportunity attacks from creatures other than the attacker who caused the Dodge
- Is prevented on a natural 1

### Natural 100 Dodge

On a natural 100, the Dodge succeeds and the defender may move as far as 10 feet instead of the normal 5 feet.

### Natural 1 Dodge

On a natural 1:

- The Dodge automatically fails.
- The defender takes full damage.
- The defender does not move.

### Dodging Area-of-Effect Attacks

If the Dodge succeeds and the movement carries the defender outside the area:

- The defender takes no damage.

If the Dodge succeeds but the defender remains inside the area:

- The defender takes half damage.

If the Dodge fails:

- The defender takes full damage.

Resistance applies after any Dodge-based damage reduction.

## 10.8 Block

Block is a conservative defense that attempts to absorb or stop an attack.

Block costs one action point.

Block normally requires:

- A shield, or
- An appropriate equipped weapon, or
- An ability or item that permits blocking

```text
Block Roll
= FLOOR(Strength × (d100 / 100))
```

A shield normally grants advantage on the Block roll.

### Block Outcomes

If the Block result meets or exceeds the attack roll:

- The defender takes no damage.

If the Block fails:

- The defender takes half damage.

Apply resistance after halving the damage.

```text
Failed Block Damage
= FLOOR((Damage × 0.5) × (1 - Resistance))
```

### Natural 100 Block

On a natural 100:

- The Block succeeds.
- The defender may also protect one adjacent ally affected by the same area-of-effect attack or by the same multi-attack sequence occurring during that turn.

### Natural 1 Block

On a natural 1:

- The Block automatically fails.
- The defender takes full damage rather than half damage.
- Resistance still applies normally.

## 10.9 Parry

Parry is a high-risk defense that attempts to reverse the attack and damage the attacker.

Parry costs one action point.

Parry requires:

- An equipped weapon capable of parrying, or
- A skill that explicitly allows the character to parry

The defender chooses either:

- The equipped weapon’s proficiency, or
- A separate Parry Skill proficiency, if unlocked

```text
Parry Roll
= FLOOR(
(1 + Chosen Proficiency)
× (d100 / 100)
× Weapon Governing Stat
)
```

The weapon’s governing stat is used. Parry does not automatically use Dexterity.

### Parry Outcomes

If the Parry result meets or exceeds the attack roll:

- The defender wins the contest.
- The defender immediately rolls normal weapon damage against the attacker.
- The Parry roll itself functions as the counterattack’s attack roll.
- The original attacker cannot react to the counterattack damage.

If the Parry fails:

- The original attacker rolls damage normally.
- The defender takes full damage after resistance.

### Natural 100 Parry

On a natural 100:

- The Parry succeeds.
- The counterattack’s final damage is doubled.

### Natural 1 Parry

On a natural 1:

- The Parry automatically fails.
- The defender takes full damage.
- The defender is disarmed.

A disarmed weapon lands in an adjacent space.

Retrieving the weapon costs one action point if the character can reach it.

## 10.10 Opportunity Attacks

An opportunity attack is a reaction and costs one action point.

A character may make any number of opportunity attacks as long as:

- They have remaining action points.
- A valid trigger occurs.
- They are capable of making the attack.

An opportunity attack triggers when a creature:

1. Leaves the attacker’s melee range, or
2. Passes through and then leaves the attacker’s melee range

Voluntary and involuntary movement may trigger an opportunity attack.

Each separate exit from melee range is a separate trigger.

Example:

1. A target leaves an enemy’s reach.
2. The enemy spends one action point to make an opportunity attack.
3. The target re-enters the reach.
4. The target leaves again.
5. The enemy may spend another action point for another opportunity attack.

The target of an opportunity attack may spend an action point to Dodge, Block, or Parry it normally.

### Disengage

A character may spend one action point to Disengage.

Disengaging prevents opportunity attacks caused by that character leaving enemy reach during the relevant movement, subject to specific effects and GM adjudication.

---

# 11. Magical Combat

Magical attacks use magical damage types such as:

- Fire
- Water
- Earth
- Wind
- Light
- Dark
- Lightning
- Ice
- Time
- Gravity
- Psychic

A spell may introduce additional damage types.

## 11.1 Spell Attack Sequence

### Step 1: Declare and Pay

The caster declares:

- The spell
- The target or area
- Any overload tier
- Any special modifier

The caster must have enough mana to pay the complete cost.

### Step 2: Spell To-Hit Roll

The caster makes a spell to-hit roll.

```text
Spell To-Hit
= FLOOR(
(1 + Spell Proficiency)
× (d100 / 100)
× Arcane
)
```

The result becomes the defense DC for the target.

### Natural 1 Spell To-Hit

A natural 1 causes the spell to miss automatically.

- The defender does not need to Dodge or Block.
- The spell does not affect the intended target.
- Mana is still spent unless a spell says otherwise.

### Natural 100 Spell To-Hit

A natural 100 is a critical spell attack.

- The defender still receives the normal defensive choice.
- If the spell deals damage, roll damage normally and double the final total if the spell is not successfully defended against.

### Step 3: Defender Chooses Dodge or Block

The defender must choose one option before making a defense roll:

- Free Spell Dodge
- Paid Spell Block

The defender cannot attempt Dodge, see the result, and then attempt Block.

A spell cannot normally be Parried.

Special skills, spells, equipment, or GM-created rules may introduce other magical defenses.

## 11.2 Free Spell Dodge

Every defender receives one free Dodge attempt against a spell that can be Dodged.

This Dodge:

- Costs no action point
- Can be attempted with zero action points remaining
- Uses the normal Dodge formula
- Uses the spell’s to-hit result as the DC
- Follows normal Dodge movement
- Has disadvantage in melee range
- Has disadvantage in heavy armor
- Has disadvantage while grappled
- Uses normal natural 1 and natural 100 Dodge rules

```text
Spell Dodge
= FLOOR(Dexterity × (d100 / 100))
```

The defender wins ties.

```text
Dodge >= Spell To-Hit: Dodge succeeds
Dodge < Spell To-Hit: Dodge fails
```

For a single-target spell:

- Successful Dodge: no damage
- Failed Dodge: full damage
- Normal success or failure: move 5 feet
- Natural 100: may move as far as 10 feet
- Natural 1: full damage and no movement

For an area-of-effect spell:

- Successful Dodge that exits the area: no damage
- Successful Dodge that remains inside the area: half damage
- Failed Dodge: full damage

A grappled target may attempt the free spell Dodge with disadvantage but does not receive the Dodge movement.

## 11.3 Spell Block

A character may choose to Block a spell by spending one action point.

Block normally requires a shield, suitable weapon, ability, or item.

Choosing Spell Block means the spell is guaranteed to connect with the defender. The Block roll determines how much damage is taken.

```text
Spell Block
= FLOOR(Strength × (d100 / 100))
```

Compare the Block result against the spell’s to-hit result.

The defender wins ties.

### Spell Block Outcomes

If the Block succeeds:

- The defender takes no damage.

If the Block fails:

- The defender takes half damage.

On a natural 1:

- The defender takes full damage.

Resistance applies after any Block reduction.

The defender does not receive a free Dodge after choosing Block.

## 11.4 Spell Damage

Spell damage is rolled separately from the spell to-hit roll.

```text
Spell Damage
= FLOOR(
(1 + Spell Proficiency)
× (d100 / 100)
× Arcane
+ Base Spell Damage
)
```

For an overloaded spell, replace Base Spell Damage with Overloaded Base Damage.

Apply:

1. Critical doubling, if applicable
2. Dodge or Block reduction, if applicable
3. Resistance

---

# 12. Overloading Spells

## 12.1 What Is Overloading?

Overloading occurs when a caster forces more mana into a spell than it normally contains.

Overloading can:

- Increase spell damage
- Greatly increase mana cost
- Introduce a risk of failure
- Cause a dangerous explosion centered on the caster

A spell may be overloaded up to five tiers.

The spell’s overload modifier determines how effectively additional overload tiers increase its base damage.

## 12.2 Overload Modifier

Each spell has an Overload Modifier.

The modifier is written as a decimal.

Examples:

| Example Spell | Rank | Overload Modifier |
|---|---:|---:|
| Firebolt | F | 0.20 |
| Example large spell | B | 0.75 |
| Example mega spell | SS+ | 2.00 |

The spell’s listed modifier is authoritative.

The following rank values may be used as general design references, but a specific spell may differ.

| Rank | Suggested Overload Modifier |
|---|---:|
| F | 0.20 |
| F+ | 0.25 |
| E | 0.30 |
| E+ | 0.35 |
| D | 0.45 |
| D+ | 0.55 |
| C | 0.60 |
| C+ | 0.65 |
| B | 0.70 |
| B+ | 0.85 |
| A | 1.00 |
| A+ | 1.30 |
| S | 1.60 |
| S+ | 1.80 |
| SS | 1.90 |
| SS+ | 2.00 |

## 12.3 Overload Mana Cost

Let `M` be the spell’s base mana cost.

| Overload Tier | Additional Mana | Total Mana Cost |
|---:|---:|---:|
| 1 | `+10% of M` | `1.10 × M` |
| 2 | `+50% of M` | `1.50 × M` |
| 3 | `+100% of M` | `2.00 × M` |
| 4 | `+200% of M` | `3.00 × M` |
| 5 | `+500% of M` | `6.00 × M` |

Example with a base cost of 20 mana:

| Tier | Total Cost |
|---:|---:|
| 1 | 22 |
| 2 | 30 |
| 3 | 40 |
| 4 | 60 |
| 5 | 120 |

Round down if a mana calculation produces a fraction.

## 12.4 Overloaded Base Damage

```text
Overloaded Base Damage
= Base Spell Damage
× (1 + Overload Modifier × Overload Tier)
```

Example: Firebolt

```text
Base Damage = 15
Overload Modifier = 0.20
Tier = 3

Overloaded Base Damage
= 15 × (1 + 0.20 × 3)
= 15 × 1.60
= 24
```

The spell’s final damage roll becomes:

```text
Final Overloaded Spell Damage
= FLOOR(
(1 + Spell Proficiency)
× (d100 / 100)
× Arcane
+ Overloaded Base Damage
)
```

## 12.5 Overload Check

Each overload tier requires a Control check modified by proficiency with that spell.

```text
Overload Check
= FLOOR(
(d100 / 100)
× Control
× (1 + Spell Proficiency)
)
```

Compare the result against the GM-assigned Overload DC.

```text
Overload Check >= DC: Success
Overload Check < DC: Failure
```

The GM selects the DC based on:

- Spell rank
- Spell design
- Overload tier
- Expected caster Control
- Situation
- Campaign power level
- Other relevant effects

The reference table below is guidance, not a mandatory universal formula.

## 12.6 Multiple-Tier Attempts

To cast at a higher overload tier, roll each tier in sequence.

Example: Attempting Tier 3

1. Roll the Tier 1 Overload check.
2. If successful, roll the Tier 2 Overload check.
3. If successful, roll the Tier 3 Overload check.
4. If all three succeed, cast at Tier 3.
5. If any tier fails, resolve an overload failure at the tier that failed.

## 12.7 Arbitrary Reference DC Values

These values show what may be reasonable for casters near the listed Control levels. The GM may change them freely.

| Caster Band | Assumed Maximum Control | Rank | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Low-Level Mage | 50 | F | 2.5 | 10 | 17.5 | 20 | 25 |
| Low-Level Mage | 50 | F+ | 2.5 | 10 | 17.5 | 20 | 25 |
| Adept Mage | 100 | E | 5 | 20 | 35 | 40 | 50 |
| Adept Mage | 100 | E+ | 5 | 20 | 35 | 40 | 50 |
| Journeyman | 200 | D | 10 | 40 | 70 | 80 | 100 |
| Journeyman | 200 | D+ | 10 | 40 | 70 | 80 | 100 |
| Slightly Better | 400 | C | 20 | 80 | 140 | 160 | 200 |
| Slightly Better | 400 | C+ | 20 | 80 | 140 | 160 | 200 |
| Established | 600 | B | 30 | 120 | 210 | 240 | 300 |
| Established | 600 | B+ | 30 | 120 | 210 | 240 | 300 |
| Naked Max Rank | 800 | A | 40 | 160 | 280 | 320 | 400 |
| Naked Max Rank | 800 | A+ | 40 | 160 | 280 | 320 | 400 |
| Archmage | 1,000 | S | 50 | 200 | 350 | 400 | 500 |
| Archmage | 1,000 | S+ | 50 | 200 | 350 | 400 | 500 |
| Legendary | 1,200 | SS | 60 | 240 | 420 | 480 | 600 |
| Legendary | 1,200 | SS+ | 60 | 240 | 420 | 480 | 600 |

## 12.8 Overload Failure

When an overload check fails:

1. All mana committed to the attempted overloaded cast is consumed.
2. The intended spell fails to affect its original target.
3. The spell explodes in an area centered on the caster.
4. Use the overload tier that failed.
5. Determine the spell’s damage as though using that failed tier.
6. The explosion deals half of that overloaded damage.
7. Apply resistance normally.

```text
Explosion Damage
= FLOOR(Failed-Tier Overloaded Spell Damage × 0.5)
```

The caster cannot Dodge their own overload explosion.

Other affected creatures may Dodge the explosion using the normal area-of-effect Dodge rules.

A natural 1 on an Overload check is resolved by GM discretion and will usually cause an especially severe or catastrophic failure.

---

# 13. Critical Rolls

Natural 1 and natural 100 effects depend on the type of roll.

## 13.1 General Rule

- A natural 1 automatically fails regardless of the calculated result.
- With advantage or disadvantage, only the kept die determines a natural 1 or 100.
- The defender wins numerical ties, but a natural 1 still fails automatically.

## 13.2 Critical Reference Table

| Roll Type | Natural 1 | Natural 100 |
|---|---|---|
| Physical Attack | Automatic miss; additional effect by GM | Roll damage normally, then double total damage |
| Spell To-Hit | Spell automatically misses; no defense roll required | Spell is critical; if not defended, roll damage normally and double total |
| Dodge | Full damage and no 5-foot movement | Dodge succeeds; may move as far as 10 feet |
| Block | Full damage instead of half | Block succeeds and may protect one adjacent ally from the same AOE or multi-attack |
| Parry | Full damage and disarmed | Parry succeeds and counterattack damage is doubled |
| Skill Check | GM discretion | GM discretion |
| Grapple Check | GM discretion | GM discretion |
| Overload Check | GM discretion; usually catastrophic | GM discretion |

## 13.3 Damage Doubling

When damage is doubled:

1. Roll and calculate damage normally.
2. Apply the critical doubling to the total.
3. Apply defense-based reductions.
4. Apply resistance.

Unless a specific ability states a different order.

---

# 14. Other Actions

## 14.1 Grappling

A character may attempt to grapple another character by:

- Spending one action point on their turn, or
- Using a readied action

### Initial Grapple Check

The attacker and defender make contested Strength checks.

```text
Grapple Check
= FLOOR(Strength × (d100 / 100))
```

The defender does not need to spend an action point to make the initial contested Strength check.

The defender wins ties.

If the attacker wins:

- The defender becomes grappled.

If the defender wins:

- The grapple fails.

### Alternative Defenses

Instead of the free contested Strength check, the defender may spend one action point to:

- Dodge the grapple, or
- Parry the grapple

A grapple cannot be Blocked.

### Parrying a Grapple

If the defender Parries the grapple:

- On failure, the defender is grappled.
- On success, the defender chooses one:
  - Grapple the attacker, or
  - Make an attack roll against the attacker

### Breaking a Grapple

A grappled character may spend an action point to attempt to escape.

The grappler and grappled character make another contested Strength check.

- If the grappled character wins, the grapple ends.
- If the grappler wins or ties, the grapple continues.

Natural 1 and natural 100 results on grapple checks are determined by the GM.

## 14.2 Flanking

A character may flank a target by taking an advantageous position behind or around it.

Requirements:

- At least one ally must also be within attacking range of the target.
- The target must have a meaningful front and back.
- A creature without a meaningful orientation cannot normally be flanked.

A flanking attacker gains advantage on contested checks against the target.

## 14.3 Attacking Unconscious Targets

An attack against an unconscious target automatically critically hits.

The attack deals:

```text
Maximum Possible Damage × 2
```

For a formula that uses a d100 damage roll, treat the damage roll as 100 before doubling.

---

# 15. Status Effects and Conditions

## 15.1 Grappled

A grappled character:

- May make attacks, but does so with disadvantage.
- May spend action points to attempt to break free.
- May attempt to Dodge a spell with disadvantage.
- Does not receive the normal 5-foot Dodge movement while grappled.
- May not Block the grapple that initially applies the condition.
- May attempt to maneuver the grappler into the path of an incoming attack.

To maneuver the grappler into an incoming attack:

- Make a contested Strength check.
- The grappled character makes the check with disadvantage.
- On success, the GM redirects the attack as appropriate.

Physical attacks from a creature other than the grappler automatically hit the grappled target unless a more specific rule overrides this.

A grappled character may still be subject to damage rolls, resistance, and special effects normally.

## 15.2 Disarmed

A disarmed character drops the relevant weapon into an adjacent space.

Retrieving the weapon costs one action point if the character is able to reach it.

A character without the required weapon cannot use attacks, skills, Blocks, or Parries that require that weapon.

## 15.3 Unconscious

An unconscious creature:

- Cannot take normal actions or reactions.
- Is automatically critically hit by attacks.
- Takes maximum possible damage doubled from such attacks, subject to applicable resistance and special rules.

Additional unconsciousness, recovery, death, and stabilization rules are determined by the GM or campaign rules until formally defined.

---

# 16. Quick Combat Reference

## 16.1 Universal Formulas

```text
Armor Class
= FLOOR(Dexterity × 0.5)
```

```text
Physical Attack Roll
= FLOOR((1 + Weapon Proficiency)
× (d100 / 100)
× Weapon Governing Stat)
```

```text
Physical Damage
= FLOOR(
Weapon Base Damage
+ (1 + Weapon Proficiency)
× (d100 / 100)
× Weapon Governing Stat
)
```

```text
Dodge
= FLOOR(Dexterity × (d100 / 100))
```

```text
Block
= FLOOR(Strength × (d100 / 100))
```

```text
Parry
= FLOOR(
(1 + Chosen Proficiency)
× (d100 / 100)
× Weapon Governing Stat
)
```

```text
Spell To-Hit
= FLOOR(
(1 + Spell Proficiency)
× (d100 / 100)
× Arcane
)
```

```text
Spell Damage
= FLOOR(
(1 + Spell Proficiency)
× (d100 / 100)
× Arcane
+ Base Spell Damage
)
```

```text
Skill Check
= FLOOR(
(1 + Skill Proficiency)
× (d100 / 100)
× Governing Stat
)
```

```text
Overload Check
= FLOOR(
(d100 / 100)
× Control
× (1 + Spell Proficiency)
)
```

```text
Overloaded Base Damage
= Base Spell Damage
× (1 + Overload Modifier × Tier)
```

```text
Damage after Resistance
= FLOOR(Damage × (1 - Resistance))
```

## 16.2 Physical Attack Flow

1. Attacker declares the attack.
2. Defender chooses no reaction, Dodge, Block, or Parry.
3. Attacker rolls the physical attack roll.
4. If no reaction, compare against AC.
5. If reacting, make the opposed defense roll.
6. Defender wins ties.
7. Resolve the reaction outcome.
8. If damage is dealt, make a separate damage roll.
9. Apply critical effects, reductions, and resistance.

## 16.3 Spell Attack Flow

1. Caster declares the spell and pays mana.
2. Caster rolls Spell To-Hit.
3. Natural 1: spell misses; stop.
4. Defender chooses free Dodge or paid Block.
5. Resolve the chosen defense against the Spell To-Hit result.
6. If damage is dealt, make a separate Spell Damage roll.
7. Natural 100 on Spell To-Hit doubles final spell damage.
8. Apply defense reduction and resistance.

## 16.4 Defense Outcomes

| Defense | Success | Ordinary Failure | Natural 1 |
|---|---|---|---|
| Dodge | No damage; move 5 ft | Full damage; move 5 ft | Full damage; no movement |
| Block | No damage | Half damage | Full damage |
| Parry | Counterattack damage | Full incoming damage | Full incoming damage and disarmed |

---

# 17. GM Adjudication and Unlisted Rules

The Chip TTRPG System is intended to support extreme progression, creative abilities, and unusual combat situations. Not every possible interaction can be covered by the base rules.

The GM has final authority over:

- Difficulty Classes
- Statistics and progression beyond 400
- Race and creature multipliers
- Proficiency growth rates
- Overload DCs
- Natural 1 and natural 100 effects not explicitly defined
- New status effects
- Unusual magical defenses
- Environmental interactions
- Edge cases involving movement, timing, or simultaneous effects
- Rules for death, recovery, and stabilization
- Any situation not addressed in this document

Where no Chip TTRPG rule exists, the GM may use a familiar D&D-style convention as a temporary fallback, modify that convention to fit the system’s larger numerical scale, or create a ruling appropriate to the scene.

Specific abilities, equipment, spells, creature traits, and campaign rules override the general rules when they explicitly say that they do.

---

# End of Revised Draft
