import asyncio

from backend.features.auth.tokens import DM_ADMIN_CODE
from backend.features.chat import handler, service
from backend.features.chat.schema import SendRoll20ChatMessageRequest


class FakeBridgeSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)


def test_http_chat_send_delivers_to_connected_bridge() -> None:
    async def scenario() -> None:
        await service.roll20_chat_bridge.reset()
        bridge_socket = FakeBridgeSocket()
        await service.roll20_chat_bridge.connect(bridge_socket)

        response = await handler.send_from_http(
            SendRoll20ChatMessageRequest(
                admin_code=DM_ADMIN_CODE,
                message="http bridge update",
            )
        )

        assert response.type == "roll20_chat_message_sent"
        assert bridge_socket.sent_messages == [
            {
                "message_id": response.message_id,
                "message": "http bridge update",
                "type": "chat_message",
                "request_id": None,
            }
        ]

    asyncio.run(scenario())


def test_http_chat_send_rejects_invalid_admin_code() -> None:
    async def scenario() -> None:
        await service.roll20_chat_bridge.reset()
        try:
            await handler.send_from_http(
                SendRoll20ChatMessageRequest(
                    admin_code="wrong-code",
                    message="http bridge update",
                )
            )
        except PermissionError as exc:
            assert str(exc) == "Invalid DM admin code."
            return

        raise AssertionError("Expected PermissionError")

    asyncio.run(scenario())
