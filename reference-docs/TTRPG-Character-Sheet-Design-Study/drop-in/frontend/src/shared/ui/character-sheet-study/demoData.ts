import type { CharacterSheetViewModel } from "./types";

const roll = (label: string) => (): void => { console.info(`Roll intent: ${label}`); };
const perform = (label: string) => (): void => { console.info(`Action intent: ${label}`); };

export const studyDemoCharacter: CharacterSheetViewModel = {
  hero: {
    name: "Mara Voss",
    eyebrow: "Active character",
    subtitle: "Human Vanguard · Ash Company",
    level: 12,
    badges: ["Frontline", "Longsword", "Arcane Initiate"],
    syncStatus: { state: "synced", detail: "State version 184" },
    resources: [
      { id: "health", label: "Health", value: 520, max: 650, tone: "health", onDecrease: perform("Damage"), onIncrease: perform("Heal") },
      { id: "mana", label: "Mana", value: 140, max: 200, tone: "mana", onDecrease: perform("Spend mana"), onIncrease: perform("Restore mana") },
      { id: "actions", label: "Actions", value: 6, max: 10, tone: "action" },
      { id: "reactions", label: "Reactions", value: 2, max: 3, tone: "reaction" }
    ]
  },
  stats: [
    { id: "strength", label: "Strength", value: 70, hint: "Power and physical force", onRoll: roll("Strength"), substats: [
      { id: "lifting", label: "Lifting", value: 84, onRoll: roll("Lifting") },
      { id: "carry_weight", label: "Carry Weight", value: 280, hint: "lb" }
    ]},
    { id: "dexterity", label: "Dexterity", value: 55, hint: "Speed and coordination", onRoll: roll("Dexterity"), substats: [
      { id: "acrobatics", label: "Acrobatics", value: 61, onRoll: roll("Acrobatics") },
      { id: "stamina", label: "Stamina", value: 63, onRoll: roll("Stamina") },
      { id: "reaction_time", label: "Reaction Time", value: 68, onRoll: roll("Reaction Time") }
    ]},
    { id: "constitution", label: "Constitution", value: 65, hint: "Health and endurance", onRoll: roll("Constitution"), substats: [
      { id: "health", label: "Health", value: 650 },
      { id: "endurance", label: "Endurance", value: 64, onRoll: roll("Endurance") },
      { id: "pain_tolerance", label: "Pain Tolerance", value: 67, onRoll: roll("Pain Tolerance") }
    ]},
    { id: "perception", label: "Perception", value: 68, hint: "Awareness and processing", onRoll: roll("Perception"), substats: [
      { id: "sight_distance", label: "Sight Distance", value: 74, onRoll: roll("Sight Distance") },
      { id: "intuition", label: "Intuition", value: 71, onRoll: roll("Intuition") },
      { id: "registration", label: "Registration", value: 73, onRoll: roll("Registration") }
    ]},
    { id: "arcane", label: "Arcane", value: 34, hint: "Magic capacity and control", onRoll: roll("Arcane"), substats: [
      { id: "mana", label: "Mana", value: 200 },
      { id: "control", label: "Control", value: 49, onRoll: roll("Control") },
      { id: "sensitivity", label: "Sensitivity", value: 53, onRoll: roll("Sensitivity") }
    ]},
    { id: "will", label: "Will", value: 76, hint: "Resolve and presence", onRoll: roll("Will"), substats: [
      { id: "charisma", label: "Charisma", value: 72, onRoll: roll("Charisma") },
      { id: "mental_fortitude", label: "Mental Fortitude", value: 81, onRoll: roll("Mental Fortitude") },
      { id: "courage", label: "Courage", value: 78, onRoll: roll("Courage") }
    ]}
  ],
  actions: [
    { id: "longsword", name: "Longsword Strike", category: "Attack", summary: "Resolve a strength-based weapon attack and send the result to the table log.", cost: "1 action", tags: ["Strength", "Slashing"], rollLabel: "Roll damage", isFavorite: true, onPerform: perform("Longsword Strike") },
    { id: "parry", name: "Parry", category: "Defense", summary: "Contest an incoming physical attack with the equipped weapon proficiency.", cost: "1 reaction", tags: ["Weapon", "Counter"], rollLabel: "Roll parry", isFavorite: true, onPerform: perform("Parry") },
    { id: "dodge", name: "Dodge", category: "Defense", summary: "Contest the attack using Dexterity. Melee attempts may be disadvantaged.", cost: "1 reaction", tags: ["Dexterity", "Movement"], rollLabel: "Roll dodge", onPerform: perform("Dodge") },
    { id: "block", name: "Block", category: "Defense", summary: "Contest with Strength to reduce incoming damage.", cost: "1 reaction", tags: ["Strength", "Shield"], rollLabel: "Roll block", disabledReason: "No compatible shield or weapon equipped" },
    { id: "focus", name: "Focus Mana", category: "Magic", summary: "Steady the flow of mana before a difficult spell or control check.", cost: "1 action", tags: ["Arcane", "Control"], rollLabel: "Make check", onPerform: perform("Focus Mana") },
    { id: "disengage", name: "Disengage", category: "Utility", summary: "Move out of an enemy’s reach without allowing an opportunity attack.", cost: "1 action", rollLabel: "Use action", onPerform: perform("Disengage") }
  ],
  conditions: [
    { id: "grappled", name: "Grappled", summary: "Attacks are made at disadvantage; attacks against this character are guaranteed to hit.", source: "Stone Brute", duration: "Until escaped", severity: "danger" },
    { id: "flanking", name: "Flanking Position", summary: "Gain advantage on applicable contested checks while the position is maintained.", duration: "Positional", severity: "info" }
  ],
  quickRolls: [
    { id: "q-long", label: "Longsword Strike", shortLabel: "Strike", onTrigger: perform("Longsword Strike") },
    { id: "q-parry", label: "Parry", onTrigger: perform("Parry") },
    { id: "q-dodge", label: "Dodge", onTrigger: perform("Dodge") },
    { id: "q-focus", label: "Focus Mana", shortLabel: "Focus", onTrigger: perform("Focus Mana") }
  ]
};
