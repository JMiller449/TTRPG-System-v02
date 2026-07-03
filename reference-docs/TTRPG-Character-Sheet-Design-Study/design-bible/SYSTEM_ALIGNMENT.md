# Chip System Alignment

This document translates the supplied rules and stat materials into frontend requirements. It is not a new rules specification and does not resolve contradictions; backend models and current authored definitions remain authoritative.

## System traits that materially affect the sheet

### Big-number readability

The rules are intentionally built around large stats, HP totals, and damage values. The UI must therefore:

- use tabular numerals;
- reserve enough width for at least five-digit values;
- avoid small circular score badges that work only for values below 100;
- use separators for values at 1,000 and above when the backend’s formatting conventions permit;
- keep exact numbers visible even when a progress bar is present.

### Six main stats and eighteen related substats

The supplied structure is:

| Main stat | Related substats |
|---|---|
| Strength | Lifting, Carry Weight |
| Dexterity | Acrobatics, Stamina, Reaction Time |
| Constitution | Health, Endurance, Pain Tolerance |
| Perception | Sight Distance, Intuition, Registration |
| Arcane | Mana, Control, Sensitivity |
| Will | Charisma, Mental Fortitude, Courage |

This is why the study uses six `StatCluster` cards rather than a flat list of 24 independent values. The grouping teaches the system and makes scanning easier.

### Analog proficiency progression

Proficiency is a continuous progression value rather than a simple proficient/not-proficient flag. A proficiency surface should show:

- current proficiency value or tier;
- progress/use count toward the next threshold when available;
- the weapon, ability, or parry domain;
- source and attached sheet/item context;
- a resolved roll preview only when the backend provides it.

Avoid a binary checkmark treatment.

### Action and reaction economy

Actions are a primary combat resource and reactions include Dodge, Block, and Parry. The sheet should keep both current actions and reactions in the persistent resource strip. They should not be buried in the Actions tab.

The UI must also distinguish:

- an action usable on the character’s turn;
- a reaction usable out of turn;
- a readied action;
- an action that is unavailable because the pool is empty;
- an action that is unavailable because equipment or another prerequisite is missing.

The sample action cards therefore put `Cost` and a plain-language unavailable reason in the first layer.

### Skill checks and roll mode

General checks use a d100-based calculation against a governing stat, with advantage taking the higher result and disadvantage taking the lower result. The UI implication is that a roll control needs an explicit mode state:

- Normal
- Advantage
- Disadvantage

The selected mode should be announced and included in the request intent. The component kit leaves this as parent-provided action data because the backend must own roll resolution.

### Critical endpoints

Natural 1 and 100 have special outcomes. The UI may use stronger result formatting after the backend resolves a roll, but it must not infer a critical from a locally generated number. Roll20 remains the public table log in the current architecture.

### Health, mana, resistance, and damage

- Health is derived from race modifier and Constitution in the supplied rules.
- Mana is a core Arcane-related resource.
- Resistance is percentage-based damage reduction and may be modified by armor, shields, level, skills, and items.
- Damage depends on proficiency, d100 result, and governing stat.

Frontend consequences:

- health and mana use current/max resource widgets;
- resistance belongs in a compact defensive summary with units (`%`);
- formulas and modifier provenance are inspectable but secondary to resolved values;
- the frontend does not independently apply resistance or damage.

### Defensive reactions

Dodge, Block, and Parry have materially different outcomes. Do not collapse them into a generic `Defend` button unless it opens an explicit choice surface. Each action should show its governing basis and consequence summary.

Suggested first-layer summaries:

- **Dodge:** Dexterity contest; avoid damage on success; melee may impose disadvantage.
- **Block:** Strength contest; reduce damage on success; requires compatible equipment.
- **Parry:** Weapon/proficiency contest; may counterattack on success.

### Conditions and positional facts

Grappled and flanking affect checks and attack outcomes. Conditions should be visually prominent because they change the meaning of other controls. A player should not have to remember an invisible modifier.

The backend should ideally provide a concise player-facing impact string for each applied condition. Until then, the parent can map authored condition definitions into `ConditionViewModel.summary`.

## Recommended player overview for this system

1. Identity and sync state.
2. Health, Mana, Actions, Reactions.
3. Active conditions that change checks or defense.
4. Six main-stat clusters and substats.
5. Resistance summary.
6. Passive facts/effects.
7. Proficiency highlights.

## Recommended action categories

- Attack
- Defense
- Magic
- Movement
- Utility
- Item
- Readied

These are display categories only. They should not become a new backend enum unless the domain model intentionally adopts them.

## Source material used

- `Chip TTRPG System.pdf`
- `Chip DND Phys Combat System.txt`
- `Abilitys and _substats_.xlsx`
- current repo domain models and frontend sheet components

Where source documents and current backend models differ, the implementation must follow the current backend contract and treat the documents as design context.
