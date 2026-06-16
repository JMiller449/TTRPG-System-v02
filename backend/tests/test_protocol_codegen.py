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
    assert '"type": "set_sheet_base_stat"' in output
    assert '"clientNamespace": "sheetAdminStats"' in output
    assert '"clientMethodName": "setSheetFormulaStat"' in output
    assert '"type": "get_variable_registry"' in output
    assert '"clientNamespace": "variableRegistry"' in output
    assert '"clientMethodName": "getVariableRegistry"' in output
    assert "export type VariableRegistryEvent" in output
    assert '"type": "create_condition_preset"' in output
    assert '"clientNamespace": "conditionPresets"' in output
    assert '"clientMethodName": "deleteConditionPreset"' in output
    assert '"type": "upsert_item_augmentation_template"' in output
    assert '"clientNamespace": "itemAugmentations"' in output
    assert '"clientMethodName": "removeItemAugmentationTemplate"' in output
