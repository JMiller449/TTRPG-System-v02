from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from math import floor
from typing import Any, Literal
from uuid import uuid4

from backend.core.transport import PatchOp
from backend.features.augmentations import service as augmentation_service
from backend.features.action_history.service import record_action_history_entry
from backend.features.chat import service as chat_service
from backend.features.chat.schema import Roll20ChatMessage
from backend.features.formula_runtime.service import (
    EvaluationTimeEffect,
    FormulaExecutionContext,
    compose_roll20_message,
    evaluate_numeric_formula,
    evaluate_resource_maxima,
    normalize_numeric_result,
    resolve_roll_mode,
)
from backend.features.session.models import SessionRole
from backend.features.sheet_runtime.schema import (
    ActionExecuted,
    ApplyInstancedSheetDamage,
    PerformAction,
    SetInstancedSheetItemEquipped,
)
from backend.features.state_sync.service import state_sync_service
from backend.state.models.action import (
    Action,
    ApplyAugmentationStep,
    ApplyConditionPresetStep,
    CalculateValueStep,
    CalculatedValueReference,
    DecrementValueStep,
    FormulaReference,
    FormulaValueSource,
    GainProficiencyUseStep,
    IncrementValueStep,
    NumericValueSource,
    ResolveDamageStep,
    SendMessageStep,
    SetValueStep,
)
from backend.state.models.action_history import ActionHistoryEntry, ActionHistoryText
from backend.state.models.condition import ConditionSource
from backend.state.models.damage import (
    DamageType,
    damage_type_category,
    damage_type_resistance_key,
)
from backend.state.models.formula import Formula
from backend.state.models.attribute import (
    ACTION_PROFICIENCY_ATTRIBUTE_ID,
    WEAPON_GOVERNING_STAT_ATTRIBUTE_ID,
    WEAPON_PROFICIENCY_ATTRIBUTE_ID,
    WEAPON_ATTRIBUTE_PROFILE,
    AttributeBridge,
)
from backend.state.models.item import Item, ItemActionGrant, ItemBridge
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.models.state import State
from backend.state.store import StateSingleton


_D100_CHECK_PATTERN = re.compile(r"(?<![A-Za-z0-9_])1d100(?![A-Za-z0-9_])", re.IGNORECASE)
_ROLL20_COMMAND_PATTERN = re.compile(
    r"(?P<prefix>.*?/(?:roll|r)\s+)(?P<expression>.+)$",
    re.IGNORECASE,
)
_ROLL20_COMMAND_WITH_OPTIONAL_LABEL_PATTERN = re.compile(
    r"^(?P<label>.*?)(?P<command>/(?:roll|r)\s+)(?P<expression>.+)$",
    re.IGNORECASE,
)
_ROLL20_LABEL_UNSAFE_PATTERN = re.compile(r"[\r\n]+")
_WHITESPACE_PATTERN = re.compile(r"\s+")
_ROLL_MODE_OUTPUT = {
    "advantage": ("2d100kh1", "Advantage"),
    "disadvantage": ("2d100kl1", "Disadvantage"),
}


def _state() -> State:
    return StateSingleton.getState()


def _apply_roll_mode_to_message(message: str, roll_mode: str) -> tuple[str, bool]:
    if roll_mode == "normal":
        return message, False
    if roll_mode == "critical":
        match = _ROLL20_COMMAND_PATTERN.fullmatch(message)
        if match is None:
            return message, False
        return (
            f'[Critical] {match.group("prefix")}'
            f'(2 * ({match.group("expression")}))',
            True,
        )

    replacement, label = _ROLL_MODE_OUTPUT[roll_mode]
    transformed, replacement_count = _D100_CHECK_PATTERN.subn(replacement, message)
    if replacement_count == 0:
        return message, False
    return f"[{label}] {transformed}", True


def _roll20_inline_roll_label(raw_label: str) -> str | None:
    label = raw_label.strip()
    if label.endswith(":"):
        label = label[:-1].strip()
    label = label.replace("[", "").replace("]", "")
    label = _ROLL20_LABEL_UNSAFE_PATTERN.sub(" ", label)
    label = _WHITESPACE_PATTERN.sub(" ", label).strip()
    return label or None


def _format_roll20_inline_roll_message(message: str) -> str:
    match = _ROLL20_COMMAND_WITH_OPTIONAL_LABEL_PATTERN.fullmatch(message)
    if match is None:
        return message
    label = _roll20_inline_roll_label(match.group("label"))
    expression = match.group("expression").strip()
    if label is None:
        return f"[[{expression}]]"
    return f"{label}: [[{expression}]]"


def get_sheet(sheet_id: str, state: State | None = None) -> Sheet:
    current_state = _state() if state is None else state
    sheet = current_state.sheets.get(sheet_id)
    if sheet is None:
        raise ValueError(f"Sheet '{sheet_id}' does not exist.")
    return sheet


@dataclass(frozen=True)
class RuntimeActor:
    actor_id: str
    sheet_id: str
    sheet: Sheet
    instance: InstancedSheet | None = None

    @property
    def mutation_root(self) -> str:
        if self.instance is None:
            return "sheets"
        return "instanced_sheets"


@dataclass(frozen=True)
class ResolvedAction:
    action: Action
    source_item_bridge_key: str | None = None
    source_item_grant: ItemActionGrant | None = None
    source_item: Item | None = None


class RuntimeFormulaContext:
    def __init__(
        self,
        sheet: Sheet,
        instance: InstancedSheet | None,
        action: Action,
        source_item: Item | None,
        source_item_relationship_id: str | None,
        state: State,
        action_values: dict[str, float | int] | None = None,
    ) -> None:
        self._sheet = sheet
        self._instance = instance
        self._action = action
        self._source_item = source_item
        self.source_item_relationship_id = source_item_relationship_id
        self.sheet = sheet
        self.instance = instance
        self.action = {
            "attributes": _numeric_attribute_values(state, action, subject_type="action"),
            "resolved": _resolved_action_values(state, sheet, action),
        }
        self.source_item = (
            None
            if source_item is None
            else {
                "attributes": _numeric_attribute_values(
                    state,
                    source_item,
                    subject_type="item",
                ),
                "resolved": _resolved_source_item_values(
                    state,
                    sheet,
                    source_item,
                ),
            }
        )
        self.action_values = action_values if action_values is not None else {}

    def validate_formula(self, state: State, formula: Formula) -> None:
        _validate_runtime_attribute_aliases(
            state,
            formula,
            sheet=self._sheet,
            action=self._action,
            source_item=self._source_item,
        )

    def __getattr__(self, name: str) -> Any:
        if self._instance is not None and hasattr(self._instance, name):
            instance_value = getattr(self._instance, name)
            if instance_value is not None:
                return instance_value
        return getattr(self._sheet, name)


def _valid_numeric_attribute_value(bridge: AttributeBridge) -> float | int | None:
    value = bridge.evaluated_value
    if bridge.evaluation_error is not None:
        return None
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    return value


def _numeric_attribute_values(
    state: State,
    subject: Action | Item,
    *,
    subject_type: Literal["action", "item"],
) -> dict[str, float | int]:
    values: dict[str, float | int] = {}
    for attribute_id, bridge in subject.attributes.items():
        definition = state.attributes.get(attribute_id)
        if (
            definition is None
            or definition.value_type != "number"
            or subject_type not in definition.subject_types
            or (
                definition.required_profile is not None
                and definition.required_profile
                != getattr(subject, "attribute_profile", None)
            )
        ):
            continue
        value = _valid_numeric_attribute_value(bridge)
        if value is not None:
            values[attribute_id] = value
    return values


def _attribute_reference_value(subject: Action | Item, attribute_id: str) -> str | None:
    bridge = subject.attributes.get(attribute_id)
    if (
        bridge is None
        or bridge.attribute_id != attribute_id
        or bridge.evaluation_error is not None
    ):
        return None
    value = bridge.evaluated_value
    return value if isinstance(value, str) and value else None


def _sheet_proficiency_modifier(sheet: Sheet, proficiency_id: str) -> float | None:
    for bridge_key, bridge in sheet.proficiencies.items():
        if (
            bridge_key == proficiency_id
            or bridge.prof_id == proficiency_id
            or bridge.relationship_id == proficiency_id
        ):
            return min(bridge.growth_rate * bridge.use_count, 1)
    return None


def _resolved_action_values(
    state: State,
    sheet: Sheet,
    action: Action,
) -> dict[str, float | int]:
    proficiency_id = _attribute_reference_value(action, ACTION_PROFICIENCY_ATTRIBUTE_ID)
    if proficiency_id is None or proficiency_id not in state.proficiencies:
        return {}
    modifier = _sheet_proficiency_modifier(sheet, proficiency_id)
    return {} if modifier is None else {"proficiency_modifier": modifier}


def _resolved_source_item_values(
    state: State,
    sheet: Sheet,
    item: Item,
) -> dict[str, float | int]:
    if item.attribute_profile != WEAPON_ATTRIBUTE_PROFILE:
        return {}
    values: dict[str, float | int] = {}
    governing_stat = _attribute_reference_value(item, WEAPON_GOVERNING_STAT_ATTRIBUTE_ID)
    if governing_stat is not None:
        stat_value = getattr(sheet.stats, governing_stat, None)
        if isinstance(stat_value, int | float) and not isinstance(stat_value, bool):
            values["governing_stat"] = stat_value
    proficiency_id = _attribute_reference_value(item, WEAPON_PROFICIENCY_ATTRIBUTE_ID)
    if proficiency_id is not None and proficiency_id in state.proficiencies:
        modifier = _sheet_proficiency_modifier(sheet, proficiency_id)
        if modifier is not None:
            values["proficiency_modifier"] = modifier
    return values


def _validate_runtime_attribute_aliases(
    state: State,
    formula: Formula,
    *,
    sheet: Sheet,
    action: Action,
    source_item: Item | None,
) -> None:
    for alias in formula.aliases or []:
        path = alias.path
        if len(path) >= 2 and path[:2] == ["action", "attributes"]:
            if len(path) != 3:
                raise ValueError(
                    f"Action Attribute alias '{alias.name}' must reference "
                    "action.attributes.<attribute_id>."
                )
            _validate_runtime_numeric_attribute(
                state,
                action,
                path[2],
                subject_type="action",
                alias_name=alias.name,
            )
            continue
        if path[:2] == ["action", "resolved"]:
            if path != ["action", "resolved", "proficiency_modifier"]:
                raise ValueError(f"Action alias '{alias.name}' is not supported.")
            if "proficiency_modifier" not in _resolved_action_values(
                state, sheet, action
            ):
                raise ValueError(
                    f"Action alias '{alias.name}' requires an attached valid Action "
                    "Proficiency Attribute and matching sheet proficiency."
                )
            continue
        if path and path[0] == "source_item":
            if source_item is None:
                raise ValueError(
                    f"Source-item alias '{alias.name}' requires an explicit eligible "
                    "source item relationship."
                )
            if len(path) >= 2 and path[:2] == ["source_item", "attributes"]:
                if len(path) != 3:
                    raise ValueError(
                        f"Source-item Attribute alias '{alias.name}' must reference "
                        "source_item.attributes.<attribute_id>."
                    )
                _validate_runtime_numeric_attribute(
                    state,
                    source_item,
                    path[2],
                    subject_type="item",
                    alias_name=alias.name,
                )
            elif path[:2] == ["source_item", "resolved"]:
                supported_paths = (
                    ["source_item", "resolved", "governing_stat"],
                    ["source_item", "resolved", "proficiency_modifier"],
                )
                if path not in supported_paths:
                    raise ValueError(
                        f"Source-item alias '{alias.name}' is not supported."
                    )
                resolved_key = path[2]
                if resolved_key not in _resolved_source_item_values(
                    state, sheet, source_item
                ):
                    raise ValueError(
                        f"Source-item alias '{alias.name}' requires a weapon with a "
                        f"valid {resolved_key.replace('_', ' ')} Attribute relationship."
                    )


def _validate_runtime_numeric_attribute(
    state: State,
    subject: Action | Item,
    attribute_id: str,
    *,
    subject_type: Literal["action", "item"],
    alias_name: str,
) -> None:
    definition = state.attributes.get(attribute_id)
    if (
        definition is None
        or definition.value_type != "number"
        or subject_type not in definition.subject_types
    ):
        raise ValueError(
            f"Formula alias '{alias_name}' does not reference a numeric "
            f"{subject_type} Attribute."
        )
    if (
        definition.required_profile is not None
        and definition.required_profile != getattr(subject, "attribute_profile", None)
    ):
        raise ValueError(
            f"Formula alias '{alias_name}' requires source-item profile "
            f"'{definition.required_profile}'."
        )
    bridge = subject.attributes.get(attribute_id)
    if bridge is None or bridge.attribute_id != attribute_id:
        raise ValueError(
            f"Formula alias '{alias_name}' references Attribute '{attribute_id}', but it is "
            f"not attached to the current {subject_type}."
        )
    if bridge.evaluation_error is not None:
        raise ValueError(
            f"Formula alias '{alias_name}' references invalid Attribute '{attribute_id}': "
            f"{bridge.evaluation_error}"
        )
    if _valid_numeric_attribute_value(bridge) is None:
        raise ValueError(
            f"Formula alias '{alias_name}' references Attribute '{attribute_id}', but its "
            "evaluated value is not numeric."
        )


def _formula_execution_context(
    formula: Formula,
    *,
    action_id: str,
    step_id: str,
    formula_id: str | None = None,
    source_item_relationship_id: str | None = None,
    semantic_tags: tuple[str, ...] = (),
) -> FormulaExecutionContext:
    return FormulaExecutionContext.for_formula(
        formula,
        action_id=action_id,
        step_id=step_id,
        formula_id=formula_id,
        source_item_relationship_id=source_item_relationship_id,
        semantic_tags=semantic_tags,
    )


def _resolve_formula_value(
    state: State,
    value: FormulaValueSource,
) -> tuple[Formula, str | None]:
    if isinstance(value, Formula):
        return value, None
    definition = state.formulas.get(value.formula_id)
    if definition is None:
        raise ValueError(f"Formula '{value.formula_id}' does not exist.")
    return definition.formula, value.formula_id


def _matching_formula_effects(
    state: State,
    actor: RuntimeActor,
    context: FormulaExecutionContext,
) -> tuple[EvaluationTimeEffect, ...]:
    return augmentation_service.matching_evaluation_effects(
        state,
        sheet_id=actor.sheet_id,
        instance_id=actor.actor_id if actor.instance is not None else None,
        context=context,
    )


def _validate_matching_formula_effects(
    *,
    state: State,
    formula_root: RuntimeFormulaContext,
    modifiers: tuple[EvaluationTimeEffect, ...],
) -> None:
    for modifier in modifiers:
        if modifier.type != "evaluation_formula_modifier":
            continue
        formula_root.validate_formula(state, modifier.value)


def _evaluate_action_formula(
    *,
    state: State,
    actor: RuntimeActor,
    formula_root: RuntimeFormulaContext,
    formula: FormulaValueSource,
    action_id: str,
    step_id: str,
    source_item_relationship_id: str | None = None,
    semantic_tags: tuple[str, ...] = (),
) -> float | int:
    resolved_formula, formula_id = _resolve_formula_value(state, formula)
    formula_root.validate_formula(state, resolved_formula)
    context = _formula_execution_context(
        resolved_formula,
        action_id=action_id,
        step_id=step_id,
        formula_id=formula_id,
        source_item_relationship_id=source_item_relationship_id,
        semantic_tags=semantic_tags,
    )
    modifiers = _matching_formula_effects(state, actor, context)
    _validate_matching_formula_effects(
        state=state,
        formula_root=formula_root,
        modifiers=modifiers,
    )
    return evaluate_numeric_formula(
        formula_root,
        resolved_formula,
        execution_context=context,
        modifiers=modifiers,
    )


def _resolve_action_numeric_value(
    *,
    state: State,
    actor: RuntimeActor,
    formula_root: RuntimeFormulaContext,
    value: NumericValueSource,
    action_id: str,
    step_id: str,
    action_values: dict[str, float | int],
    semantic_tags: tuple[str, ...] = (),
) -> float | int:
    if isinstance(value, CalculatedValueReference):
        if value.variable_id not in action_values:
            raise ValueError(
                f"Calculated value '{value.variable_id}' is not available in step "
                f"'{step_id}'."
            )
        return action_values[value.variable_id]
    return _evaluate_action_formula(
        state=state,
        actor=actor,
        formula_root=formula_root,
        formula=value,
        action_id=action_id,
        step_id=step_id,
        source_item_relationship_id=formula_root.source_item_relationship_id,
        semantic_tags=semantic_tags,
    )


def resolve_runtime_actor(sheet_id: str, state: State | None = None) -> RuntimeActor:
    current_state = _state() if state is None else state
    sheet = current_state.sheets.get(sheet_id)
    if sheet is not None:
        return RuntimeActor(actor_id=sheet_id, sheet_id=sheet_id, sheet=sheet)

    instance = current_state.instanced_sheets.get(sheet_id)
    if instance is None:
        raise ValueError(f"Sheet or instance '{sheet_id}' does not exist.")

    parent_sheet = current_state.sheets.get(instance.parent_id)
    if parent_sheet is None:
        raise ValueError(
            f"Instance '{sheet_id}' references missing parent sheet '{instance.parent_id}'."
        )
    return RuntimeActor(
        actor_id=sheet_id,
        sheet_id=instance.parent_id,
        sheet=parent_sheet,
        instance=instance,
    )


def _resolve_value_container(root: Any, path: list[str]) -> tuple[Any, str]:
    if not path:
        raise ValueError("Mutation path must not be empty.")

    current = root
    for idx, branch in enumerate(path[:-1]):
        if isinstance(current, dict):
            if branch not in current:
                raise ValueError(
                    f"Mutation branch '{branch}' which is idx {idx} does not exist."
                )
            current = current[branch]
            continue

        current = getattr(current, branch, None)
        if current is None:
            raise ValueError(
                f"Mutation branch '{branch}' which is idx {idx} does not exist."
            )

    return current, path[-1]


def _apply_set_value(
    root: dict[str, Any],
    path: list[str],
    value: float | int,
) -> None:
    container, leaf = _resolve_value_container(root, path)
    if isinstance(container, dict):
        container[leaf] = value
        return
    if not hasattr(container, leaf):
        raise ValueError(f"Mutation branch '{leaf}' does not exist.")
    setattr(container, leaf, value)


def _resolve_item_action_source(
    sheet: Sheet,
    action_id: str,
    *,
    state: State,
    relationship_id: str,
    item_bridges: dict[str, ItemBridge] | None = None,
) -> tuple[str, ItemActionGrant, Item]:
    inventory = sheet.items if item_bridges is None else item_bridges
    matches = [
        (bridge_key, bridge)
        for bridge_key, bridge in inventory.items()
        if bridge_key == relationship_id or bridge.relationship_id == relationship_id
    ]
    if not matches:
        raise ValueError(
            f"Sheet item bridge '{relationship_id}' does not exist on sheet "
            f"'{sheet.id}'."
        )
    if len(matches) > 1:
        raise ValueError(
            f"Sheet item relationship '{relationship_id}' is ambiguous on sheet "
            f"'{sheet.id}'."
        )

    bridge_key, bridge = matches[0]
    item = state.items.get(bridge.item_id)
    if item is None:
        raise ValueError(f"Item '{bridge.item_id}' does not exist.")
    if item.interaction_type == "inventory_only":
        raise ValueError(f"Item '{item.name}' does not provide usable actions.")
    grant = next(
        (grant for grant in item.action_grants if grant.action_id == action_id),
        None,
    )
    if grant is None:
        raise ValueError(
            f"Item '{item.id}' does not grant action '{action_id}'."
        )
    if grant.availability == "equipped" and item.interaction_type != "equippable":
        raise ValueError(f"Item '{item.name}' cannot provide equipped actions.")
    if bridge.count <= 0:
        raise ValueError(f"Item '{item.name}' has no remaining quantity.")
    if grant.availability == "equipped" and not bridge.equipped:
        raise ValueError(
            f"Item '{item.name}' must be equipped to use action '{action_id}'."
        )
    if grant.consume_quantity > bridge.count:
        raise ValueError(
            f"Item '{item.name}' requires {grant.consume_quantity} quantity to use "
            f"action '{action_id}', but only {bridge.count} remains."
        )
    return bridge_key, grant, item


def _formula_requires_source_item(formula: Formula) -> bool:
    return any(
        bool(alias.path) and alias.path[0] == "source_item"
        for alias in formula.aliases or []
    )


def _formula_value_requires_source_item(
    value: FormulaValueSource | NumericValueSource | None,
    state: State,
) -> bool:
    if isinstance(value, Formula):
        return _formula_requires_source_item(value)
    if isinstance(value, FormulaReference):
        definition = state.formulas.get(value.formula_id)
        return (
            definition is not None
            and _formula_requires_source_item(definition.formula)
        )
    return False


def _action_requires_source_item(action: Action, state: State) -> bool:
    for step in action.steps:
        values: list[FormulaValueSource | NumericValueSource | None] = []
        if isinstance(step, SendMessageStep):
            values.append(step.message)
        elif isinstance(step, CalculateValueStep):
            values.append(step.value)
        elif isinstance(step, SetValueStep):
            values.extend((step.value, step.min_value, step.max_value))
        elif isinstance(
            step,
            (
                IncrementValueStep,
                DecrementValueStep,
                ResolveDamageStep,
                GainProficiencyUseStep,
            ),
        ):
            values.append(step.amount)
            if isinstance(step, IncrementValueStep | DecrementValueStep):
                values.extend((step.min_value, step.max_value))
        if any(_formula_value_requires_source_item(value, state) for value in values):
            return True
    return False


def _resolve_action(
    sheet: Sheet,
    action_id: str,
    *,
    actor_role: SessionRole,
    source_item_relationship_id: str | None = None,
    item_bridges: dict[str, ItemBridge] | None = None,
    state: State | None = None,
) -> ResolvedAction:
    current_state = _state() if state is None else state
    action = current_state.actions.get(action_id)
    if action is None:
        raise ValueError(f"Action '{action_id}' does not exist.")

    if source_item_relationship_id is not None:
        bridge_key, grant, item = _resolve_item_action_source(
            sheet,
            action_id,
            state=current_state,
            relationship_id=source_item_relationship_id,
            item_bridges=item_bridges,
        )
        return ResolvedAction(
            action=action,
            source_item_bridge_key=bridge_key,
            source_item_grant=grant,
            source_item=item,
        )

    source_item_required = _action_requires_source_item(action, current_state)

    if not source_item_required:
        if actor_role == "dm":
            return ResolvedAction(action=action)

        if any(bridge.entry_id == action_id for bridge in sheet.actions.values()):
            return ResolvedAction(action=action)

    eligible_sources: list[tuple[str, ItemActionGrant, Item]] = []
    inventory = sheet.items if item_bridges is None else item_bridges
    for bridge_key in inventory:
        try:
            eligible_sources.append(
                _resolve_item_action_source(
                    sheet,
                    action_id,
                    state=current_state,
                    relationship_id=bridge_key,
                    item_bridges=inventory,
                )
            )
        except ValueError:
            continue

    if len(eligible_sources) == 1:
        bridge_key, grant, item = eligible_sources[0]
        return ResolvedAction(
            action=action,
            source_item_bridge_key=bridge_key,
            source_item_grant=grant,
            source_item=item,
        )
    if len(eligible_sources) > 1:
        raise ValueError(
            f"Multiple items grant action '{action_id}'; provide a source item "
            "relationship ID."
        )

    if source_item_required:
        raise ValueError(
            f"Action '{action_id}' requires an explicit eligible source item "
            "relationship."
        )

    raise ValueError(
        f"Sheet '{sheet.id}' does not reference action '{action_id}'."
    )


def _validate_caster_target(target: str) -> None:
    if target != "caster":
        raise ValueError(f"Unsupported runtime action target '{target}'.")


def _validate_action_roll_mode(action: Action, roll_mode: str) -> None:
    allowed_modes = {
        "none": {"normal"},
        "check": {"normal", "advantage", "disadvantage"},
        "damage": {"normal", "critical"},
    }[action.roll_mode_kind]
    if roll_mode not in allowed_modes:
        allowed = ", ".join(sorted(allowed_modes))
        raise ValueError(
            f"Action '{action.id}' uses '{action.roll_mode_kind}' roll modes and "
            f"does not allow '{roll_mode}'. Allowed modes: {allowed}."
        )


def _positive_int_amount(amount: float | int, *, label: str) -> int:
    if amount <= 0:
        raise ValueError(f"{label} must be greater than 0.")
    if not isinstance(amount, int):
        raise ValueError(f"{label} must be a whole number.")
    return amount


def _proficiency_bridge_key(actor: RuntimeActor, proficiency_id: str) -> str:
    proficiencies = (
        actor.instance.proficiencies
        if actor.instance is not None
        else actor.sheet.proficiencies
    )
    for bridge_key, bridge in proficiencies.items():
        if (
            bridge_key == proficiency_id
            or bridge.prof_id == proficiency_id
            or bridge.relationship_id == proficiency_id
        ):
            return bridge_key
    raise ValueError(
        f"Sheet '{actor.sheet.id}' does not reference proficiency '{proficiency_id}'."
    )


def _required_instance_id(actor: RuntimeActor, step_type: str) -> str:
    if actor.instance is None:
        raise ValueError(f"{step_type} steps require an instanced sheet.")
    return actor.actor_id


def _augmentation_mutation_summary(
    augmentation_id: str,
    operation: str,
    result_operation: str,
    reason: str | None,
) -> str:
    summary = f"augmentations.{augmentation_id} {operation}:{result_operation}"
    if reason is not None:
        summary += f":{reason}"
    return summary


def _condition_mutation_summary(
    condition_id: str,
    operation: str,
    result_operation: str,
    reason: str | None,
) -> str:
    summary = f"conditions.{condition_id} {operation}:{result_operation}"
    if reason is not None:
        summary += f":{reason}"
    return summary


def _numeric_path_value(root: Any, path: list[str], state_path: str) -> float | int:
    container, leaf = _resolve_value_container(root, path)
    if isinstance(container, dict):
        if leaf not in container:
            raise ValueError(f"State path {state_path} does not exist.")
        current_value = container[leaf]
    elif hasattr(container, leaf):
        current_value = getattr(container, leaf)
    else:
        raise ValueError(f"State path {state_path} does not exist.")

    if not isinstance(current_value, int | float):
        raise ValueError(f"State path {state_path} is not numeric.")
    return current_value


def _target_root(actor: RuntimeActor) -> Sheet | InstancedSheet:
    if actor.instance is None:
        return actor.sheet
    return actor.instance


def effective_damage_resistance(
    actor: RuntimeActor,
    damage_type: DamageType,
) -> float:
    category = damage_type_category(damage_type)
    resistance_key = damage_type_resistance_key(damage_type)
    source = actor.instance.resistances if actor.instance is not None else actor.sheet.resistances
    resistance = (
        source.resistance
        + getattr(source, category)
        + getattr(source, resistance_key)
    )
    return max(0.0, min(resistance, 1.0))


def synchronize_resource_bounds_mutation(state: State) -> list[PatchOp]:
    ops: list[PatchOp] = []
    for instance_id, instance in sorted(state.instanced_sheets.items()):
        if instance.stats is None:
            continue
        maxima = evaluate_resource_maxima(instance)
        for resource in ("health", "mana"):
            path = state_sync_service.join_path(
                "instanced_sheets",
                instance_id,
                resource,
            )
            if path in state.direct_effect_projections:
                continue
            current = getattr(instance, resource)
            bounded = max(0, min(current, maxima[resource]))
            if resource == "mana":
                bounded = int(bounded)
            else:
                bounded = normalize_numeric_result(bounded)
            if current != bounded:
                ops.append(state_sync_service.set_mutation(state, path, bounded))
    return ops


def calculate_damage_taken(
    *,
    actor: RuntimeActor,
    damage_type: DamageType,
    raw_damage: float | int,
) -> int:
    if raw_damage < 0:
        raise ValueError("Damage amount must be greater than or equal to 0.")
    resistance = effective_damage_resistance(actor, damage_type)
    damage_taken = raw_damage - (raw_damage * resistance)
    return floor(max(0, damage_taken))


def _resolve_damage_amount(
    *,
    actor: RuntimeActor,
    damage_type: DamageType,
    raw_damage: float | int,
) -> int:
    return calculate_damage_taken(
        actor=actor,
        damage_type=damage_type,
        raw_damage=raw_damage,
    )


async def set_instanced_sheet_item_equipped(
    request: SetInstancedSheetItemEquipped,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        instance = state.instanced_sheets.get(request.instance_id)
        if instance is None:
            raise ValueError(f"Instance '{request.instance_id}' does not exist.")
        bridge = instance.items.get(request.relationship_id)
        if bridge is None:
            raise ValueError(
                f"Instance item bridge '{request.relationship_id}' does not exist."
            )
        item = state.items.get(bridge.item_id)
        if item is None:
            raise ValueError(f"Item '{bridge.item_id}' does not exist.")
        if item.interaction_type != "equippable":
            raise ValueError(f"Item '{item.name}' cannot be equipped.")
        if request.equipped and bridge.count <= 0:
            raise ValueError(f"Item '{item.name}' has no remaining quantity.")
        if bridge.equipped == request.equipped:
            return None, []

        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "items",
            request.relationship_id,
            "equipped",
        )
        op = state_sync_service.set_mutation(state, path, request.equipped)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


async def apply_instanced_sheet_damage(
    request: ApplyInstancedSheetDamage,
) -> None:
    def mutation(state: State) -> tuple[None, list]:
        actor = resolve_runtime_actor(request.instance_id, state)
        _required_instance_id(actor, "Apply damage")
        path = state_sync_service.join_path(
            "instanced_sheets",
            request.instance_id,
            "health",
        )
        damage_taken = calculate_damage_taken(
            actor=actor,
            damage_type=request.damage_type,
            raw_damage=request.amount,
        )
        current_health = _numeric_path_value(actor.instance, ["health"], path)
        next_health = normalize_numeric_result(max(0, current_health - damage_taken))
        op = state_sync_service.set_mutation(state, path, next_health)
        return None, [op]

    await state_sync_service.apply_mutation(mutation, request_id=request.request_id)


def _bounded_numeric_result(
    value: float | int,
    *,
    min_value: NumericValueSource | None,
    max_value: NumericValueSource | None,
    evaluate_bound: Callable[[NumericValueSource], float | int],
    on_min_violation: str,
    on_max_violation: str,
    state_path: str,
) -> float | int:
    result = value
    if min_value is not None:
        minimum = evaluate_bound(min_value)
        if result < minimum:
            if on_min_violation == "reject":
                raise ValueError(
                    f"State path {state_path} would be below minimum {minimum}."
                )
            result = minimum

    if max_value is not None:
        maximum = evaluate_bound(max_value)
        if result > maximum:
            if on_max_violation == "reject":
                raise ValueError(
                    f"State path {state_path} would be above maximum {maximum}."
                )
            result = maximum

    return normalize_numeric_result(result)


def _has_bounds(step: SetValueStep | IncrementValueStep | DecrementValueStep) -> bool:
    return step.min_value is not None or step.max_value is not None


def _resolve_allowed_runtime_actor(
    request: PerformAction,
    *,
    actor_role: SessionRole,
    assigned_instance_id: str | None = None,
) -> RuntimeActor:
    if request.target_sheet_id is not None:
        raise ValueError(
            "Target sheet execution is not supported for MVP; "
            "actions can only affect the acting sheet or instance."
        )

    actor = resolve_runtime_actor(request.sheet_id)
    if actor.instance is None and actor_role != "dm":
        raise ValueError("Players can only execute actions against an instanced sheet.")
    if actor_role == "player":
        if assigned_instance_id is None:
            raise PermissionError(
                "Claim a sheet access code before editing a player sheet."
            )
        if actor.actor_id != assigned_instance_id:
            raise PermissionError("You can only edit your assigned sheet instance.")
    return actor


async def perform_action(
    request: PerformAction,
    *,
    actor_role: SessionRole = "player",
    assigned_instance_id: str | None = None,
) -> ActionExecuted | None:
    actor = _resolve_allowed_runtime_actor(
        request,
        actor_role=actor_role,
        assigned_instance_id=assigned_instance_id,
    )
    resolution = _resolve_action(
        actor.sheet,
        request.action_id,
        actor_role=actor_role,
        source_item_relationship_id=request.source_item_relationship_id,
        item_bridges=actor.instance.items if actor.instance is not None else None,
    )
    action = resolution.action
    _validate_action_roll_mode(action, request.roll_mode)
    steps = action.steps

    bridge_binding: chat_service.Roll20BridgeBinding | None = None
    if any(isinstance(step, SendMessageStep) for step in steps):
        bridge_binding = chat_service.binding_for_actor(
            actor_role=actor_role,
            assigned_instance_id=assigned_instance_id,
        )
        if not await chat_service.roll20_chat_bridge.is_connected(
            bridge_binding.key
        ):
            raise ValueError(
                "Roll20 chat bridge is not connected for this user."
            )

    def mutation(state: State) -> tuple[tuple[list[str], list[str], bool], list[Any]]:
        ops: list[Any] = augmentation_service.synchronize_equipment_augmentations_mutation(
            state
        )
        current_actor = resolve_runtime_actor(request.sheet_id, state=state)
        current_resolution = _resolve_action(
            current_actor.sheet,
            request.action_id,
            actor_role=actor_role,
            source_item_relationship_id=request.source_item_relationship_id,
            item_bridges=(
                current_actor.instance.items
                if current_actor.instance is not None
                else None
            ),
            state=state,
        )
        current_action = current_resolution.action
        _validate_action_roll_mode(current_action, request.roll_mode)
        current_steps = current_action.steps
        action_values: dict[str, float | int] = {}
        formula_root = RuntimeFormulaContext(
            current_actor.sheet,
            current_actor.instance,
            current_action,
            current_resolution.source_item,
            current_resolution.source_item_bridge_key,
            state,
            action_values,
        )

        applied_mutations: list[str] = []
        emitted_messages: list[str] = []
        roll_mode_requires_transform = False
        roll_mode_applied = False
        unresolved_roll_mode = request.roll_mode

        for step in current_steps:
            if isinstance(step, SendMessageStep):
                message_formula, formula_id = _resolve_formula_value(
                    state,
                    step.message,
                )
                execution_context = _formula_execution_context(
                    message_formula,
                    action_id=current_action.id,
                    step_id=step.step_id,
                    formula_id=formula_id,
                    source_item_relationship_id=(
                        current_resolution.source_item_bridge_key
                    ),
                )
                modifiers = _matching_formula_effects(
                    state,
                    current_actor,
                    execution_context,
                )
                formula_root.validate_formula(state, message_formula)
                _validate_matching_formula_effects(
                    state=state,
                    formula_root=formula_root,
                    modifiers=modifiers,
                )
                message = compose_roll20_message(
                    formula_root,
                    message_formula,
                    execution_context=execution_context,
                    modifiers=modifiers,
                )
                effective_roll_mode = (
                    resolve_roll_mode(
                        request.roll_mode,
                        execution_context=execution_context,
                        modifiers=modifiers,
                    )
                    if current_action.roll_mode_kind == "check"
                    else request.roll_mode
                )
                if effective_roll_mode != "normal":
                    roll_mode_requires_transform = True
                    unresolved_roll_mode = effective_roll_mode
                message, mode_applied = _apply_roll_mode_to_message(
                    message,
                    effective_roll_mode,
                )
                message = _format_roll20_inline_roll_message(message)
                roll_mode_applied = roll_mode_applied or mode_applied
                emitted_messages.append(message)
                continue

            if isinstance(step, CalculateValueStep):
                if step.variable_id in action_values:
                    raise ValueError(
                        f"Calculated value '{step.variable_id}' is already defined."
                    )
                action_values[step.variable_id] = _evaluate_action_formula(
                    state=state,
                    actor=current_actor,
                    formula_root=formula_root,
                    formula=step.value,
                    action_id=current_action.id,
                    step_id=step.step_id,
                    source_item_relationship_id=(
                        current_resolution.source_item_bridge_key
                    ),
                )
                continue

            if isinstance(step, SetValueStep):
                _validate_caster_target(step.target)
                result = _resolve_action_numeric_value(
                    state=state,
                    actor=current_actor,
                    formula_root=formula_root,
                    value=step.value,
                    action_id=current_action.id,
                    step_id=step.step_id,
                    action_values=action_values,
                )
                path = state_sync_service.join_path(
                    current_actor.mutation_root, current_actor.actor_id, *step.path
                )
                result = _bounded_numeric_result(
                    result,
                    min_value=step.min_value,
                    max_value=step.max_value,
                    evaluate_bound=lambda value: _resolve_action_numeric_value(
                        state=state,
                        actor=current_actor,
                        formula_root=formula_root,
                        value=value,
                        action_id=current_action.id,
                        step_id=step.step_id,
                        action_values=action_values,
                    ),
                    on_min_violation=step.on_min_violation,
                    on_max_violation=step.on_max_violation,
                    state_path=path,
                )
                op = state_sync_service.set_mutation(state, path, result)
                ops.append(op)
                applied_mutations.append(".".join(step.path) + f"={result}")
                continue

            if isinstance(step, IncrementValueStep):
                _validate_caster_target(step.target)
                amount = _resolve_action_numeric_value(
                    state=state,
                    actor=current_actor,
                    formula_root=formula_root,
                    value=step.amount,
                    action_id=current_action.id,
                    step_id=step.step_id,
                    action_values=action_values,
                )
                path = state_sync_service.join_path(
                    current_actor.mutation_root, current_actor.actor_id, *step.path
                )
                if _has_bounds(step):
                    current_value = _numeric_path_value(
                        _target_root(current_actor),
                        step.path,
                        path,
                    )
                    result = _bounded_numeric_result(
                        current_value + amount,
                        min_value=step.min_value,
                        max_value=step.max_value,
                        evaluate_bound=lambda value: _resolve_action_numeric_value(
                            state=state,
                            actor=current_actor,
                            formula_root=formula_root,
                            value=value,
                            action_id=current_action.id,
                            step_id=step.step_id,
                            action_values=action_values,
                        ),
                        on_min_violation=step.on_min_violation,
                        on_max_violation=step.on_max_violation,
                        state_path=path,
                    )
                    op = state_sync_service.set_mutation(state, path, result)
                    applied_mutations.append(".".join(step.path) + f"={result}")
                    ops.append(op)
                    continue

                op = state_sync_service.increment_mutation(state, path, amount)
                ops.append(op)
                applied_mutations.append(".".join(step.path) + f"+={amount}")
                continue

            if isinstance(step, DecrementValueStep):
                _validate_caster_target(step.target)
                amount = _resolve_action_numeric_value(
                    state=state,
                    actor=current_actor,
                    formula_root=formula_root,
                    value=step.amount,
                    action_id=current_action.id,
                    step_id=step.step_id,
                    action_values=action_values,
                )
                path = state_sync_service.join_path(
                    current_actor.mutation_root, current_actor.actor_id, *step.path
                )
                if _has_bounds(step):
                    current_value = _numeric_path_value(
                        _target_root(current_actor),
                        step.path,
                        path,
                    )
                    result = _bounded_numeric_result(
                        current_value - amount,
                        min_value=step.min_value,
                        max_value=step.max_value,
                        evaluate_bound=lambda value: _resolve_action_numeric_value(
                            state=state,
                            actor=current_actor,
                            formula_root=formula_root,
                            value=value,
                            action_id=current_action.id,
                            step_id=step.step_id,
                            action_values=action_values,
                        ),
                        on_min_violation=step.on_min_violation,
                        on_max_violation=step.on_max_violation,
                        state_path=path,
                    )
                    op = state_sync_service.set_mutation(state, path, result)
                    applied_mutations.append(".".join(step.path) + f"={result}")
                    ops.append(op)
                    continue

                op = state_sync_service.decrement_mutation(state, path, amount)
                ops.append(op)
                applied_mutations.append(".".join(step.path) + f"-={amount}")
                continue

            if isinstance(step, ResolveDamageStep):
                _validate_caster_target(step.target)
                _required_instance_id(current_actor, "Resolve damage")
                path = state_sync_service.join_path(
                    "instanced_sheets",
                    current_actor.actor_id,
                    "health",
                )
                current_health = _numeric_path_value(
                    _target_root(current_actor),
                    ["health"],
                    path,
                )
                damage_taken = _resolve_damage_amount(
                    actor=current_actor,
                    damage_type=step.damage_type,
                    raw_damage=_resolve_action_numeric_value(
                        state=state,
                        actor=current_actor,
                        formula_root=formula_root,
                        value=step.amount,
                        action_id=current_action.id,
                        step_id=step.step_id,
                        action_values=action_values,
                        semantic_tags=("damage", step.damage_type),
                    ),
                )
                result = normalize_numeric_result(
                    max(0, current_health - damage_taken)
                )
                op = state_sync_service.set_mutation(state, path, result)
                ops.append(op)
                resistance = effective_damage_resistance(
                    current_actor,
                    step.damage_type,
                )
                applied_mutations.append(
                    f"health={result};damage={damage_taken};"
                    f"type={step.damage_type};resistance={resistance}"
                )
                continue

            if isinstance(step, GainProficiencyUseStep):
                _validate_caster_target(step.target)
                amount = _positive_int_amount(
                    _resolve_action_numeric_value(
                        state=state,
                        actor=current_actor,
                        formula_root=formula_root,
                        value=step.amount,
                        action_id=current_action.id,
                        step_id=step.step_id,
                        action_values=action_values,
                    ),
                    label="Proficiency use gain amount",
                )
                bridge_key = _proficiency_bridge_key(
                    current_actor, step.proficiency_id
                )
                path = state_sync_service.join_path(
                    current_actor.mutation_root,
                    current_actor.actor_id,
                    "proficiencies",
                    bridge_key,
                    "use_count",
                )
                op = state_sync_service.increment_mutation(state, path, amount)
                ops.append(op)
                applied_mutations.append(
                    f"proficiencies.{bridge_key}.use_count+={amount}"
                )
                continue

            if isinstance(step, ApplyAugmentationStep):
                _validate_caster_target(step.target)
                instance_id = _required_instance_id(
                    current_actor,
                    "Apply augmentation",
                )
                effect = state.standalone_effects.get(step.augmentation_id)
                if effect is None:
                    raise ValueError(
                        f"Standalone effect '{step.augmentation_id}' does not exist."
                    )
                if effect.target.root != "instance" or effect.scope != "instance":
                    raise ValueError(
                        "Action effect steps can only target the acting instance."
                    )
                if step.operation == "apply":
                    result, result_ops = (
                        augmentation_service.apply_standalone_effect_mutation(
                            state,
                            step.augmentation_id,
                            instance_id=instance_id,
                            action_id=current_action.id,
                            step_id=step.step_id,
                        )
                    )
                else:
                    result, result_ops = (
                        augmentation_service.remove_standalone_effect_mutation(
                            state,
                            step.augmentation_id,
                            instance_id=instance_id,
                        )
                    )
                ops.extend(result_ops)
                applied_mutations.append(
                    _augmentation_mutation_summary(
                        step.augmentation_id,
                        step.operation,
                        result.operation,
                        result.reason,
                    )
                )
                continue

            if isinstance(step, ApplyConditionPresetStep):
                _validate_caster_target(step.target)
                instance_id = _required_instance_id(
                    current_actor,
                    "Apply condition preset",
                )
                if step.operation == "apply":
                    result, result_ops = (
                        augmentation_service.apply_condition_preset_mutation(
                            state,
                            instance_id=instance_id,
                            condition_id=step.condition_id,
                            source=ConditionSource(
                                type="action",
                                id=current_action.id,
                                label=current_action.name,
                            ),
                            applied_by_role=actor_role,
                            applied_at_state_version=(
                                state_sync_service.current_version + 1
                            ),
                        )
                    )
                else:
                    result, result_ops = (
                        augmentation_service.remove_condition_preset_mutation(
                            state,
                            instance_id=instance_id,
                            condition_id=step.condition_id,
                        )
                    )
                ops.extend(result_ops)
                applied_mutations.append(
                    _condition_mutation_summary(
                        step.condition_id,
                        step.operation,
                        result.operation,
                        result.reason,
                    )
                )
                continue

            raise ValueError(
                f"Unsupported runtime action step '{step.__class__.__name__}'."
            )

        if roll_mode_requires_transform and not roll_mode_applied:
            if unresolved_roll_mode == "critical":
                raise ValueError(
                    "Critical mode requires an authored Roll20 damage expression."
                )
            raise ValueError(
                f"Roll mode '{unresolved_roll_mode}' requires an authored 1d100 "
                "Roll20 check expression."
            )

        if (
            current_resolution.source_item_grant is not None
            and current_resolution.source_item_bridge_key is not None
            and current_resolution.source_item_grant.consume_quantity > 0
        ):
            consume_quantity = current_resolution.source_item_grant.consume_quantity
            inventory_root = (
                "instanced_sheets" if current_actor.instance is not None else "sheets"
            )
            inventory_owner_id = (
                current_actor.actor_id
                if current_actor.instance is not None
                else current_actor.sheet_id
            )
            path = state_sync_service.join_path(
                inventory_root,
                inventory_owner_id,
                "items",
                current_resolution.source_item_bridge_key,
                "count",
            )
            op = state_sync_service.decrement_mutation(
                state,
                path,
                consume_quantity,
            )
            ops.append(op)
            applied_mutations.append(
                f"items.{current_resolution.source_item_bridge_key}.count"
                f"-={consume_quantity}"
            )
            current_inventory = (
                current_actor.instance.items
                if current_actor.instance is not None
                else current_actor.sheet.items
            )
            source_bridge = current_inventory[current_resolution.source_item_bridge_key]
            if source_bridge.count == 0 and source_bridge.equipped:
                equipped_path = state_sync_service.join_path(
                    inventory_root,
                    inventory_owner_id,
                    "items",
                    current_resolution.source_item_bridge_key,
                    "equipped",
                )
                ops.append(
                    state_sync_service.set_mutation(state, equipped_path, False)
                )
                applied_mutations.append(
                    f"items.{current_resolution.source_item_bridge_key}.equipped=false"
                )

        return (applied_mutations, emitted_messages, bool(ops)), ops

    async def deliver_messages(
        result: tuple[list[str], list[str], bool],
    ) -> None:
        _, messages, _ = result
        if not messages:
            return
        if bridge_binding is None:
            raise RuntimeError("Roll20 bridge binding was not resolved.")
        for message in messages:
            await chat_service.roll20_chat_bridge.send(
                Roll20ChatMessage(
                    message_id=str(uuid4()),
                    message=message,
                    request_id=request.request_id,
                ),
                binding_key=bridge_binding.key,
                await_delivery=True,
            )

    applied_mutations, emitted_messages, emitted_state_patch = (
        await state_sync_service.apply_mutation(
            mutation,
            request_id=request.request_id,
            before_commit=deliver_messages,
        )
    )

    def history_mutation(state: State) -> tuple[None, list[Any]]:
        entry_id = f"action_history_{uuid4()}"
        entry = ActionHistoryEntry(
            id=entry_id,
            request_id=request.request_id,
            action_id=action.id,
            action_name=action.name,
            actor_role=actor_role,
            actor_sheet_id=actor.sheet_id,
            actor_instance_id=(actor.actor_id if actor.instance is not None else None),
            target_sheet_id=request.target_sheet_id,
            created_at=datetime.now(timezone.utc).isoformat(),
            state_version=state_sync_service.current_version + 1,
            status="success",
            public_summary=f"{action.name} completed.",
            gm_summary=(
                f"{action.name} completed with {len(emitted_messages)} message(s) "
                f"and {len(applied_mutations)} mutation(s)."
            ),
            emitted_messages=[
                ActionHistoryText(message, visibility="public")
                for message in emitted_messages
            ],
            mutation_summaries=[
                ActionHistoryText(summary, visibility="gm_only")
                for summary in applied_mutations
            ],
        )
        removed_ids = record_action_history_entry(state, entry)
        ops: list[Any] = [
            PatchOp(
                op="remove",
                path=state_sync_service.join_path("action_history", removed_id),
            )
            for removed_id in removed_ids
        ]
        ops.append(
            PatchOp(
                op="add",
                path=state_sync_service.join_path("action_history", entry_id),
                value=entry,
            )
        )
        return None, ops

    await state_sync_service.apply_audit_mutation(history_mutation)

    if emitted_state_patch:
        return None

    return ActionExecuted(
        response_id=None,
        sheet_id=request.sheet_id,
        action_id=request.action_id,
        applied_mutations=applied_mutations,
        emitted_messages=emitted_messages,
        request_id=request.request_id,
    )
