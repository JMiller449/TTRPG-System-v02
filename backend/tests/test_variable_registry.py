import asyncio

from backend.features.variable_registry import service
from backend.routes.ws import handle_client_payload, websocket_sessions


class FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)

    async def receive_text(self) -> str:
        raise RuntimeError("receive_text not implemented for FakeWebSocket")


def test_variable_registry_exposes_canonical_paths_only() -> None:
    registry = service.build_variable_registry(request_id="req-1")
    variables = {variable.key: variable for variable in registry.variables}

    assert variables["sheet.stats.strength"].root == "sheet"
    assert variables["sheet.stats.strength"].path == ["stats", "strength"]
    assert variables["sheet.stats.strength"].value_type == "number"
    assert variables["sheet.stats.strength"].editable_roles == ["dm"]

    assert variables["sheet.stats.health"].root == "sheet"
    assert variables["sheet.stats.health"].path == ["stats", "health"]
    assert variables["sheet.stats.health"].value_type == "formula"
    assert variables["sheet.stats.health"].formula_backed is True

    assert variables["instance.health"].root == "instance"
    assert variables["instance.health"].path == ["health"]
    assert variables["instance.health"].value_type == "resource"
    assert variables["instance.health"].editable_roles == ["player", "dm"]

    assert "sheet.items" not in variables
    assert "raw_path" not in variables


def test_player_can_request_variable_registry() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="player")

        await handle_client_payload(
            websocket,
            {
                "type": "get_variable_registry",
                "request_id": "client-id-ignored",
            },
        )

        assert websocket.sent_messages[0]["type"] == "variable_registry"
        assert websocket.sent_messages[0]["request_id"] == "req-1"
        variables = {
            variable["key"]: variable
            for variable in websocket.sent_messages[0]["variables"]
        }
        assert variables["sheet.stats.arcane"]["path"] == ["stats", "arcane"]
        assert variables["instance.mana"]["value_type"] == "resource"

    asyncio.run(scenario())


def test_unauthenticated_client_cannot_request_variable_registry() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="unauthenticated")

        await handle_client_payload(
            websocket,
            {
                "type": "get_variable_registry",
            },
        )

        assert websocket.sent_messages == [
            {
                "response_id": None,
                "reason": "Authenticate first.",
                "type": "error",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())
