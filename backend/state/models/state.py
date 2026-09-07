from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from backend.state.models.action_history import (
    ActionHistoryEntry,
    prune_action_history,
)
from backend.state.models.action import Action, ApplyAugmentationStep
from backend.state.models.access_code import SheetAccessCode
from backend.state.models.augmentation import (
    Augmentation,
    DirectEffectProjection,
    EvaluationFormulaModifierEffect,
    FormulaModifierEffect,
    StandaloneEffectApplication,
    StandaloneEffectDefinition,
)
from backend.state.models.condition import ActiveCondition, ConditionPreset
from backend.state.models.catalog import (
    CatalogEntry,
    CatalogFolder,
    validate_catalog_organization,
)
from backend.state.models.encounter import EncounterPreset
from backend.state.models.formula import FormulaDefinition, FormulaReference
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
from backend.state.models.tag import TagDefinition, seeded_tag_definitions
from backend.state.models.xp_progression import XpProgression
from backend.state.models.xp import KillRecord, Party, XpAdjustment
from backend.state.models.contribution_points import ContributionPointTransaction


@dataclass
class State:
    xp_progression: XpProgression = field(default_factory=XpProgression)
    action_history: dict[str, ActionHistoryEntry] = field(default_factory=dict)
    parties: dict[str, Party] = field(default_factory=dict)
    kill_registry: dict[str, KillRecord] = field(default_factory=dict)
    xp_adjustments: dict[str, XpAdjustment] = field(default_factory=dict)
    contribution_point_transactions: dict[str, ContributionPointTransaction] = field(
        default_factory=dict
    )
    player_kill_visibility: dict[str, bool] = field(default_factory=dict)
    catalog_folders: dict[str, CatalogFolder] = field(default_factory=dict)
    catalog_entries: dict[str, CatalogEntry] = field(default_factory=dict)
    sheets: dict[str, Sheet] = field(default_factory=dict)
    instanced_sheets: dict[str, InstancedSheet] = field(default_factory=dict)
    formulas: dict[str, FormulaDefinition] = field(default_factory=dict)
    attributes: dict[str, AttributeDefinition] = field(default_factory=dict)
    actions: dict[str, Action] = field(default_factory=dict)
    items: dict[str, Item] = field(default_factory=dict)
    item_templates: dict[str, Item] = field(default_factory=dict)
    proficiencies: dict[str, Proficiency] = field(default_factory=dict)
    tags: dict[str, TagDefinition] = field(default_factory=seeded_tag_definitions)
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
        for formula_id, definition in self.formulas.items():
            if definition.id != formula_id:
                raise ValueError(
                    f"Formula registry key '{formula_id}' does not match "
                    f"definition ID '{definition.id}'."
                )

        def require_formula_reference(
            value: object,
            *,
            consumer: str,
        ) -> None:
            if (
                isinstance(value, FormulaReference)
                and value.formula_id not in self.formulas
            ):
                raise ValueError(
                    f"{consumer} references missing formula '{value.formula_id}'."
                )

        for attribute_id, definition in self.attributes.items():
            require_formula_reference(
                definition.default_value.formula,
                consumer=f"Attribute '{attribute_id}'",
            )
        for registry_name, registry in (
            ("Sheet", self.sheets),
            ("Sheet instance", self.instanced_sheets),
            ("Item", self.items),
            ("Item template", self.item_templates),
            ("Action", self.actions),
        ):
            for owner_id, owner in registry.items():
                for bridge in owner.attributes.values():
                    require_formula_reference(
                        bridge.value.formula,
                        consumer=(
                            f"{registry_name} '{owner_id}' Attribute "
                            f"'{bridge.attribute_id}'"
                        ),
                    )
        for effect_id, definition in self.standalone_effects.items():
            if isinstance(
                definition.effect,
                FormulaModifierEffect | EvaluationFormulaModifierEffect,
            ):
                require_formula_reference(
                    definition.effect.value,
                    consumer=f"Effect '{effect_id}'",
                )
        for action_id, action in self.actions.items():
            for formula_id in action.referenced_formula_ids():
                if formula_id not in self.formulas:
                    raise ValueError(
                        f"Action '{action_id}' references missing formula "
                        f"'{formula_id}'."
                    )
        for sheet in self.sheets.values():
            synchronize_all_sheet_attributes(sheet, self.formulas)
        for instance in self.instanced_sheets.values():
            synchronize_all_sheet_attributes(instance, self.formulas)
        for item in self.items.values():
            synchronize_required_item_attributes(item, self.attributes, self.formulas)
        for template in self.item_templates.values():
            synchronize_required_item_attributes(template, self.attributes, self.formulas)
        for item in (*self.items.values(), *self.item_templates.values()):
            if len(item.effect_ids) != len(set(item.effect_ids)):
                raise ValueError(f"Item '{item.id}' contains duplicate effect references.")
            for effect_id in item.effect_ids:
                if effect_id not in self.standalone_effects:
                    raise ValueError(
                        f"Item '{item.id}' references missing effect '{effect_id}'."
                    )
        for condition in self.condition_presets.values():
            if len(condition.effect_ids) != len(set(condition.effect_ids)):
                raise ValueError(
                    f"Condition '{condition.id}' contains duplicate effect references."
                )
            for effect_id in condition.effect_ids:
                if effect_id not in self.standalone_effects:
                    raise ValueError(
                        f"Condition '{condition.id}' references missing effect "
                        f"'{effect_id}'."
                    )
        for action in self.actions.values():
            for step in action.steps:
                if (
                    isinstance(step, ApplyAugmentationStep)
                    and step.augmentation_id not in self.standalone_effects
                ):
                    raise ValueError(
                        f"Action '{action.id}' references missing effect "
                        f"'{step.augmentation_id}'."
                    )
            evaluate_all_subject_attributes(action, self.formulas)
        for application in self.standalone_effect_applications.values():
            if application.definition_id not in self.standalone_effects:
                raise ValueError(
                    f"Effect application '{application.application_id}' references "
                    f"missing effect '{application.definition_id}'."
                )
        assigned_party_members: set[str] = set()
        for party in self.parties.values():
            if len(party.member_instance_ids) != len(set(party.member_instance_ids)):
                raise ValueError(f"Party '{party.id}' contains duplicate members.")
            for instance_id in party.member_instance_ids:
                if instance_id in assigned_party_members:
                    raise ValueError(
                        f"Instance '{instance_id}' belongs to more than one party."
                    )
                instance = self.instanced_sheets.get(instance_id)
                parent = self.sheets.get(instance.parent_id) if instance else None
                if instance is None or parent is None or parent.dm_only:
                    raise ValueError(
                        f"Party '{party.id}' references invalid player instance "
                        f"'{instance_id}'."
                    )
                assigned_party_members.add(instance_id)
        for item in self.items.values():
            for instance_id in item.player_catalog_access.instance_ids:
                instance = self.instanced_sheets.get(instance_id)
                parent = self.sheets.get(instance.parent_id) if instance else None
                if instance is None or parent is None or parent.dm_only:
                    raise ValueError(
                        f"Item '{item.id}' player catalog access references invalid "
                        f"player instance '{instance_id}'."
                    )
        validate_catalog_organization(
            self.catalog_folders,
            self.catalog_entries,
            entity_ids={
                "actions": set(self.actions),
                "attributes": set(self.attributes),
                "conditions": set(self.condition_presets),
                "effects": set(self.standalone_effects),
                "formulas": set(self.formulas),
                "item_templates": set(self.item_templates),
                "items": set(self.items),
                "proficiencies": set(self.proficiencies),
                "sheet_instances": set(self.instanced_sheets),
                "sheet_templates": set(self.sheets),
                "tags": set(self.tags),
            },
        )

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
            parties={
                key: Party.from_dict(party)
                for key, party in raw.get("parties", {}).items()
            },
            kill_registry={
                key: KillRecord.from_dict(record)
                for key, record in raw.get("kill_registry", {}).items()
            },
            xp_progression=XpProgression.from_dict(raw.get("xp_progression", {})),
            xp_adjustments={
                key: XpAdjustment.from_dict(adjustment)
                for key, adjustment in raw.get("xp_adjustments", {}).items()
            },
            contribution_point_transactions={
                key: ContributionPointTransaction.from_dict(transaction)
                for key, transaction in raw.get("contribution_point_transactions", {}).items()
            },
            player_kill_visibility={
                str(sheet_id): True
                for sheet_id, visible in raw.get(
                    "player_kill_visibility", {}
                ).items()
                if visible is True
            },
            catalog_folders={
                key: CatalogFolder.from_dict(folder)
                for key, folder in raw.get("catalog_folders", {}).items()
            },
            catalog_entries={
                key: CatalogEntry.from_dict(entry)
                for key, entry in raw.get("catalog_entries", {}).items()
            },
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
            item_templates={
                key: Item.from_dict(item)
                for key, item in raw.get("item_templates", {}).items()
            },
            proficiencies={
                key: Proficiency.from_dict(proficiency)
                for key, proficiency in raw.get("proficiencies", {}).items()
            },
            tags={
                key: TagDefinition.from_dict(tag)
                for key, tag in raw.get("tags", {}).items()
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
            state.pop("xp_progression", None)
        return state
