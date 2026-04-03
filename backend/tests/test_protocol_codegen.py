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
