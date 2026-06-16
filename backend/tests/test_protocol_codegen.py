from backend.protocol.generate_typescript import _build_output


def test_typescript_codegen_exports_route_contract_manifest() -> None:
    output = _build_output()

    assert "export type ProtocolRouteContract = {" in output
    assert "export const protocolRouteContracts =" in output
    assert '"type": "authenticate"' in output
    assert '"minimumRole": "unauthenticated"' in output
    assert '"type": "send_roll20_chat_message"' in output
    assert '"clientNamespace": "chat"' in output
    assert '"clientMethodName": "sendRoll20ChatMessage"' in output
    assert '"type": "resync_state"' in output
    assert '"minimumRole": "player"' in output
    assert '"type": "perform_action"' in output
    assert '"type": "create_action"' in output
    assert '"clientNamespace": "sheetAdminActions"' in output
    assert '"clientMethodName": "deleteAction"' in output
    assert '"type": "create_formula"' in output
    assert '"clientNamespace": "sheetAdminFormulas"' in output
    assert '"clientMethodName": "deleteFormula"' in output
    assert '"type": "create_item"' in output
    assert '"clientNamespace": "sheetAdminItems"' in output
    assert '"clientMethodName": "deleteItem"' in output
    assert '"type": "create_sheet"' in output
    assert '"clientNamespace": "sheetAdminSheets"' in output
    assert '"type": "create_instanced_sheet"' in output
    assert '"clientMethodName": "createInstancedSheet"' in output
    assert '"clientMethodName": "deleteSheet"' in output
    assert '"type": "create_sheet_action_bridge"' in output
    assert '"clientNamespace": "sheetActionBridges"' in output
    assert '"clientMethodName": "deleteSheetActionBridge"' in output
    assert '"type": "create_sheet_item_bridge"' in output
    assert '"clientNamespace": "sheetItemBridges"' in output
    assert '"clientMethodName": "deleteSheetItemBridge"' in output
    assert '"type": "create_sheet_proficiency_bridge"' in output
    assert '"clientNamespace": "sheetProficiencyBridges"' in output
    assert '"clientMethodName": "deleteSheetProficiencyBridge"' in output
    assert '"type": "set_sheet_base_stat"' in output
    assert '"clientNamespace": "sheetAdminStats"' in output
    assert '"clientMethodName": "setSheetFormulaStat"' in output
    assert '"type": "get_variable_registry"' in output
    assert '"clientNamespace": "variableRegistry"' in output
    assert '"clientMethodName": "getVariableRegistry"' in output
    assert "export type VariableRegistryEvent" in output
    assert '"type": "get_action_formula_authoring_metadata"' in output
    assert '"clientNamespace": "authoringMetadata"' in output
    assert '"clientMethodName": "getActionFormulaAuthoringMetadata"' in output
    assert "export type ActionFormulaAuthoringMetadataEvent" in output
    assert '"type": "generate_sheet_access_code"' in output
    assert '"clientNamespace": "sheetAccess"' in output
    assert '"clientMethodName": "getSheetAccessCodes"' in output
    assert "export type SheetAccessCodesEvent" in output
    assert '"type": "create_condition_preset"' in output
    assert '"clientNamespace": "conditionPresets"' in output
    assert '"clientMethodName": "deleteConditionPreset"' in output
    assert '"type": "upsert_item_augmentation_template"' in output
    assert '"clientNamespace": "itemAugmentations"' in output
    assert '"clientMethodName": "removeItemAugmentationTemplate"' in output
    assert "export type ApplyAugmentationActionStepPayload" in output
    assert "export type ApplyConditionPresetActionStepPayload" in output
    assert '"augmentation_records" | "condition_presets"' in output
    assert "export type ActionPresetTemplateEvent" in output
    assert '"action_preset_templates": ActionPresetTemplateEvent[]' in output
    assert "export type ResistancesPayload" in output
    assert '"resistances"?: ResistancesPayload' in output
    assert '"value_type": "number" | "percent" | "formula" | "resource"' in output
