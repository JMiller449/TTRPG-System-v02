import re

from backend.core.request_registry import request_registry
from backend.protocol.generate_typescript import (
    OUTPUT_PATH,
    _build_output,
    _build_route_contract_manifest,
    _resolve_type_discriminant,
)
from backend.protocol.socket import ErrorEvent


def _exported_type_names(output: str) -> set[str]:
    return set(re.findall(r"^export type ([A-Za-z0-9_]+) =", output, re.MULTILINE))


def _union_members(output: str, type_name: str) -> set[str]:
    match = re.search(rf"^export type {type_name} = (.*);$", output, re.MULTILINE)
    assert match is not None, f"Missing generated {type_name} union."
    return set(match.group(1).split(" | "))


def test_typescript_codegen_checked_in_output_is_current() -> None:
    assert OUTPUT_PATH.read_text(encoding="utf-8") == _build_output()


def test_typescript_codegen_route_manifest_matches_registry_metadata() -> None:
    expected_manifest = [
        {
            "type": contract.type_name,
            "requestModel": contract.request_model.__name__,
            "emittedEventTypes": [
                _resolve_type_discriminant(model)
                for model in contract.emitted_event_models
            ],
            "minimumRole": contract.minimum_role,
            "clientNamespace": contract.client_generation.namespace,
            "clientMethodName": contract.client_generation.method_name,
        }
        for contract in request_registry.route_contracts()
        if contract.client_generation is not None
    ]

    assert _build_route_contract_manifest() == expected_manifest


def test_typescript_codegen_exports_registered_request_and_event_models() -> None:
    output = _build_output()
    exported_types = _exported_type_names(output)

    request_model_names = {model.__name__ for model in request_registry.request_models()}
    event_model_names = {
        model.__name__
        for model in (ErrorEvent, *request_registry.emitted_event_models())
    }

    assert request_model_names <= exported_types
    assert event_model_names <= exported_types
    assert _union_members(output, "ProtocolApplicationRequest") == request_model_names
    assert _union_members(output, "ProtocolServerEvent") == event_model_names


def test_typescript_codegen_exports_route_contract_manifest() -> None:
    output = _build_output()

    assert "export type ProtocolRouteContract = {" in output
    assert "export const protocolRouteContracts =" in output
    assert '"type": "authenticate"' in output
    assert '"minimumRole": "unauthenticated"' in output
    assert '"type": "send_roll20_chat_message"' in output
    assert '"clientNamespace": "chat"' in output
    assert '"clientMethodName": "sendRoll20ChatMessage"' in output
    assert '"type": "get_roll20_bridge_status"' in output
    assert '"clientMethodName": "getRoll20BridgeStatus"' in output
    assert '"type": "save_encounter_preset"' in output
    assert '"clientNamespace": "encounterPresets"' in output
    assert '"clientMethodName": "spawnEncounterPreset"' in output
    assert "export type EncounterPresetPayload = {" in output
    assert '"encounter_presets"?: Record<string, EncounterPresetPayload>;' in output
    assert "export type Roll20BridgeStatusEvent = {" in output
    assert '"connected": boolean;' in output
    assert '"type": "resync_state"' in output
    assert '"minimumRole": "player"' in output
    assert "export type UndoLastStateChange = {" in output
    assert '"type": "undo_last_state_change";' in output
    assert '"clientNamespace": "stateSync"' in output
    assert '"clientMethodName": "undoLastStateChange"' in output
    assert '"minimumRole": "dm"' in output
    assert '"type": "perform_action"' in output
    assert '"type": "create_action"' in output
    assert '"clientNamespace": "sheetAdminActions"' in output
    assert '"clientMethodName": "deleteAction"' in output
    assert "export type FormulaReferencePayload = {" in output
    assert '"type": "formula_reference";' in output
    assert '"formula_id": string;' in output
    assert '"type": "create_formula"' in output
    assert '"clientNamespace": "sheetAdminFormulas"' in output
    assert '"clientMethodName": "deleteFormula"' in output
    assert '"tags"?: string[];' in output
    assert '"type": "create_item"' in output
    assert '"clientNamespace": "sheetAdminItems"' in output
    assert '"clientMethodName": "deleteItem"' in output
    assert '"type": "create_proficiency"' in output
    assert '"clientNamespace": "proficiencies"' in output
    assert '"clientMethodName": "deleteProficiency"' in output
    assert "export type ProficiencyDefinitionPayload = {" in output
    assert '"type": "create_sheet"' in output
    assert '"clientNamespace": "sheetAdminSheets"' in output
    assert '"type": "create_instanced_sheet"' in output
    assert '"clientMethodName": "instantiateSheet"' in output
    assert '"clientMethodName": "deleteSheet"' in output
    assert "export type SheetDefinitionPayload = {" in output
    assert "export type ActionHistoryEntryPayload = {" in output
    assert '"sheet_formula_stat_defaults"?: SheetFormulaStatDefaultMetadataEvent[];' in output
    assert "export type SheetFormulaStatDefaultMetadataEvent = {" in output
    assert '"summary": string;' in output
    assert '"mutation_summaries"?: string[];' in output
    assert '"formula_summaries"?: string[];' in output
    assert '"redacted"?: boolean;' in output
    assert '"action_history"?: Record<string, ActionHistoryEntryPayload>;' in output
    assert '"notes"?: string;' in output
    assert '"stats": StatsPayload;' in output
    assert '"resistances"?: ResistancesPayload;' in output
    assert '"actions"?: Record<string, ActionBridgePayload>;' in output
    assert "export type CreateSheet = {" in output
    assert '"sheet": SheetDefinitionPayload;' in output
    assert '"type": "create_sheet";' in output
    assert "export type UpdateSheet = {" in output
    assert '"sheet_id": string;' in output
    assert '"type": "update_sheet";' in output
    assert "export type DeleteSheet = {" in output
    assert '"type": "delete_sheet";' in output
    assert "export type SetSheetNotes = {" in output
    assert '"notes": string;' in output
    assert '"type": "set_sheet_notes";' in output
    assert '"clientNamespace": "sheetAdminNotes"' in output
    assert '"clientMethodName": "setSheetNotes"' in output
    assert "export type CreateInstancedSheet = {" in output
    assert '"instance_id": string;' in output
    assert '"parent_sheet_id": string;' in output
    assert '"notes"?: string;' in output
    assert '"generate_access_code"?: boolean;' in output
    assert "export type SetInstancedSheetNotes = {" in output
    assert '"type": "set_instanced_sheet_notes";' in output
    assert '"clientNamespace": "sheetInstanceNotes"' in output
    assert '"clientMethodName": "setInstancedSheetNotes"' in output
    assert "export type SetInstancedSheetResource = {" in output
    assert '"resource": "health" | "mana";' in output
    assert '"type": "set_instanced_sheet_resource";' in output
    assert "export type AdjustInstancedSheetResource = {" in output
    assert '"delta": number;' in output
    assert '"type": "adjust_instanced_sheet_resource";' in output
    assert "export type ApplyInstancedSheetDamage = {" in output
    assert '"amount": number;' in output
    assert '"type": "apply_instanced_sheet_damage";' in output
    assert '"clientNamespace": "sheetInstanceResources"' in output
    assert '"clientMethodName": "setInstancedSheetResource"' in output
    assert '"clientMethodName": "adjustInstancedSheetResource"' in output
    assert '"clientMethodName": "applyInstancedSheetDamage"' in output
    assert '"type": "create_sheet_action_bridge"' in output
    assert '"clientNamespace": "sheetActionBridges"' in output
    assert '"clientMethodName": "detachAction"' in output
    assert "export type SheetActionBridgePayload = {" in output
    assert '"action_id": string;' in output
    assert "export type CreateSheetActionBridge = {" in output
    assert '"bridge": SheetActionBridgePayload;' in output
    assert "export type UpdateSheetActionBridge = {" in output
    assert '"type": "update_sheet_action_bridge";' in output
    assert "export type DeleteSheetActionBridge = {" in output
    assert '"type": "delete_sheet_action_bridge";' in output
    assert '"type": "create_sheet_item_bridge"' in output
    assert '"clientNamespace": "sheetItemBridges"' in output
    assert '"clientMethodName": "detachItem"' in output
    assert "export type ItemBridgePayload = {" in output
    assert '"count": number;' in output
    assert '"equipped": boolean;' in output
    assert '"item_id": string;' in output
    assert "export type CreateSheetItemBridge = {" in output
    assert '"bridge": ItemBridgePayload;' in output
    assert "export type UpdateSheetItemBridge = {" in output
    assert '"type": "update_sheet_item_bridge";' in output
    assert "export type DeleteSheetItemBridge = {" in output
    assert '"type": "delete_sheet_item_bridge";' in output
    assert '"type": "create_sheet_proficiency_bridge"' in output
    assert '"clientNamespace": "sheetProficiencyBridges"' in output
    assert '"clientMethodName": "unlinkProficiency"' in output
    assert "export type ProficiencyBridgePayload = {" in output
    assert '"prof_id": string;' in output
    assert '"use_count": number;' in output
    assert '"growth_rate": number;' in output
    assert "export type CreateSheetProficiencyBridge = {" in output
    assert '"bridge": ProficiencyBridgePayload;' in output
    assert "export type UpdateSheetProficiencyBridge = {" in output
    assert '"type": "update_sheet_proficiency_bridge";' in output
    assert "export type DeleteSheetProficiencyBridge = {" in output
    assert '"type": "delete_sheet_proficiency_bridge";' in output
    assert '"type": "set_sheet_base_stat"' in output
    assert '"clientNamespace": "sheetAdminStats"' in output
    assert '"clientMethodName": "setSheetFormulaStat"' in output
    assert '"type": "set_sheet_resistances"' in output
    assert '"clientMethodName": "setSheetResistances"' in output
    assert '"type": "get_variable_registry"' in output
    assert '"clientNamespace": "variableRegistry"' in output
    assert '"clientMethodName": "getVariableRegistry"' in output
    assert "export type VariableRegistryEvent" in output
    assert '"type": "get_action_formula_authoring_metadata"' in output
    assert '"clientNamespace": "authoringMetadata"' in output
    assert '"clientMethodName": "getActionFormulaAuthoringMetadata"' in output
    assert "export type ActionFormulaAuthoringMetadataEvent" in output
    assert '"type": "get_augmentation_target_metadata"' in output
    assert '"clientMethodName": "getAugmentationTargetMetadata"' in output
    assert "export type AugmentationTargetMetadataEvent" in output
    assert '"targets": AugmentationTargetMetadataPayload[];' in output
    assert '"allowed_contexts": ("item_template" | "condition_template" | "runtime")[];' in output
    assert "export type PerformAction = {" in output
    assert '"sheet_id": string;' in output
    assert '"action_id": string;' in output
    assert '"target_sheet_id"?: string | null;' in output
    assert '"roll_mode_kind"?: "none" | "check" | "damage";' in output
    assert (
        '"roll_mode"?: "normal" | "advantage" | "disadvantage" | "critical";'
        in output
    )
    assert '"type": "perform_action";' in output
    assert "export type ActionExecutedEvent = {" in output
    assert '"applied_mutations": string[];' in output
    assert '"emitted_messages": string[];' in output
    assert '"requestModel": "PerformAction"' in output
    assert '"emittedEventTypes": [\n      "action_executed",\n      "state_patch"\n    ]' in output
    assert '"clientNamespace": "sheetRuntime"' in output
    assert '"clientMethodName": "performAction"' in output
    assert '"type": "generate_sheet_access_code"' in output
    assert '"clientNamespace": "sheetAccess"' in output
    assert '"clientMethodName": "getSheetAccessCodes"' in output
    assert '"type": "get_xp_tracker";' in output
    assert '"type": "set_sheet_xp_required";' in output
    assert '"type": "set_mob_xp_value";' in output
    assert '"type": "set_sheet_mob_kill_count";' in output
    assert "export type XpTrackerEvent = {" in output
    assert '"can_view_progress": boolean;' in output
    assert "export type ClaimSheetAccessCode = {" in output
    assert '"type": "claim_sheet_access_code";' in output
    assert '"clientMethodName": "claimSheetAccessCode"' in output
    assert "export type SheetAccessClaimedEvent = {" in output
    assert '"type": "sheet_access_claimed";' in output
    assert "export type SheetAccessCodesEvent" in output
    assert '"type": "create_condition_preset"' in output
    assert '"clientNamespace": "conditionPresets"' in output
    assert '"clientMethodName": "deleteConditionPreset"' in output
    assert '"type": "upsert_item_augmentation_template"' in output
    assert '"clientNamespace": "itemAugmentations"' in output
    assert '"clientMethodName": "removeItemAugmentationTemplate"' in output
    assert "export type ApplyAugmentationActionStepPayload" in output
    assert "export type ApplyConditionPresetActionStepPayload" in output
    assert "export type CalculateValueActionStepPayload" in output
    assert "export type CalculatedValueReferencePayload" in output
    assert '"type": "calculate_value"' in output
    assert '"type": "calculated_value"' in output
    assert "export type FormulaModifierSelectorPayload" in output
    assert '"required_tags"?: string[];' in output
    assert '"excluded_tags"?: string[];' in output
    assert '"action_id"?: string | null;' in output
    assert '"formula_id"?: string | null;' in output
    assert '"step_id"?: string | null;' in output
    assert "export type ResolveDamageActionStepPayload" in output
    assert "export type ResolveDamageStepPayload" in output
    assert '"type": "resolve_damage"' in output
    assert '"damage_type": "Arcane" | "Slashing" | "Bludgeoning"' in output
    assert '"augmentation_records" | "condition_presets"' in output
    assert "export type ActionPresetTemplateEvent" in output
    assert '"action_preset_templates": ActionPresetTemplateEvent[]' in output
    assert "export type ActionFactPresetEvent" in output
    assert '"action_fact_presets": ActionFactPresetEvent[]' in output
    assert "export type ResistancesPayload" in output
    assert '"resistances"?: ResistancesPayload' in output
    assert '"value_type": "number" | "percent" | "formula" | "resource"' in output


def test_typescript_codegen_exports_every_registered_request_and_event_model() -> None:
    output = _build_output()

    for request_model in request_registry.request_models():
        assert f"export type {request_model.__name__} =" in output

    for event_model in request_registry.emitted_event_models():
        assert f"export type {event_model.__name__} =" in output


def test_generated_route_manifest_matches_registry_contracts() -> None:
    manifest = _build_route_contract_manifest()
    manifest_by_type = {entry["type"]: entry for entry in manifest}
    generated_contracts = [
        contract
        for contract in request_registry.route_contracts()
        if contract.client_generation is not None
    ]

    assert set(manifest_by_type) == {
        contract.type_name for contract in generated_contracts
    }
    for contract in generated_contracts:
        metadata = contract.client_generation
        assert metadata is not None
        assert manifest_by_type[contract.type_name] == {
            "type": contract.type_name,
            "requestModel": contract.request_model.__name__,
            "emittedEventTypes": [
                _resolve_type_discriminant(model)
                for model in contract.emitted_event_models
            ],
            "minimumRole": contract.minimum_role,
            "clientNamespace": metadata.namespace,
            "clientMethodName": metadata.method_name,
        }
