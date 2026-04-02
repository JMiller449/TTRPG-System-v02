import asyncio

from backend.features.auth.tokens import (
    DM_ADMIN_CODE,
    PLAYER_JOIN_CODE,
    SERVICE_AUTH_CODE,
)
from backend.features.chat import service as chat_service
from backend.features.state_sync import handler as state_sync_handler
from backend.routes.ws import (
    AUTH_CLOSE_CODE,
    authenticate_application_websocket,
    authenticate_service_websocket,
    handle_client_payload,
    websocket_sessions,
)


class FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.sent_messages: list[dict] = []
        self.closed_code: int | None = None

    async def accept(self) -> None:
        self.accepted = True

    async def close(self, code: int) -> None:
        self.closed_code = code

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)

    async def receive_text(self) -> str:
        raise RuntimeError("receive_text not implemented for FakeWebSocket")


def test_connections_start_unauthenticated() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()

        session = await websocket_sessions.connect(websocket)

        assert websocket.accepted is True
        assert session.is_dm is False
        assert session.is_authenticated is False
        assert await websocket_sessions.is_dm(websocket) is False
        assert await websocket_sessions.group_counts() == {
            "dms": 0,
            "players": 0,
        }

    asyncio.run(scenario())


def test_authenticate_application_websocket_accepts_player_code() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket.accept()
        await websocket_sessions.connect(websocket, accept=False)

        session = await authenticate_application_websocket(
            websocket,
            {
                "type": "authenticate",
                "token": PLAYER_JOIN_CODE,
                "request_id": "req-1",
            },
        )

        assert session is not None
        assert session.is_dm is False
        assert session.is_authenticated is True
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "authenticated": True,
                "role": "player",
                "reason": None,
                "type": "authenticate_response",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())


def test_authenticate_application_websocket_accepts_dm_code() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket.accept()
        await websocket_sessions.connect(websocket, accept=False)

        session = await authenticate_application_websocket(
            websocket,
            {
                "type": "authenticate",
                "token": DM_ADMIN_CODE,
                "request_id": "client-supplied-id",
            },
        )

        assert session is not None
        assert session.is_dm is True
        assert await websocket_sessions.group_counts() == {
            "dms": 1,
            "players": 1,
        }
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "authenticated": True,
                "role": "dm",
                "reason": None,
                "type": "authenticate_response",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())


def test_authenticate_application_websocket_rejects_invalid_code() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket.accept()
        await websocket_sessions.connect(websocket, accept=False)

        session = await authenticate_application_websocket(
            websocket,
            {
                "type": "authenticate",
                "token": "wrong-code",
                "request_id": "req-1",
            },
        )

        assert session is None
        assert websocket.closed_code is None
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "authenticated": False,
                "role": None,
                "reason": "Invalid player or DM code.",
                "type": "authenticate_response",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())


def test_authenticate_service_websocket_accepts_service_code() -> None:
    async def scenario() -> None:
        websocket = FakeWebSocket()
        await websocket.accept()

        authenticated = await authenticate_service_websocket(
            websocket,
            {
                "type": "authenticate",
                "token": SERVICE_AUTH_CODE,
                "request_id": "req-1",
            },
        )

        assert authenticated is True
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "authenticated": True,
                "role": "service",
                "reason": None,
                "type": "authenticate_response",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())


def test_authenticate_service_websocket_rejects_non_service_code() -> None:
    async def scenario() -> None:
        websocket = FakeWebSocket()
        await websocket.accept()

        authenticated = await authenticate_service_websocket(
            websocket,
            {
                "type": "authenticate",
                "token": PLAYER_JOIN_CODE,
                "request_id": "req-1",
            },
        )

        assert authenticated is False
        assert websocket.closed_code == AUTH_CLOSE_CODE
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "reason": "Invalid service code.",
                "type": "error",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())


def test_send_roll20_chat_message_fails_when_no_bridge_connected() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        await chat_service.roll20_chat_bridge.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="player")

        await handle_client_payload(
            websocket,
            {
                "type": "send_roll20_chat_message",
                "message": "bridge update",
                "request_id": "ignored-client-id",
            },
        )

        assert websocket.sent_messages == [
            {
                "response_id": None,
                "reason": "Roll20 chat bridge is not connected.",
                "type": "error",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())


def test_unauthenticated_socket_must_authenticate_before_other_requests() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket)

        await handle_client_payload(
            websocket,
            {
                "type": "resync_state",
                "request_id": "client-id-ignored",
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


def test_unauthenticated_socket_can_retry_authentication_without_reconnecting() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket)

        await handle_client_payload(
            websocket,
            {
                "type": "authenticate",
                "token": "wrong-code",
                "request_id": "client-id-ignored",
            },
        )
        await handle_client_payload(
            websocket,
            {
                "type": "authenticate",
                "token": PLAYER_JOIN_CODE,
                "request_id": "another-client-id",
            },
        )

        assert websocket.closed_code is None
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "authenticated": False,
                "role": None,
                "reason": "Invalid player or DM code.",
                "type": "authenticate_response",
                "request_id": "req-1",
            },
            {
                "response_id": None,
                "authenticated": True,
                "role": "player",
                "reason": None,
                "type": "authenticate_response",
                "request_id": "req-2",
            },
            {
                "response_id": None,
                "state": {
                    "actions": {},
                    "formulas": {},
                    "instanced_sheets": {},
                    "items": {},
                    "proficiencies": {},
                    "sheets": {},
                },
                "state_version": 0,
                "type": "state_snapshot",
                "request_id": None,
            },
        ]

    asyncio.run(scenario())


def test_handle_client_payload_bootstraps_player_session_after_authentication() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket)

        await handle_client_payload(
            websocket,
            {
                "type": "authenticate",
                "token": PLAYER_JOIN_CODE,
                "request_id": "client-id-ignored",
            },
        )

        assert websocket.sent_messages == [
            {
                "response_id": None,
                "authenticated": True,
                "role": "player",
                "reason": None,
                "type": "authenticate_response",
                "request_id": "req-1",
            },
            {
                "response_id": None,
                "state": {
                    "actions": {},
                    "formulas": {},
                    "instanced_sheets": {},
                    "items": {},
                    "proficiencies": {},
                    "sheets": {},
                },
                "state_version": 0,
                "type": "state_snapshot",
                "request_id": None,
            },
        ]

    asyncio.run(scenario())


def test_handle_client_payload_bootstraps_dm_session_after_authentication() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket)

        await handle_client_payload(
            websocket,
            {
                "type": "authenticate",
                "token": DM_ADMIN_CODE,
                "request_id": "client-id-ignored",
            },
        )

        assert websocket.sent_messages == [
            {
                "response_id": None,
                "authenticated": True,
                "role": "dm",
                "reason": None,
                "type": "authenticate_response",
                "request_id": "req-1",
            },
            {
                "response_id": None,
                "state": {
                    "actions": {},
                    "formulas": {},
                    "instanced_sheets": {},
                    "items": {},
                    "proficiencies": {},
                    "sheets": {},
                },
                "state_version": 0,
                "type": "state_snapshot",
                "request_id": None,
            },
        ]

    asyncio.run(scenario())


def test_send_roll20_chat_message_delivers_to_connected_roll20_bridge() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        await chat_service.roll20_chat_bridge.reset()
        sender_socket = FakeWebSocket()
        bridge_socket = FakeWebSocket()

        await websocket_sessions.connect(sender_socket, role="player")
        await chat_service.roll20_chat_bridge.connect(bridge_socket)

        await handle_client_payload(
            sender_socket,
            {
                "type": "send_roll20_chat_message",
                "message": "bridge update",
                "request_id": "req-1",
            },
        )

        assert sender_socket.sent_messages == []
        assert bridge_socket.sent_messages == [
            {
                "message_id": bridge_socket.sent_messages[0]["message_id"],
                "message": "bridge update",
                "type": "chat_message",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())


def test_roll20_bridge_events_are_parsed_and_logged(caplog) -> None:
    hello_event = chat_service.parse_bridge_event(
        {
            "type": "hello",
            "source": "roll20_firefox_extension",
            "page_url": "https://app.roll20.net/editor/",
        }
    )
    delivery_event = chat_service.parse_bridge_event(
        {
            "type": "chat_delivery",
            "message_id": "msg-1",
            "success": True,
        }
    )

    with caplog.at_level("INFO"):
        chat_service.handle_bridge_event(hello_event)
        chat_service.handle_bridge_event(delivery_event)

    assert "Roll20 bridge connected from roll20_firefox_extension" in caplog.text
    assert "Roll20 chat message delivered: msg-1" in caplog.text


def test_unknown_request_type_returns_error() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        player_socket = FakeWebSocket()
        await websocket_sessions.connect(player_socket, role="player")

        await handle_client_payload(
            player_socket,
            {
                "type": "unknown_message",
                "request_id": "client-id-ignored",
            },
        )

        assert player_socket.sent_messages == [
            {
                "response_id": None,
                "reason": "Unknown request type: unknown_message",
                "type": "error",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())


def test_state_sync_bootstrap_sends_snapshot() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        session = await websocket_sessions.connect(websocket, role="player")

        await state_sync_handler.send_connection_bootstrap(session)

        assert websocket.sent_messages == [
            {
                "response_id": None,
                "state": {
                    "actions": {},
                    "formulas": {},
                    "instanced_sheets": {},
                    "items": {},
                    "proficiencies": {},
                    "sheets": {},
                },
                "state_version": 0,
                "type": "state_snapshot",
                "request_id": None,
            },
        ]

    asyncio.run(scenario())


def test_resync_state_returns_state_snapshot() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="player")

        await handle_client_payload(
            websocket,
            {
                "type": "resync_state",
                "request_id": "req-1",
            },
        )

        assert websocket.sent_messages == [
            {
                "response_id": None,
                "state": {
                    "actions": {},
                    "formulas": {},
                    "instanced_sheets": {},
                    "items": {},
                    "proficiencies": {},
                    "sheets": {},
                },
                "state_version": 0,
                "type": "state_snapshot",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())
