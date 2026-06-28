from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from backend.core.transport import RequestModel, ResponseModel

VariableRoot = Literal["state", "sheet", "instance"]
VariableValueType = Literal["number", "percent", "formula", "resource"]
VariableEditableRole = Literal["unauthenticated", "player", "dm"]
ActionStepTarget = Literal["caster", "target"]
ActionStepCategory = Literal[
    "calculation",
    "roll20_output",
    "bounded_mutation",
    "semantic_mutation",
]
ActionPresetTemplateCategory = Literal["healing", "resource"]
AugmentationTargetContext = Literal["item_template", "condition_template", "runtime"]
ActionPathCatalog = Literal[
    "none",
    "variable_mutation_paths",
    "proficiency_bridges",
    "augmentation_records",
    "condition_presets",
]


class GetVariableRegistry(RequestModel):
    type: Literal["get_variable_registry"]


class GetActionFormulaAuthoringMetadata(RequestModel):
    type: Literal["get_action_formula_authoring_metadata"]


class GetAugmentationTargetMetadata(RequestModel):
    context: AugmentationTargetContext | None = None
    type: Literal["get_augmentation_target_metadata"]


@dataclass
class VariablePathMetadata:
    key: str
    label: str
    root: VariableRoot
    path: list[str]
    value_type: VariableValueType
    editable_roles: list[VariableEditableRole]
    formula_backed: bool = False
    description: str = ""
    shortcuts: list[str] | None = None


@dataclass
class VariableRegistry(ResponseModel):
    variables: list[VariablePathMetadata]
    type: Literal["variable_registry"] = "variable_registry"
    request_id: str | None = None


@dataclass
class AuthoringVariablePathMetadata:
    key: str
    label: str
    root: VariableRoot
    path: list[str]
    value_type: VariableValueType
    editable_roles: list[VariableEditableRole]
    formula_backed: bool = False
    description: str = ""
    shortcuts: list[str] | None = None
    formula_reference_allowed: bool = True
    action_mutation_allowed: bool = False


@dataclass
class AugmentationTargetMetadata:
    key: str
    label: str
    root: VariableRoot
    path: list[str]
    value_type: VariableValueType
    description: str
    allowed_contexts: list[AugmentationTargetContext]


@dataclass
class AugmentationTargetMetadataResponse(ResponseModel):
    targets: list[AugmentationTargetMetadata]
    context: AugmentationTargetContext | None = None
    type: Literal["augmentation_target_metadata"] = "augmentation_target_metadata"
    request_id: str | None = None


@dataclass
class FormulaAliasMetadata:
    name: str
    key: str
    root: VariableRoot
    path: list[str]


@dataclass
class ActionStepAuthoringMetadata:
    type: str
    label: str
    category: ActionStepCategory
    allowed_targets: list[ActionStepTarget]
    formula_fields: list[str]
    path_catalog: ActionPathCatalog


@dataclass
class ActionPresetTemplate:
    id: str
    label: str
    category: ActionPresetTemplateCategory
    description: str
    steps: list[dict]
    editable_formula_fields: list[str]


@dataclass
class ActionFormulaAuthoringMetadata(ResponseModel):
    variables: list[AuthoringVariablePathMetadata]
    formula_roots: list[VariableRoot]
    action_mutation_roots: list[VariableRoot]
    formula_aliases: list[FormulaAliasMetadata]
    action_steps: list[ActionStepAuthoringMetadata]
    action_preset_templates: list[ActionPresetTemplate]
    type: Literal[
        "action_formula_authoring_metadata"
    ] = "action_formula_authoring_metadata"
    request_id: str | None = None
