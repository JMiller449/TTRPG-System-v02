from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal

from backend.features.formula_runtime.service import evaluate_numeric_formula
from backend.state.models.damage import PHYSICAL_DAMAGE_TYPES
from backend.state.models.formula import Formula, FormulaAliases

if TYPE_CHECKING:
    from backend.state.models.sheet import Sheet


AttributeSubjectType = Literal["sheet", "item", "action"]
AttributeValueType = Literal["number", "boolean", "text", "enum", "reference", "list"]
AttributeStoredValueType = Literal[
    "number", "formula", "boolean", "text", "enum", "reference", "list"
]
AttributeVisibility = Literal["public", "gm_only"]
AttributeProfile = Literal["weapon"]
EvaluatedAttributeValue = float | int | bool | str | list[str] | None

AMOUNT_OF_REACTIONS_ATTRIBUTE_ID = "amount_of_reactions"
AMOUNT_OF_REACTIONS_RELATIONSHIP_ID = "required_attribute_amount_of_reactions"
WEAPON_ATTRIBUTE_PROFILE = "weapon"
WEAPON_TYPE_ATTRIBUTE_ID = "weapon_type"
WEAPON_BASE_DAMAGE_ATTRIBUTE_ID = "weapon_base_damage"
WEAPON_GOVERNING_STAT_ATTRIBUTE_ID = "weapon_governing_stat"
WEAPON_DAMAGE_TYPES_ATTRIBUTE_ID = "weapon_damage_types"
WEAPON_REACH_ATTRIBUTE_ID = "weapon_reach"
WEAPON_PROFICIENCY_ATTRIBUTE_ID = "weapon_proficiency"
WEAPON_PROFICIENCY_GROWTH_RATE_ATTRIBUTE_ID = "weapon_proficiency_growth_rate"
LEVEL_ATTRIBUTE_ID = "level"
MOVEMENT_ATTRIBUTE_ID = "movement"
MANA_REGENERATION_ATTRIBUTE_ID = "mana_regeneration"
ITEM_ATTRIBUTE_ATTRIBUTE_ID = "item_attribute"
ITEM_MANA_EFFICIENCY_ATTRIBUTE_ID = "item_mana_efficiency"
ITEM_FLAT_EFFECT_BONUS_ATTRIBUTE_ID = "item_flat_effect_bonus"
ITEM_MANA_REGENERATION_MODIFIER_ATTRIBUTE_ID = "item_mana_regeneration_modifier"

WEAPON_ATTRIBUTE_IDS = (
    WEAPON_TYPE_ATTRIBUTE_ID,
    WEAPON_BASE_DAMAGE_ATTRIBUTE_ID,
    WEAPON_GOVERNING_STAT_ATTRIBUTE_ID,
    WEAPON_DAMAGE_TYPES_ATTRIBUTE_ID,
    WEAPON_REACH_ATTRIBUTE_ID,
    WEAPON_PROFICIENCY_ATTRIBUTE_ID,
    WEAPON_PROFICIENCY_GROWTH_RATE_ATTRIBUTE_ID,
)
ACTION_RANK_ATTRIBUTE_ID = "action_rank"
ACTION_RANGE_ATTRIBUTE_ID = "action_range"
ACTION_TARGET_COUNT_ATTRIBUTE_ID = "action_target_count"
ACTION_AREA_ATTRIBUTE_ID = "action_area"
ACTION_MANA_COST_ATTRIBUTE_ID = "action_mana_cost"
ACTION_BASE_SPELL_DAMAGE_ATTRIBUTE_ID = "action_base_spell_damage"
ACTION_PROFICIENCY_ATTRIBUTE_ID = "action_proficiency"

ACTION_ATTRIBUTE_IDS = (
    ACTION_RANK_ATTRIBUTE_ID,
    ACTION_RANGE_ATTRIBUTE_ID,
    ACTION_TARGET_COUNT_ATTRIBUTE_ID,
    ACTION_AREA_ATTRIBUTE_ID,
    ACTION_MANA_COST_ATTRIBUTE_ID,
    ACTION_BASE_SPELL_DAMAGE_ATTRIBUTE_ID,
    ACTION_PROFICIENCY_ATTRIBUTE_ID,
)

SHEET_ATTRIBUTE_IDS = (
    LEVEL_ATTRIBUTE_ID,
    MOVEMENT_ATTRIBUTE_ID,
    MANA_REGENERATION_ATTRIBUTE_ID,
)

ITEM_ATTRIBUTE_IDS = (
    ITEM_ATTRIBUTE_ATTRIBUTE_ID,
    ITEM_MANA_EFFICIENCY_ATTRIBUTE_ID,
    ITEM_FLAT_EFFECT_BONUS_ATTRIBUTE_ID,
    ITEM_MANA_REGENERATION_MODIFIER_ATTRIBUTE_ID,
)


@dataclass
class AttributeValue:
    type: AttributeStoredValueType
    value: float | int | bool | str | list[str] | None = None
    formula: Formula | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "AttributeValue":
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
class AttributeDefinition:
    id: str
    name: str
    description: str
    subject_types: list[AttributeSubjectType]
    value_type: AttributeValueType
    default_value: AttributeValue
    unit: str = ""
    visibility: AttributeVisibility = "public"
    validation_options: list[str] = field(default_factory=list)
    reference_kind: str | None = None
    required: bool = False
    required_profile: AttributeProfile | None = None
    backend_owned: bool = False

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "AttributeDefinition":
        return cls(
            id=raw["id"],
            name=raw["name"],
            description=raw.get("description", ""),
            subject_types=list(raw.get("subject_types", [])),
            value_type=raw["value_type"],
            default_value=AttributeValue.from_dict(raw["default_value"]),
            unit=raw.get("unit", ""),
            visibility=raw.get("visibility", "public"),
            validation_options=list(raw.get("validation_options", [])),
            reference_kind=raw.get("reference_kind"),
            required=bool(raw.get("required", False)),
            required_profile=raw.get("required_profile"),
            backend_owned=bool(raw.get("backend_owned", False)),
        )


@dataclass
class AttributeBridge:
    relationship_id: str
    attribute_id: str
    value: AttributeValue
    evaluated_value: EvaluatedAttributeValue = None
    evaluation_error: str | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "AttributeBridge":
        return cls(
            relationship_id=raw["relationship_id"],
            attribute_id=raw.get("attribute_id", raw.get("fact_id")),
            value=AttributeValue.from_dict(raw["value"]),
            evaluated_value=raw.get("evaluated_value"),
            evaluation_error=raw.get("evaluation_error"),
        )


def amount_of_reactions_definition() -> AttributeDefinition:
    return AttributeDefinition(
        id=AMOUNT_OF_REACTIONS_ATTRIBUTE_ID,
        name="Amount of Reactions",
        description=(
            "Informational derived reaction amount. Combat spending and turn "
            "enforcement remain manual."
        ),
        subject_types=["sheet"],
        value_type="number",
        default_value=AttributeValue(
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


def weapon_attribute_definitions() -> dict[str, AttributeDefinition]:
    shared = {
        "subject_types": ["item"],
        "visibility": "public",
        "required": True,
        "required_profile": WEAPON_ATTRIBUTE_PROFILE,
        "backend_owned": True,
    }
    definitions = (
        AttributeDefinition(
            id=WEAPON_TYPE_ATTRIBUTE_ID,
            name="Weapon Type",
            description="Authored weapon family or form, such as Sword or Bow.",
            value_type="text",
            default_value=AttributeValue(type="text", value=""),
            **shared,
        ),
        AttributeDefinition(
            id=WEAPON_BASE_DAMAGE_ATTRIBUTE_ID,
            name="Base Damage",
            description="Flat weapon damage used by eligible weapon actions.",
            value_type="number",
            default_value=AttributeValue(type="number", value=0),
            unit="damage",
            **shared,
        ),
        AttributeDefinition(
            id=WEAPON_GOVERNING_STAT_ATTRIBUTE_ID,
            name="Governing Stat",
            description="Core sheet stat used by eligible weapon actions.",
            value_type="enum",
            default_value=AttributeValue(type="enum", value="strength"),
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
        AttributeDefinition(
            id=WEAPON_DAMAGE_TYPES_ATTRIBUTE_ID,
            name="Physical Damage Types",
            description="Physical damage types this weapon can deal.",
            value_type="list",
            default_value=AttributeValue(type="list", value=[]),
            validation_options=list(PHYSICAL_DAMAGE_TYPES),
            **shared,
        ),
        AttributeDefinition(
            id=WEAPON_REACH_ATTRIBUTE_ID,
            name="Reach",
            description="Authored reach for display and future eligible actions.",
            value_type="number",
            default_value=AttributeValue(type="number", value=0),
            **shared,
        ),
        AttributeDefinition(
            id=WEAPON_PROFICIENCY_ATTRIBUTE_ID,
            name="Proficiency",
            description="Proficiency definition used by eligible weapon actions.",
            value_type="reference",
            default_value=AttributeValue(type="reference", value=""),
            reference_kind="proficiency",
            **shared,
        ),
        AttributeDefinition(
            id=WEAPON_PROFICIENCY_GROWTH_RATE_ATTRIBUTE_ID,
            name="Proficiency Growth Rate",
            description="Growth rate supplied when this weapon grants proficiency use.",
            value_type="number",
            default_value=AttributeValue(type="number", value=0),
            **shared,
        ),
    )
    return {definition.id: definition for definition in definitions}


def required_attribute_definitions() -> dict[str, AttributeDefinition]:
    definition = amount_of_reactions_definition()
    return {definition.id: definition, **weapon_attribute_definitions()}


def sheet_attribute_definitions() -> dict[str, AttributeDefinition]:
    shared = {
        "subject_types": ["sheet"],
        "visibility": "public",
        "required": False,
        "backend_owned": True,
    }
    definitions = (
        AttributeDefinition(
            id=LEVEL_ATTRIBUTE_ID,
            name="Level",
            description="Current character or creature level.",
            value_type="number",
            default_value=AttributeValue(type="number", value=1),
            **shared,
        ),
        AttributeDefinition(
            id=MOVEMENT_ATTRIBUTE_ID,
            name="Movement",
            description=(
                "Normal movement allocation for manual Roll20 play; this value is "
                "not enforced by the app."
            ),
            value_type="number",
            default_value=AttributeValue(type="number", value=30),
            unit="feet",
            **shared,
        ),
        AttributeDefinition(
            id=MANA_REGENERATION_ATTRIBUTE_ID,
            name="Mana Regeneration",
            description=(
                "Percent of maximum mana regenerated per hour. Time advancement "
                "and regeneration remain manual."
            ),
            value_type="number",
            default_value=AttributeValue(type="number", value=10),
            unit="% max mana per hour",
            **shared,
        ),
    )
    return {definition.id: definition for definition in definitions}


def action_attribute_definitions() -> dict[str, AttributeDefinition]:
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
        AttributeDefinition(
            id=ACTION_RANK_ATTRIBUTE_ID,
            name="Rank",
            description="Authored action or skill rank.",
            value_type="enum",
            default_value=AttributeValue(type="enum", value="F"),
            validation_options=rank_options,
            **shared,
        ),
        AttributeDefinition(
            id=ACTION_RANGE_ATTRIBUTE_ID,
            name="Range",
            description="Informational action range unless a step explicitly consumes it.",
            value_type="number",
            default_value=AttributeValue(type="number", value=0),
            **shared,
        ),
        AttributeDefinition(
            id=ACTION_TARGET_COUNT_ATTRIBUTE_ID,
            name="Target Count",
            description="Informational target count; it does not enforce targeting.",
            value_type="number",
            default_value=AttributeValue(type="number", value=1),
            unit="targets",
            **shared,
        ),
        AttributeDefinition(
            id=ACTION_AREA_ATTRIBUTE_ID,
            name="Area",
            description="Informational area or shape description.",
            value_type="text",
            default_value=AttributeValue(type="text", value=""),
            **shared,
        ),
        AttributeDefinition(
            id=ACTION_MANA_COST_ATTRIBUTE_ID,
            name="Mana Cost",
            description="Authored mana cost; no resource change occurs unless a step uses it.",
            value_type="number",
            default_value=AttributeValue(type="number", value=0),
            unit="mana",
            **shared,
        ),
        AttributeDefinition(
            id=ACTION_BASE_SPELL_DAMAGE_ATTRIBUTE_ID,
            name="Base Spell Damage",
            description="Flat spell damage available to eligible spell formulas.",
            value_type="number",
            default_value=AttributeValue(type="number", value=0),
            unit="damage",
            **shared,
        ),
        AttributeDefinition(
            id=ACTION_PROFICIENCY_ATTRIBUTE_ID,
            name="Proficiency",
            description="Proficiency definition used by eligible action formulas.",
            value_type="reference",
            default_value=AttributeValue(type="reference", value=""),
            reference_kind="proficiency",
            **shared,
        ),
    )
    return {definition.id: definition for definition in definitions}


def item_attribute_definitions() -> dict[str, AttributeDefinition]:
    shared = {
        "subject_types": ["item"],
        "visibility": "public",
        "required": False,
        "backend_owned": True,
    }
    definitions = (
        AttributeDefinition(
            id=ITEM_ATTRIBUTE_ATTRIBUTE_ID,
            name="Attribute",
            description=(
                "Authored item attribute such as Fire. Display data unless an "
                "eligible action or augmentation explicitly consumes it."
            ),
            value_type="text",
            default_value=AttributeValue(type="text", value=""),
            **shared,
        ),
        AttributeDefinition(
            id=ITEM_MANA_EFFICIENCY_ATTRIBUTE_ID,
            name="Mana Efficiency",
            description=(
                "Authored mana-conductivity efficiency. This does not execute "
                "mana behavior by itself."
            ),
            value_type="number",
            default_value=AttributeValue(type="number", value=100),
            unit="%",
            **shared,
        ),
        AttributeDefinition(
            id=ITEM_FLAT_EFFECT_BONUS_ATTRIBUTE_ID,
            name="Flat Effect Bonus",
            description=(
                "Flat bonus available as authored item data for eligible formulas "
                "or effects."
            ),
            value_type="number",
            default_value=AttributeValue(type="number", value=0),
            unit="bonus",
            **shared,
        ),
        AttributeDefinition(
            id=ITEM_MANA_REGENERATION_MODIFIER_ATTRIBUTE_ID,
            name="Mana Regeneration Modifier",
            description=(
                "Authored mana-regeneration modifier. Time advancement and "
                "regeneration remain manual."
            ),
            value_type="number",
            default_value=AttributeValue(type="number", value=0),
            unit="%",
            **shared,
        ),
    )
    return {definition.id: definition for definition in definitions}


def backend_attribute_definitions() -> dict[str, AttributeDefinition]:
    return {
        **required_attribute_definitions(),
        **sheet_attribute_definitions(),
        **action_attribute_definitions(),
        **item_attribute_definitions(),
    }


def default_amount_of_reactions_bridge() -> AttributeBridge:
    definition = amount_of_reactions_definition()
    return AttributeBridge(
        relationship_id=AMOUNT_OF_REACTIONS_RELATIONSHIP_ID,
        attribute_id=definition.id,
        value=definition.default_value,
    )


class _AttributeFormulaRoot:
    def __init__(self, subject: Any, attribute_values: dict[str, EvaluatedAttributeValue]) -> None:
        self._subject = subject
        self.attributes = attribute_values

    def __getattr__(self, name: str) -> Any:
        return getattr(self._subject, name)


class _LazyAttributeValues(dict[str, EvaluatedAttributeValue]):
    def __init__(self, subject: Any, resolver: Any) -> None:
        super().__init__()
        self._subject = subject
        self._resolver = resolver

    def __contains__(self, attribute_id: object) -> bool:
        return isinstance(attribute_id, str) and attribute_id in self._subject.attributes

    def __getitem__(self, attribute_id: str) -> EvaluatedAttributeValue:
        return self._resolver(attribute_id)


def evaluate_all_subject_attributes(subject: Any) -> None:
    evaluated: dict[str, EvaluatedAttributeValue] = {}
    visiting: list[str] = []

    def evaluate_bridge(attribute_id: str) -> EvaluatedAttributeValue:
        if attribute_id in evaluated:
            return evaluated[attribute_id]
        if attribute_id in visiting:
            cycle = " -> ".join([*visiting[visiting.index(attribute_id) :], attribute_id])
            raise ValueError(f"Attribute formula cycle detected: {cycle}.")
        bridge = subject.attributes.get(attribute_id)
        if bridge is None:
            raise ValueError(f"Referenced Attribute '{attribute_id}' is not attached to this subject.")

        visiting.append(attribute_id)
        try:
            if bridge.value.type == "formula":
                if bridge.value.formula is None:
                    raise ValueError("Formula Attribute value is missing its formula payload.")
                for alias in bridge.value.formula.aliases or []:
                    if alias.path and alias.path[0] == "attributes":
                        if len(alias.path) != 2:
                            raise ValueError(
                                f"Attribute alias '{alias.name}' must reference attributes.<attribute_id>."
                            )
                        evaluate_bridge(alias.path[1])
                result = evaluate_numeric_formula(
                    _AttributeFormulaRoot(
                        subject,
                        _LazyAttributeValues(subject, evaluate_bridge),
                    ),
                    bridge.value.formula,
                )
            else:
                result = bridge.value.value
            evaluated[attribute_id] = result
            bridge.evaluated_value = result
            bridge.evaluation_error = None
            return result
        finally:
            visiting.pop()

    for attribute_id, bridge in subject.attributes.items():
        try:
            evaluate_bridge(attribute_id)
        except (AttributeError, KeyError, SyntaxError, TypeError, ValueError) as exc:
            bridge.evaluated_value = None
            bridge.evaluation_error = str(exc)


def require_valid_subject_attribute_evaluation(
    subject: Any,
    attribute_ids: set[str] | None = None,
) -> None:
    invalid = next(
        (
            (attribute_id, bridge.evaluation_error)
            for attribute_id, bridge in subject.attributes.items()
            if (attribute_ids is None or attribute_id in attribute_ids)
            and bridge.evaluation_error is not None
        ),
        None,
    )
    if invalid is not None:
        attribute_id, error = invalid
        raise ValueError(f"Attribute '{attribute_id}' could not be evaluated: {error}")


def validate_sheet_formula_dependencies(sheet: "Sheet") -> None:
    formulas: dict[str, Formula] = {}
    for stat_name, value in vars(sheet.stats).items():
        if isinstance(value, Formula):
            formulas[f"stats.{stat_name}"] = value
    for attribute_id, bridge in sheet.attributes.items():
        if bridge.value.type == "formula" and bridge.value.formula is not None:
            formulas[f"attributes.{attribute_id}"] = bridge.value.formula

    graph: dict[str, set[str]] = {node: set() for node in formulas}
    for node, formula in formulas.items():
        for alias in formula.aliases or []:
            if len(alias.path) != 2 or alias.path[0] not in {"stats", "attributes"}:
                continue
            target = f"{alias.path[0]}.{alias.path[1]}"
            if alias.path[0] == "attributes" and alias.path[1] not in sheet.attributes:
                raise ValueError(
                    f"Formula alias '{alias.name}' references Attribute "
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


def evaluate_all_sheet_attributes(sheet: "Sheet") -> None:
    evaluate_all_subject_attributes(sheet)


def evaluate_sheet_attribute_bridge(sheet: "Sheet", bridge: AttributeBridge) -> None:
    current = sheet.attributes.get(bridge.attribute_id)
    sheet.attributes[bridge.attribute_id] = bridge
    try:
        evaluate_all_sheet_attributes(sheet)
    finally:
        if current is None:
            sheet.attributes.pop(bridge.attribute_id, None)
        else:
            sheet.attributes[bridge.attribute_id] = current


def synchronize_required_sheet_attributes(sheet: "Sheet") -> None:
    bridge = sheet.attributes.get(AMOUNT_OF_REACTIONS_ATTRIBUTE_ID)
    if bridge is None:
        bridge = default_amount_of_reactions_bridge()
        sheet.attributes[AMOUNT_OF_REACTIONS_ATTRIBUTE_ID] = bridge
    bridge.attribute_id = AMOUNT_OF_REACTIONS_ATTRIBUTE_ID
    bridge.relationship_id = AMOUNT_OF_REACTIONS_RELATIONSHIP_ID
    evaluate_all_sheet_attributes(sheet)


def synchronize_all_sheet_attributes(sheet: "Sheet") -> None:
    synchronize_required_sheet_attributes(sheet)
    evaluate_all_sheet_attributes(sheet)


def synchronize_required_item_attributes(
    item: Any,
    definitions: dict[str, AttributeDefinition],
) -> None:
    active_profile = item.attribute_profile
    for attribute_id, definition in definitions.items():
        if definition.required_profile is None:
            continue
        if definition.required_profile != active_profile:
            item.attributes.pop(attribute_id, None)
            continue
        bridge = item.attributes.get(attribute_id)
        if bridge is None:
            bridge = AttributeBridge(
                relationship_id=f"required_attribute_{attribute_id}",
                attribute_id=attribute_id,
                value=deepcopy(definition.default_value),
            )
            item.attributes[attribute_id] = bridge
        bridge.attribute_id = attribute_id
        bridge.relationship_id = f"required_attribute_{attribute_id}"
    evaluate_all_subject_attributes(item)
