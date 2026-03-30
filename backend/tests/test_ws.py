import asyncio

from backend.routes.ws import (
    DM_ADMIN_CODE,
    handle_client_payload,
    websocket_sessions,
)


class FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)


def test_connections_start_as_players() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()

        session = await websocket_sessions.connect(websocket)

        assert websocket.accepted is True
        assert session.is_dm is False
        assert await websocket_sessions.is_dm(websocket) is False
        assert await websocket_sessions.group_counts() == {
            "dms": 0,
            "players": 1,
        }

    asyncio.run(scenario())


def test_elevate_to_dm_returns_success() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket)

        await handle_client_payload(
            websocket,
            {
                "type": "elevate_to_dm",
                "admin_code": DM_ADMIN_CODE,
                "request_id": "req-1",
            },
        )

        assert await websocket_sessions.is_dm(websocket) is True
        assert await websocket_sessions.group_counts() == {
            "dms": 1,
            "players": 1,
        }
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "success": True,
                "is_dm": True,
                "reason": None,
                "type": "elevate_to_dm_response",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())


def test_elevate_to_dm_rejects_invalid_admin_code() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket)

        await handle_client_payload(
            websocket,
            {
                "type": "elevate_to_dm",
                "admin_code": "wrong-code",
                "request_id": "req-2",
            },
        )

        assert await websocket_sessions.is_dm(websocket) is False
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "success": False,
                "is_dm": False,
                "reason": "Invalid DM admin code.",
                "type": "elevate_to_dm_response",
                "request_id": "req-2",
            }
        ]

    asyncio.run(scenario())


def test_chat_update_to_players_reaches_everyone() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        dms_socket = FakeWebSocket()
        player_socket = FakeWebSocket()
        another_player_socket = FakeWebSocket()

        await websocket_sessions.connect(dms_socket)
        await websocket_sessions.connect(player_socket)
        await websocket_sessions.connect(another_player_socket)
        await websocket_sessions.elevate_to_dm(dms_socket)

        await handle_client_payload(
            dms_socket,
            {
                "type": "chat_update",
                "message": "player update",
                "target_group": "players",
            },
        )

        expected_message = {
            "response_id": None,
            "type": "chat_update",
            "message": "player update",
            "target_group": "players",
            "request_id": None,
        }
        assert dms_socket.sent_messages == [expected_message]
        assert player_socket.sent_messages == [expected_message]
        assert another_player_socket.sent_messages == [expected_message]

    asyncio.run(scenario())


def test_chat_update_to_dms_reaches_only_dms() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        dms_socket = FakeWebSocket()
        player_socket = FakeWebSocket()

        await websocket_sessions.connect(dms_socket)
        await websocket_sessions.connect(player_socket)
        await websocket_sessions.elevate_to_dm(dms_socket)

        await handle_client_payload(
            dms_socket,
            {
                "type": "chat_update",
                "message": "dm update",
                "target_group": "dms",
            },
        )

        assert dms_socket.sent_messages == [
            {
                "response_id": None,
                "type": "chat_update",
                "message": "dm update",
                "target_group": "dms",
                "request_id": None,
            }
        ]
        assert player_socket.sent_messages == []

    asyncio.run(scenario())
