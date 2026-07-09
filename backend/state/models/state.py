from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from backend.state.models.action_history import (
    ActionHistoryEntry,
    prune_action_history,
)
from backend.state.models.action import Action
from backend.state.models.access_code import SheetAccessCode
from backend.state.models.augmentation import (
    Augmentation,
    DirectEffectProjection,
    StandaloneEffectApplication,
    StandaloneEffectDefinition,
)
from backend.state.models.condition import ActiveCondition, ConditionPreset
from backend.state.models.encounter import EncounterPreset
from backend.state.models.formula import FormulaDefinition
from backend.state.models.attribute import (
    AttributeDefinition,
    evaluate_all_subject_attributes,
    backend_attribute_definitions,
    synchronize_all_sheet_attributes,
    synchronize_required_item_attributes,
)
from backend.state.models.item import Item
from backend.state.models.proficiency import Proficiency
from backend.state.models.sheet import InstancedSheet, Sheet


@dataclass
class State:
    action_history: dict[str, ActionHistoryEntry] = field(default_factory=dict)
    sheets: dict[str, Sheet] = field(default_factory=dict)
    instanced_sheets: dict[str, InstancedSheet] = field(default_factory=dict)
    formulas: dict[str, FormulaDefinition] = field(default_factory=dict)
    attributes: dict[str, AttributeDefinition] = field(default_factory=dict)
    actions: dict[str, Action] = field(default_factory=dict)
    items: dict[str, Item] = field(default_factory=dict)
    proficiencies: dict[str, Proficiency] = field(default_factory=dict)
    augmentations: dict[str, Augmentation] = field(default_factory=dict)
    standalone_effects: dict[str, StandaloneEffectDefinition] = field(
        default_factory=dict
    )
    standalone_effect_applications: dict[str, StandaloneEffectApplication] = field(
        default_factory=dict
    )
    direct_effect_projections: dict[str, DirectEffectProjection] = field(
        default_factory=dict
    )
    condition_presets: dict[str, ConditionPreset] = field(default_factory=dict)
    active_conditions: dict[str, ActiveCondition] = field(default_factory=dict)
    encounter_presets: dict[str, EncounterPreset] = field(default_factory=dict)
    sheet_access_codes: dict[str, SheetAccessCode] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.attributes.update(backend_attribute_definitions())
        for sheet in self.sheets.values():
            synchronize_all_sheet_attributes(sheet)
        for item in self.items.values():
            synchronize_required_item_attributes(item, self.attributes)
        for action in self.actions.values():
            evaluate_all_subject_attributes(action)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "State":
        raw_attributes = raw.get("attributes", raw.get("facts", {}))
        sheets = {
            key: Sheet.from_dict(sheet)
            for key, sheet in raw.get("sheets", {}).items()
        }
        instanced_sheets = {
            key: InstancedSheet.from_dict(
                sheet,
                template=sheets.get(sheet.get("parent_id")),
            )
            for key, sheet in raw.get("instanced_sheets", {}).items()
        }
        return cls(
            action_history=prune_action_history(
                {
                    key: ActionHistoryEntry.from_dict(entry)
                    for key, entry in raw.get("action_history", {}).items()
                }
            ),
            sheets=sheets,
            instanced_sheets=instanced_sheets,
            formulas={
                key: FormulaDefinition.from_dict(formula)
                for key, formula in raw.get("formulas", {}).items()
            },
            attributes={
                key: AttributeDefinition.from_dict(attribute)
                for key, attribute in raw_attributes.items()
            },
            actions={
                key: Action.from_dict(action)
                for key, action in raw.get("actions", {}).items()
            },
            items={
                key: Item.from_dict(item) for key, item in raw.get("items", {}).items()
            },
            proficiencies={
                key: Proficiency.from_dict(proficiency)
                for key, proficiency in raw.get("proficiencies", {}).items()
            },
            augmentations={
                key: Augmentation.from_dict(augmentation)
                for key, augmentation in raw.get("augmentations", {}).items()
            },
            standalone_effects={
                key: StandaloneEffectDefinition.from_dict(effect)
                for key, effect in raw.get("standalone_effects", {}).items()
            },
            standalone_effect_applications={
                key: StandaloneEffectApplication.from_dict(application)
                for key, application in raw.get(
                    "standalone_effect_applications", {}
                ).items()
            },
            direct_effect_projections={
                key: DirectEffectProjection.from_dict(projection)
                for key, projection in raw.get(
                    "direct_effect_projections", {}
                ).items()
            },
            condition_presets={
                key: ConditionPreset.from_dict(condition)
                for key, condition in raw.get("condition_presets", {}).items()
            },
            active_conditions={
                key: ActiveCondition.from_dict(condition)
                for key, condition in raw.get("active_conditions", {}).items()
            },
            encounter_presets={
                key: EncounterPreset.from_dict(encounter)
                for key, encounter in raw.get("encounter_presets", {}).items()
            },
            sheet_access_codes={
                key: SheetAccessCode.from_dict(access_code)
                for key, access_code in raw.get("sheet_access_codes", {}).items()
            },
        )

    def to_dict(self, *, include_private: bool = False) -> dict[str, Any]:
        state = asdict(self)
        if not include_private:
            state.pop("sheet_access_codes", None)
            state.pop("direct_effect_projections", None)
        return state
