from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal

from backend.features.formula_runtime.service import evaluate_numeric_formula
from backend.state.models.damage import PHYSICAL_DAMAGE_TYPES
from backend.state.models.formula import Formula, FormulaAliases

if TYPE_CHECKING:
    from backend.state.models.sheet import Sheet


FactSubjectType = Literal["sheet", "item", "action"]
FactValueType = Literal["number", "boolean", "text", "enum", "reference", "list"]
FactStoredValueType = Literal[
    "number", "formula", "boolean", "text", "enum", "reference", "list"
]
FactVisibility = Literal["public", "gm_only"]
FactProfile = Literal["weapon"]
EvaluatedFactValue = float | int | bool | str | list[str] | None

AMOUNT_OF_REACTIONS_FACT_ID = "amount_of_reactions"
AMOUNT_OF_REACTIONS_RELATIONSHIP_ID = "required_fact_amount_of_reactions"
WEAPON_FACT_PROFILE = "weapon"
WEAPON_TYPE_FACT_ID = "weapon_type"
WEAPON_BASE_DAMAGE_FACT_ID = "weapon_base_damage"
WEAPON_GOVERNING_STAT_FACT_ID = "weapon_governing_stat"
WEAPON_DAMAGE_TYPES_FACT_ID = "weapon_damage_types"
WEAPON_REACH_FACT_ID = "weapon_reach"
WEAPON_PROFICIENCY_FACT_ID = "weapon_proficiency"
WEAPON_PROFICIENCY_GROWTH_RATE_FACT_ID = "weapon_proficiency_growth_rate"

WEAPON_FACT_IDS = (
    WEAPON_TYPE_FACT_ID,
    WEAPON_BASE_DAMAGE_FACT_ID,
    WEAPON_GOVERNING_STAT_FACT_ID,
    WEAPON_DAMAGE_TYPES_FACT_ID,
    WEAPON_REACH_FACT_ID,
    WEAPON_PROFICIENCY_FACT_ID,
    WEAPON_PROFICIENCY_GROWTH_RATE_FACT_ID,
)
ACTION_RANK_FACT_ID = "action_rank"
ACTION_RANGE_FACT_ID = "action_range"
ACTION_TARGET_COUNT_FACT_ID = "action_target_count"
ACTION_AREA_FACT_ID = "action_area"
ACTION_MANA_COST_FACT_ID = "action_mana_cost"
ACTION_BASE_SPELL_DAMAGE_FACT_ID = "action_base_spell_damage"
ACTION_PROFICIENCY_FACT_ID = "action_proficiency"

ACTION_FACT_IDS = (
    ACTION_RANK_FACT_ID,
    ACTION_RANGE_FACT_ID,
    ACTION_TARGET_COUNT_FACT_ID,
    ACTION_AREA_FACT_ID,
    ACTION_MANA_COST_FACT_ID,
    ACTION_BASE_SPELL_DAMAGE_FACT_ID,
    ACTION_PROFICIENCY_FACT_ID,
)


@dataclass
class FactValue:
    type: FactStoredValueType
    value: float | int | bool | str | list[str] | None = None
    formula: Formula | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "FactValue":
        value_type = raw["type"]
        formula_raw = raw.get("formula")
        return cls(
            type=value_type,
            value=raw.get("value"),
            formula=(
                Formula.from_dict(formula_raw)
                if isinstance(formula_raw, dict)
                else None
            ),
        )


@dataclass
class FactDefinition:
    id: str
    name: str
    description: str
    subject_types: list[FactSubjectType]
    value_type: FactValueType
    default_value: FactValue
    unit: str = ""
    visibility: FactVisibility = "public"
    validation_options: list[str] = field(default_factory=list)
    reference_kind: str | None = None
    required: bool = False
    required_profile: FactProfile | None = None
    backend_owned: bool = False

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "FactDefinition":
        return cls(
            id=raw["id"],
            name=raw["name"],
            description=raw.get("description", ""),
            subject_types=list(raw.get("subject_types", [])),
            value_type=raw["value_type"],
            default_value=FactValue.from_dict(raw["default_value"]),
            unit=raw.get("unit", ""),
            visibility=raw.get("visibility", "public"),
            validation_options=list(raw.get("validation_options", [])),
            reference_kind=raw.get("reference_kind"),
            required=bool(raw.get("required", False)),
            required_profile=raw.get("required_profile"),
            backend_owned=bool(raw.get("backend_owned", False)),
        )


@dataclass
class FactBridge:
    relationship_id: str
    fact_id: str
    value: FactValue
    evaluated_value: EvaluatedFactValue = None
    evaluation_error: str | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "FactBridge":
        return cls(
            relationship_id=raw["relationship_id"],
            fact_id=raw["fact_id"],
            value=FactValue.from_dict(raw["value"]),
            evaluated_value=raw.get("evaluated_value"),
            evaluation_error=raw.get("evaluation_error"),
        )


def amount_of_reactions_definition() -> FactDefinition:
    return FactDefinition(
        id=AMOUNT_OF_REACTIONS_FACT_ID,
        name="Amount of Reactions",
        description=(
            "Informational derived reaction amount. Combat spending and turn "
            "enforcement remain manual."
        ),
        subject_types=["sheet"],
        value_type="number",
        default_value=FactValue(
            type="formula",
            formula=Formula(
                text="@registration + @reaction_time",
                aliases=[
                    FormulaAliases(
                        name="registration",
                        path=["stats", "registration"],
                    ),
                    FormulaAliases(
                        name="reaction_time",
                        path=["stats", "reaction_time"],
                    ),
                ],
            ),
        ),
        unit="reactions",
        visibility="public",
        required=True,
        backend_owned=True,
    )


def weapon_fact_definitions() -> dict[str, FactDefinition]:
    shared = {
        "subject_types": ["item"],
        "visibility": "public",
        "required": True,
        "required_profile": WEAPON_FACT_PROFILE,
        "backend_owned": True,
    }
    definitions = (
        FactDefinition(
            id=WEAPON_TYPE_FACT_ID,
            name="Weapon Type",
            description="Authored weapon family or form, such as Sword or Bow.",
            value_type="text",
            default_value=FactValue(type="text", value=""),
            **shared,
        ),
        FactDefinition(
            id=WEAPON_BASE_DAMAGE_FACT_ID,
            name="Base Damage",
            description="Flat weapon damage used by eligible weapon actions.",
            value_type="number",
            default_value=FactValue(type="number", value=0),
            unit="damage",
            **shared,
        ),
        FactDefinition(
            id=WEAPON_GOVERNING_STAT_FACT_ID,
            name="Governing Stat",
            description="Core sheet stat used by eligible weapon actions.",
            value_type="enum",
            default_value=FactValue(type="enum", value="strength"),
            validation_options=[
                "strength",
                "dexterity",
                "constitution",
                "perception",
                "arcane",
                "will",
            ],
            **shared,
        ),
        FactDefinition(
            id=WEAPON_DAMAGE_TYPES_FACT_ID,
            name="Physical Damage Types",
            description="Physical damage types this weapon can deal.",
            value_type="list",
            default_value=FactValue(type="list", value=[]),
            validation_options=list(PHYSICAL_DAMAGE_TYPES),
            **shared,
        ),
        FactDefinition(
            id=WEAPON_REACH_FACT_ID,
            name="Reach",
            description="Authored reach for display and future eligible actions.",
            value_type="number",
            default_value=FactValue(type="number", value=0),
            **shared,
        ),
        FactDefinition(
            id=WEAPON_PROFICIENCY_FACT_ID,
            name="Proficiency",
            description="Proficiency definition used by eligible weapon actions.",
            value_type="reference",
            default_value=FactValue(type="reference", value=""),
            reference_kind="proficiency",
            **shared,
        ),
        FactDefinition(
            id=WEAPON_PROFICIENCY_GROWTH_RATE_FACT_ID,
            name="Proficiency Growth Rate",
            description="Growth rate supplied when this weapon grants proficiency use.",
            value_type="number",
            default_value=FactValue(type="number", value=0),
            **shared,
        ),
    )
    return {definition.id: definition for definition in definitions}


def required_fact_definitions() -> dict[str, FactDefinition]:
    definition = amount_of_reactions_definition()
    return {definition.id: definition, **weapon_fact_definitions()}


def action_fact_definitions() -> dict[str, FactDefinition]:
    shared = {
        "subject_types": ["action"],
        "visibility": "public",
        "required": False,
        "backend_owned": True,
    }
    rank_options = [
        "F",
        "F+",
        "E",
        "E+",
        "D",
        "D+",
        "C",
        "C+",
        "B",
        "B+",
        "A",
        "A+",
        "S",
        "S+",
        "SS",
        "SS+",
    ]
    definitions = (
        FactDefinition(
            id=ACTION_RANK_FACT_ID,
            name="Rank",
            description="Authored action or skill rank.",
            value_type="enum",
            default_value=FactValue(type="enum", value="F"),
            validation_options=rank_options,
            **shared,
        ),
        FactDefinition(
            id=ACTION_RANGE_FACT_ID,
            name="Range",
            description="Informational action range unless a step explicitly consumes it.",
            value_type="number",
            default_value=FactValue(type="number", value=0),
            **shared,
        ),
        FactDefinition(
            id=ACTION_TARGET_COUNT_FACT_ID,
            name="Target Count",
            description="Informational target count; it does not enforce targeting.",
            value_type="number",
            default_value=FactValue(type="number", value=1),
            unit="targets",
            **shared,
        ),
        FactDefinition(
            id=ACTION_AREA_FACT_ID,
            name="Area",
            description="Informational area or shape description.",
            value_type="text",
            default_value=FactValue(type="text", value=""),
            **shared,
        ),
        FactDefinition(
            id=ACTION_MANA_COST_FACT_ID,
            name="Mana Cost",
            description="Authored mana cost; no resource change occurs unless a step uses it.",
            value_type="number",
            default_value=FactValue(type="number", value=0),
            unit="mana",
            **shared,
        ),
        FactDefinition(
            id=ACTION_BASE_SPELL_DAMAGE_FACT_ID,
            name="Base Spell Damage",
            description="Flat spell damage available to eligible spell formulas.",
            value_type="number",
            default_value=FactValue(type="number", value=0),
            unit="damage",
            **shared,
        ),
        FactDefinition(
            id=ACTION_PROFICIENCY_FACT_ID,
            name="Proficiency",
            description="Proficiency definition used by eligible action formulas.",
            value_type="reference",
            default_value=FactValue(type="reference", value=""),
            reference_kind="proficiency",
            **shared,
        ),
    )
    return {definition.id: definition for definition in definitions}


def backend_fact_definitions() -> dict[str, FactDefinition]:
    return {**required_fact_definitions(), **action_fact_definitions()}


def default_amount_of_reactions_bridge() -> FactBridge:
    definition = amount_of_reactions_definition()
    return FactBridge(
        relationship_id=AMOUNT_OF_REACTIONS_RELATIONSHIP_ID,
        fact_id=definition.id,
        value=definition.default_value,
    )


class _FactFormulaRoot:
    def __init__(self, subject: Any, fact_values: dict[str, EvaluatedFactValue]) -> None:
        self._subject = subject
        self.facts = fact_values

    def __getattr__(self, name: str) -> Any:
        return getattr(self._subject, name)


class _LazyFactValues(dict[str, EvaluatedFactValue]):
    def __init__(self, subject: Any, resolver: Any) -> None:
        super().__init__()
        self._subject = subject
        self._resolver = resolver

    def __contains__(self, fact_id: object) -> bool:
        return isinstance(fact_id, str) and fact_id in self._subject.facts

    def __getitem__(self, fact_id: str) -> EvaluatedFactValue:
        return self._resolver(fact_id)


def evaluate_all_subject_facts(subject: Any) -> None:
    evaluated: dict[str, EvaluatedFactValue] = {}
    visiting: list[str] = []

    def evaluate_bridge(fact_id: str) -> EvaluatedFactValue:
        if fact_id in evaluated:
            return evaluated[fact_id]
        if fact_id in visiting:
            cycle = " -> ".join([*visiting[visiting.index(fact_id) :], fact_id])
            raise ValueError(f"Fact formula cycle detected: {cycle}.")
        bridge = subject.facts.get(fact_id)
        if bridge is None:
            raise ValueError(f"Referenced Fact '{fact_id}' is not attached to this subject.")

        visiting.append(fact_id)
        try:
            if bridge.value.type == "formula":
                if bridge.value.formula is None:
                    raise ValueError("Formula Fact value is missing its formula payload.")
                for alias in bridge.value.formula.aliases or []:
                    if alias.path and alias.path[0] == "facts":
                        if len(alias.path) != 2:
                            raise ValueError(
                                f"Fact alias '{alias.name}' must reference facts.<fact_id>."
                            )
                        evaluate_bridge(alias.path[1])
                result = evaluate_numeric_formula(
                    _FactFormulaRoot(
                        subject,
                        _LazyFactValues(subject, evaluate_bridge),
                    ),
                    bridge.value.formula,
                )
            else:
                result = bridge.value.value
            evaluated[fact_id] = result
            bridge.evaluated_value = result
            bridge.evaluation_error = None
            return result
        finally:
            visiting.pop()

    for fact_id, bridge in subject.facts.items():
        try:
            evaluate_bridge(fact_id)
        except (AttributeError, KeyError, SyntaxError, TypeError, ValueError) as exc:
            bridge.evaluated_value = None
            bridge.evaluation_error = str(exc)


def require_valid_subject_fact_evaluation(
    subject: Any,
    fact_ids: set[str] | None = None,
) -> None:
    invalid = next(
        (
            (fact_id, bridge.evaluation_error)
            for fact_id, bridge in subject.facts.items()
            if (fact_ids is None or fact_id in fact_ids)
            and bridge.evaluation_error is not None
        ),
        None,
    )
    if invalid is not None:
        fact_id, error = invalid
        raise ValueError(f"Fact '{fact_id}' could not be evaluated: {error}")


def validate_sheet_formula_dependencies(sheet: "Sheet") -> None:
    formulas: dict[str, Formula] = {}
    for stat_name, value in vars(sheet.stats).items():
        if isinstance(value, Formula):
            formulas[f"stats.{stat_name}"] = value
    for fact_id, bridge in sheet.facts.items():
        if bridge.value.type == "formula" and bridge.value.formula is not None:
            formulas[f"facts.{fact_id}"] = bridge.value.formula

    graph: dict[str, set[str]] = {node: set() for node in formulas}
    for node, formula in formulas.items():
        for alias in formula.aliases or []:
            if len(alias.path) != 2 or alias.path[0] not in {"stats", "facts"}:
                continue
            target = f"{alias.path[0]}.{alias.path[1]}"
            if alias.path[0] == "facts" and alias.path[1] not in sheet.facts:
                raise ValueError(
                    f"Formula alias '{alias.name}' references Fact "
                    f"'{alias.path[1]}', but it is not attached to this sheet."
                )
            if target in formulas:
                graph[node].add(target)

    visiting: list[str] = []
    visited: set[str] = set()

    def visit(node: str) -> None:
        if node in visiting:
            cycle = " -> ".join([*visiting[visiting.index(node) :], node])
            raise ValueError(f"Sheet formula dependency cycle detected: {cycle}.")
        if node in visited:
            return
        visiting.append(node)
        for target in sorted(graph[node]):
            visit(target)
        visiting.pop()
        visited.add(node)

    for node in sorted(graph):
        visit(node)


def evaluate_all_sheet_facts(sheet: "Sheet") -> None:
    evaluate_all_subject_facts(sheet)


def evaluate_sheet_fact_bridge(sheet: "Sheet", bridge: FactBridge) -> None:
    current = sheet.facts.get(bridge.fact_id)
    sheet.facts[bridge.fact_id] = bridge
    try:
        evaluate_all_sheet_facts(sheet)
    finally:
        if current is None:
            sheet.facts.pop(bridge.fact_id, None)
        else:
            sheet.facts[bridge.fact_id] = current


def synchronize_required_sheet_facts(sheet: "Sheet") -> None:
    bridge = sheet.facts.get(AMOUNT_OF_REACTIONS_FACT_ID)
    if bridge is None:
        bridge = default_amount_of_reactions_bridge()
        sheet.facts[AMOUNT_OF_REACTIONS_FACT_ID] = bridge
    bridge.fact_id = AMOUNT_OF_REACTIONS_FACT_ID
    bridge.relationship_id = AMOUNT_OF_REACTIONS_RELATIONSHIP_ID
    evaluate_all_sheet_facts(sheet)


def synchronize_all_sheet_facts(sheet: "Sheet") -> None:
    synchronize_required_sheet_facts(sheet)
    evaluate_all_sheet_facts(sheet)


def synchronize_required_item_facts(
    item: Any,
    definitions: dict[str, FactDefinition],
) -> None:
    active_profile = item.fact_profile
    for fact_id, definition in definitions.items():
        if definition.required_profile is None:
            continue
        if definition.required_profile != active_profile:
            item.facts.pop(fact_id, None)
            continue
        bridge = item.facts.get(fact_id)
        if bridge is None:
            bridge = FactBridge(
                relationship_id=f"required_fact_{fact_id}",
                fact_id=fact_id,
                value=deepcopy(definition.default_value),
            )
            item.facts[fact_id] = bridge
        bridge.fact_id = fact_id
        bridge.relationship_id = f"required_fact_{fact_id}"
    evaluate_all_subject_facts(item)
