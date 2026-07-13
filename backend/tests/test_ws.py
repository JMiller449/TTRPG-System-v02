import asyncio
import json
from copy import deepcopy
from dataclasses import asdict

import pytest
from pydantic import ValidationError

from backend.features.auth.tokens import (
    DM_ADMIN_CODE,
    PLAYER_JOIN_CODE,
    SERVICE_AUTH_CODE,
)
from backend.features.chat import service as chat_service
from backend.features.state_sync import handler as state_sync_handler
from backend.features.state_sync.service import state_sync_service
from backend.routes.ws import (
    AUTH_CLOSE_CODE,
    BRIDGE_REPLACED_CLOSE_CODE,
    BRIDGE_REPLACED_CLOSE_REASON,
    _assign_request_id,
    authenticate_application_websocket,
    authenticate_service_websocket,
    handle_client_payload,
    websocket_sessions,
)
from backend.state.models.action import Action
from backend.state.models.access_code import SheetAccessCode
from backend.state.models.sheet import InstancedSheet, Sheet
from backend.state.migrations import CURRENT_STATE_SCHEMA_VERSION, build_persisted_state
from backend.state.store import DEFAULT_STATE, StateSingleton


class FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.sent_messages: list[dict] = []
        self.closed_code: int | None = None
        self.closed_reason: str | None = None

    async def accept(self) -> None:
        self.accepted = True

    async def close(self, code: int, reason: str | None = None) -> None:
        self.closed_code = code
        self.closed_reason = reason

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)
        if payload.get("type") == "chat_message":
            chat_service.roll20_chat_bridge.acknowledge_delivery(
                chat_service.Roll20ChatDelivery(
                    message_id=payload["message_id"],
                    success=True,
                    type="chat_delivery",
                ),
                websocket=self,
            )

    async def receive_text(self) -> str:
        raise RuntimeError("receive_text not implemented for FakeWebSocket")


@pytest.fixture(autouse=True)
def reset_state() -> None:
    StateSingleton._state = deepcopy(DEFAULT_STATE)
    asyncio.run(state_sync_service.reset())


def test_assign_request_id_preserves_valid_client_id_and_generates_missing_id() -> None:
    payload, request_id = _assign_request_id(
        {"type": "resync_state", "request_id": "client-request-1"}
    )
    assert request_id == "client-request-1"
    assert payload["request_id"] == "client-request-1"

    generated_payload, generated_request_id = _assign_request_id(
        {"type": "resync_state"}
    )
    assert generated_request_id == "req-1"
    assert generated_payload["request_id"] == "req-1"


def test_roll20_bridge_connect_and_disconnect_broadcast_status() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        await chat_service.roll20_chat_bridge.reset()
        app_socket = FakeWebSocket()
        bridge_socket = FakeWebSocket()
        await websocket_sessions.connect(app_socket, role="dm")

        await chat_service.roll20_chat_bridge.connect(bridge_socket)
        await chat_service.broadcast_bridge_statuses()
        await chat_service.roll20_chat_bridge.disconnect(bridge_socket)
        await chat_service.broadcast_bridge_statuses()

        assert app_socket.sent_messages == [
            {
                "response_id": None,
                "connected": True,
                "binding_key": "dm",
                "binding_label": "DM",
                "type": "roll20_bridge_status",
                "request_id": None,
            },
            {
                "response_id": None,
                "connected": False,
                "binding_key": "dm",
                "binding_label": "DM",
                "type": "roll20_bridge_status",
                "request_id": None,
            },
        ]

    asyncio.run(scenario())


def _formula_payload(text: str, aliases: list[dict] | None = None) -> dict:
    return {
        "aliases": aliases,
        "text": text,
    }


def _build_sheet_state() -> Sheet:
    return Sheet.from_dict(
        {
            "id": "mage_template",
            "name": "Mage Template",
            "dm_only": False,
            "xp_given_when_slayed": 25,
            "xp_cap": "A",
            "proficiencies": {},
            "items": {},
            "stats": {
                "strength": 10,
                "dexterity": 11,
                "constitution": 12,
                "perception": 13,
                "arcane": 14,
                "will": 15,
                "lifting": _formula_payload("@strength * 2"),
                "carry_weight": _formula_payload("@strength * 3"),
                "acrobatics": _formula_payload("@dexterity"),
                "stamina": _formula_payload("@constitution"),
                "reaction_time": _formula_payload("@dexterity"),
                "health": _formula_payload("@constitution * 10"),
                "endurance": _formula_payload("@constitution * 2"),
                "pain_tolerance": _formula_payload("@will"),
                "sight_distance": _formula_payload("@perception * 4"),
                "intuition": _formula_payload("@perception"),
                "registration": _formula_payload("@arcane"),
                "mana": _formula_payload("@arcane * 8"),
                "control": _formula_payload("@arcane"),
                "sensitivity": _formula_payload("@arcane"),
                "charisma": _formula_payload("@will"),
                "mental_fortitude": _formula_payload("@will * 2"),
                "courage": _formula_payload("@will"),
            },
            "slayed_record": {},
            "actions": {
                "spend": {
                    "relationship_id": "bridge-1",
                    "entry_id": "spend_mana",
                },
                "announce": {
                    "relationship_id": "bridge-2",
                    "entry_id": "announce",
                },
            },
        }
    )


def _build_instance_state() -> InstancedSheet:
    return InstancedSheet.from_dict(
        {
            "parent_id": "mage_template",
            "health": 90,
            "mana": 30,
            "augments": {},
        }
    )


async def _connect_assigned_player(websocket: FakeWebSocket) -> None:
    await websocket_sessions.connect(websocket, role="player")
    await websocket_sessions.assign_player_sheet(
        websocket,
        sheet_id="mage_template",
        instance_id="mage_instance",
    )


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
                "request_id": "client-supplied-id",
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
                "request_id": "client-supplied-id",
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
                "request_id": "client-supplied-id",
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
                "request_id": "req-status",
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
                "request_id": "req-status",
            }
        ]

    asyncio.run(scenario())


def test_authenticate_application_websocket_rejects_service_code() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket.accept()
        await websocket_sessions.connect(websocket, accept=False)

        session = await authenticate_application_websocket(
            websocket,
            {
                "type": "authenticate",
                "token": SERVICE_AUTH_CODE,
                "request_id": "req-service-app-auth",
            },
        )

        assert session is None
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "authenticated": False,
                "role": None,
                "reason": "Invalid player or DM code.",
                "type": "authenticate_response",
                "request_id": "req-service-app-auth",
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
                "request_id": "client-id-ignored",
            },
        )

        assert authenticated == chat_service.Roll20BridgeBinding(
            key="dm", role="dm", label="DM"
        )
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "authenticated": True,
                "role": "service",
                "reason": None,
                "type": "authenticate_response",
                "request_id": "client-id-ignored",
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

        assert authenticated is None
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
        await websocket_sessions.connect(websocket, role="dm")

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
                "reason": "Roll20 chat bridge is not connected for this user.",
                "type": "error",
                "request_id": "ignored-client-id",
            }
        ]

    asyncio.run(scenario())


def test_get_roll20_bridge_status_reports_disconnected() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        await chat_service.roll20_chat_bridge.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="dm")

        await handle_client_payload(
            websocket,
            {
                "type": "get_roll20_bridge_status",
                "request_id": "req-status",
            },
        )

        assert websocket.sent_messages == [
            {
                "response_id": None,
                "connected": False,
                "binding_key": "dm",
                "binding_label": "DM",
                "type": "roll20_bridge_status",
                "request_id": "req-status",
            }
        ]

    asyncio.run(scenario())


def test_get_roll20_bridge_status_reports_connected() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        await chat_service.roll20_chat_bridge.reset()
        websocket = FakeWebSocket()
        bridge_socket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="dm")
        await chat_service.roll20_chat_bridge.connect(bridge_socket)

        await handle_client_payload(
            websocket,
            {
                "type": "get_roll20_bridge_status",
                "request_id": "req-status",
            },
        )

        assert websocket.sent_messages == [
            {
                "response_id": None,
                "connected": True,
                "binding_key": "dm",
                "binding_label": "DM",
                "type": "roll20_bridge_status",
                "request_id": "req-status",
            }
        ]

    asyncio.run(scenario())


def test_get_roll20_bridge_sync_config_returns_scoped_tokens() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        dm_socket = FakeWebSocket()
        player_socket = FakeWebSocket()
        await websocket_sessions.connect(dm_socket, role="dm")
        state = StateSingleton.getState()
        state.sheets["mage_template"] = _build_sheet_state()
        state.instanced_sheets["mage_instance"] = _build_instance_state()
        await _connect_assigned_player(player_socket)

        await handle_client_payload(
            dm_socket,
            {
                "type": "get_roll20_bridge_sync_config",
                "request_id": "req-sync-dm",
            },
        )
        await handle_client_payload(
            player_socket,
            {
                "type": "get_roll20_bridge_sync_config",
                "request_id": "req-sync-player",
            },
        )

        dm_event = dm_socket.sent_messages[0]
        player_event = player_socket.sent_messages[0]
        assert dm_event["binding_key"] == "dm"
        assert dm_event["binding_label"] == "DM"
        assert dm_event["request_id"] == "req-sync-dm"
        assert chat_service.authenticate_bridge_token(
            dm_event["bridge_auth_token"]
        ) == chat_service.Roll20BridgeBinding(key="dm", role="dm", label="DM")
        assert player_event["binding_key"] == "instance:mage_instance"
        assert player_event["binding_label"] == "Mage Template"
        assert player_event["request_id"] == "req-sync-player"
        assert chat_service.authenticate_bridge_token(
            player_event["bridge_auth_token"]
        ) == chat_service.Roll20BridgeBinding(
            key="instance:mage_instance",
            role="player",
            label="Mage Template",
            instance_id="mage_instance",
        )

    asyncio.run(scenario())


def test_roll20_bridge_newest_connection_wins_without_stale_disconnect() -> None:
    async def scenario() -> None:
        await chat_service.roll20_chat_bridge.reset()
        first_socket = FakeWebSocket()
        second_socket = FakeWebSocket()

        assert await chat_service.roll20_chat_bridge.connect(first_socket) is None
        replaced = await chat_service.roll20_chat_bridge.connect(second_socket)
        assert replaced is first_socket

        await replaced.close(
            code=BRIDGE_REPLACED_CLOSE_CODE,
            reason=BRIDGE_REPLACED_CLOSE_REASON,
        )
        await chat_service.roll20_chat_bridge.disconnect(first_socket)
        await chat_service.roll20_chat_bridge.send(
            chat_service.Roll20ChatMessage(message_id="msg-newest", message="once")
        )

        assert first_socket.closed_code == 4001
        assert first_socket.closed_reason == "bridge_replaced"
        assert first_socket.sent_messages == []
        assert second_socket.sent_messages == [
            {
                "message_id": "msg-newest",
                "message": "once",
                "type": "chat_message",
                "request_id": None,
            }
        ]
        assert await chat_service.roll20_chat_bridge.is_connected() is True

    asyncio.run(scenario())


def test_roll20_bridge_keeps_distinct_user_bindings_connected() -> None:
    async def scenario() -> None:
        await chat_service.roll20_chat_bridge.reset()
        dm_bridge = FakeWebSocket()
        player_bridge = FakeWebSocket()

        assert await chat_service.roll20_chat_bridge.connect(dm_bridge) is None
        assert (
            await chat_service.roll20_chat_bridge.connect(
                player_bridge,
                binding_key="instance:mage_instance",
            )
            is None
        )

        await chat_service.roll20_chat_bridge.send(
            chat_service.Roll20ChatMessage(message_id="dm-message", message="DM"),
            binding_key="dm",
        )
        await chat_service.roll20_chat_bridge.send(
            chat_service.Roll20ChatMessage(
                message_id="player-message",
                message="Player",
            ),
            binding_key="instance:mage_instance",
        )

        assert [entry["message_id"] for entry in dm_bridge.sent_messages] == [
            "dm-message"
        ]
        assert [entry["message_id"] for entry in player_bridge.sent_messages] == [
            "player-message"
        ]
        assert await chat_service.roll20_chat_bridge.connected_binding_keys() == {
            "dm",
            "instance:mage_instance",
        }

    asyncio.run(scenario())


def test_roll20_bridge_rejects_delivery_ack_from_another_binding() -> None:
    class PendingBridge(FakeWebSocket):
        async def send_json(self, payload: dict) -> None:
            self.sent_messages.append(payload)

    async def scenario() -> None:
        await chat_service.roll20_chat_bridge.reset()
        dm_bridge = PendingBridge()
        player_bridge = PendingBridge()
        await chat_service.roll20_chat_bridge.connect(dm_bridge)
        await chat_service.roll20_chat_bridge.connect(
            player_bridge,
            binding_key="instance:mage_instance",
        )
        pending = asyncio.create_task(
            chat_service.roll20_chat_bridge.send(
                chat_service.Roll20ChatMessage(
                    message_id="bound-delivery",
                    message="DM only",
                ),
                binding_key="dm",
                await_delivery=True,
            )
        )
        await asyncio.sleep(0)
        delivery = chat_service.Roll20ChatDelivery(
            message_id="bound-delivery",
            success=True,
            type="chat_delivery",
        )

        assert (
            chat_service.roll20_chat_bridge.acknowledge_delivery(
                delivery,
                websocket=player_bridge,
            )
            is False
        )
        assert not pending.done()
        assert (
            chat_service.roll20_chat_bridge.acknowledge_delivery(
                delivery,
                websocket=dm_bridge,
            )
            is True
        )
        await pending

    asyncio.run(scenario())


def test_roll20_bridge_send_failure_clears_and_broadcasts_status() -> None:
    class FailingWebSocket(FakeWebSocket):
        async def send_json(self, payload: dict) -> None:
            raise RuntimeError("socket closed")

    async def scenario() -> None:
        await websocket_sessions.reset()
        await chat_service.roll20_chat_bridge.reset()
        app_socket = FakeWebSocket()
        failing_bridge = FailingWebSocket()
        await websocket_sessions.connect(app_socket, role="player")
        await chat_service.roll20_chat_bridge.connect(failing_bridge)

        with pytest.raises(RuntimeError, match="not connected"):
            await chat_service.roll20_chat_bridge.send(
                chat_service.Roll20ChatMessage(message_id="msg-fail", message="fail")
            )

        assert await chat_service.roll20_chat_bridge.is_connected() is False
        assert app_socket.sent_messages == [
            {
                "response_id": None,
                "connected": False,
                "binding_key": None,
                "binding_label": None,
                "type": "roll20_bridge_status",
                "request_id": None,
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
                "request_id": "client-id-ignored",
            }
        ]

    asyncio.run(scenario())


def test_authenticated_dm_can_still_call_player_routes() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        await chat_service.roll20_chat_bridge.reset()
        sender_socket = FakeWebSocket()
        bridge_socket = FakeWebSocket()

        await websocket_sessions.connect(sender_socket, role="dm")
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
                "request_id": "client-id-ignored",
            },
            {
                "response_id": None,
                "authenticated": True,
                "role": "player",
                "reason": None,
                "type": "authenticate_response",
                "request_id": "another-client-id",
            },
            {
                "response_id": None,
                "state": {
                    "action_history": {},
                    "parties": {},
                    "kill_registry": {},
                    "xp_adjustments": {},
                    "player_kill_visibility": {},
                    "actions": {},
                        "augmentations": {},
                        "standalone_effects": {},
                        "standalone_effect_applications": {},
                    "condition_presets": {},
                    "active_conditions": {},
                    "encounter_presets": {},
                    "formulas": {},
                    "attributes": StateSingleton.getState().to_dict()["attributes"],
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
                "request_id": "client-id-ignored",
            },
            {
                "response_id": None,
                "state": {
                    "action_history": {},
                    "parties": {},
                    "kill_registry": {},
                    "xp_adjustments": {},
                    "player_kill_visibility": {},
                    "actions": {},
                        "augmentations": {},
                        "standalone_effects": {},
                        "standalone_effect_applications": {},
                    "condition_presets": {},
                    "active_conditions": {},
                    "encounter_presets": {},
                    "formulas": {},
                    "attributes": StateSingleton.getState().to_dict()["attributes"],
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
                "request_id": "client-id-ignored",
            },
            {
                "response_id": None,
                "state": {
                    "action_history": {},
                    "parties": {},
                    "kill_registry": {},
                    "xp_adjustments": {},
                    "player_kill_visibility": {},
                    "actions": {},
                        "augmentations": {},
                        "standalone_effects": {},
                        "standalone_effect_applications": {},
                    "condition_presets": {},
                    "active_conditions": {},
                    "encounter_presets": {},
                    "formulas": {},
                    "attributes": StateSingleton.getState().to_dict()["attributes"],
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

        state = StateSingleton.getState()
        state.sheets["mage_template"] = _build_sheet_state()
        state.instanced_sheets["mage_instance"] = _build_instance_state()
        await _connect_assigned_player(sender_socket)
        await chat_service.roll20_chat_bridge.connect(
            bridge_socket,
            binding_key="instance:mage_instance",
        )

        await handle_client_payload(
            sender_socket,
            {
                "type": "send_roll20_chat_message",
                "message": "bridge update",
                "request_id": "client-id-ignored",
            },
        )

        assert sender_socket.sent_messages == []
        assert bridge_socket.sent_messages == [
            {
                "message_id": bridge_socket.sent_messages[0]["message_id"],
                "message": "bridge update",
                "type": "chat_message",
                "request_id": "client-id-ignored",
            }
        ]

    asyncio.run(scenario())


def test_send_roll20_chat_message_surfaces_correlated_delivery_failure() -> None:
    class RejectingBridge(FakeWebSocket):
        async def send_json(self, payload: dict) -> None:
            self.sent_messages.append(payload)
            chat_service.roll20_chat_bridge.acknowledge_delivery(
                chat_service.Roll20ChatDelivery(
                    message_id=payload["message_id"],
                    success=False,
                    reason="chat_submit_failed",
                    type="chat_delivery",
                ),
                websocket=self,
            )

    async def scenario() -> None:
        await websocket_sessions.reset()
        await chat_service.roll20_chat_bridge.reset()
        sender_socket = FakeWebSocket()
        bridge_socket = RejectingBridge()
        state = StateSingleton.getState()
        state.sheets["mage_template"] = _build_sheet_state()
        state.instanced_sheets["mage_instance"] = _build_instance_state()
        await _connect_assigned_player(sender_socket)
        await chat_service.roll20_chat_bridge.connect(
            bridge_socket,
            binding_key="instance:mage_instance",
        )

        await handle_client_payload(
            sender_socket,
            {
                "type": "send_roll20_chat_message",
                "message": "exact [[1d100]] message ✓",
                "request_id": "req-delivery-failure",
            },
        )

        outbound = bridge_socket.sent_messages[0]
        assert outbound == {
            "message_id": outbound["message_id"],
            "message": "exact [[1d100]] message ✓",
            "type": "chat_message",
            "request_id": "req-delivery-failure",
        }
        assert sender_socket.sent_messages == [
            {
                "response_id": None,
                "reason": "Roll20 chat delivery failed: chat_submit_failed.",
                "type": "error",
                "request_id": "req-delivery-failure",
            }
        ]

    asyncio.run(scenario())


def test_replacing_bridge_rejects_pending_delivery() -> None:
    class PendingBridge(FakeWebSocket):
        async def send_json(self, payload: dict) -> None:
            self.sent_messages.append(payload)

    async def scenario() -> None:
        await chat_service.roll20_chat_bridge.reset()
        first = PendingBridge()
        second = FakeWebSocket()
        await chat_service.roll20_chat_bridge.connect(first)
        pending = asyncio.create_task(
            chat_service.roll20_chat_bridge.send(
                chat_service.Roll20ChatMessage(
                    message_id="pending-message",
                    message="do not deliver twice",
                ),
                await_delivery=True,
            )
        )
        await asyncio.sleep(0)

        replaced = await chat_service.roll20_chat_bridge.connect(second)

        assert replaced is first
        with pytest.raises(RuntimeError, match="delivery failed: unknown"):
            await pending

    asyncio.run(scenario())


def test_roll20_bridge_events_are_parsed_and_logged(caplog) -> None:
    hello_event = chat_service.parse_bridge_event(
        {
            "type": "hello",
            "source": "roll20_violentmonkey_userscript",
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
        websocket = FakeWebSocket()
        binding = chat_service.Roll20BridgeBinding(
            key="dm", role="dm", label="DM"
        )
        chat_service.handle_bridge_event(
            hello_event,
            websocket=websocket,
            binding=binding,
        )
        chat_service.handle_bridge_event(
            delivery_event,
            websocket=websocket,
            binding=binding,
        )

    assert "Roll20 bridge connected from roll20_violentmonkey_userscript" in caplog.text
    assert "Roll20 chat message delivered: msg-1" in caplog.text


def test_roll20_bridge_rejects_legacy_page_urls_and_raw_errors() -> None:
    with pytest.raises(ValidationError):
        chat_service.parse_bridge_event(
            {
                "type": "hello",
                "source": "roll20_violentmonkey_userscript",
                "page_url": "https://app.roll20.net/editor/secret",
            }
        )

    with pytest.raises(ValidationError):
        chat_service.parse_bridge_event(
            {
                "type": "chat_delivery",
                "message_id": "msg-legacy",
                "success": False,
                "error": "raw browser exception",
            }
        )


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
                "request_id": "client-id-ignored",
            }
        ]

    asyncio.run(scenario())


def test_websocket_contract_player_cannot_call_dm_only_route(monkeypatch) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        state = StateSingleton.getState()
        state.sheets["mage_template"] = _build_sheet_state()
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await _connect_assigned_player(websocket)

        await handle_client_payload(
            websocket,
            {
                "type": "set_sheet_notes",
                "sheet_id": "mage_template",
                "notes": "Player edit attempt.",
            },
        )

        assert state.sheets["mage_template"].notes == ""
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "reason": "Only a DM can edit backend notes.",
                "type": "error",
                "request_id": "req-1",
            }
        ]
    asyncio.run(scenario())


def test_websocket_contract_resource_mutation_broadcasts_state_patch(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        state = StateSingleton.getState()
        state.instanced_sheets["mage_instance"] = _build_instance_state()
        await websocket_sessions.reset()
        dm_socket = FakeWebSocket()
        player_socket = FakeWebSocket()
        await websocket_sessions.connect(dm_socket, role="dm")
        await websocket_sessions.connect(player_socket, role="player")

        await handle_client_payload(
            dm_socket,
            {
                "type": "adjust_instanced_sheet_resource",
                "instance_id": "mage_instance",
                "resource": "health",
                "delta": -5,
            },
        )

        expected_patch = {
            "response_id": None,
            "ops": [
                {
                    "op": "set",
                    "path": "/instanced_sheets/mage_instance/health",
                    "value": 85,
                }
            ],
            "state_version": 1,
            "type": "state_patch",
            "request_id": "req-1",
        }
        assert state.instanced_sheets["mage_instance"].health == 85
        assert dm_socket.sent_messages == [expected_patch]
        assert player_socket.sent_messages == [expected_patch]

    asyncio.run(scenario())


def test_websocket_contract_undo_last_state_change_is_dm_only(monkeypatch) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        state = StateSingleton.getState()
        state.instanced_sheets["mage_instance"] = _build_instance_state()
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await _connect_assigned_player(websocket)

        await handle_client_payload(
            websocket,
            {
                "type": "undo_last_state_change",
            },
        )

        assert state.instanced_sheets["mage_instance"].health == 90
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "reason": "Only a DM can undo state changes.",
                "type": "error",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())


def test_websocket_contract_undo_last_state_change_errors_when_empty() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="dm")

        await handle_client_payload(
            websocket,
            {
                "type": "undo_last_state_change",
            },
        )

        assert websocket.sent_messages == [
            {
                "response_id": None,
                "reason": "There are no state changes to undo.",
                "type": "error",
                "request_id": "req-1",
            }
        ]

    asyncio.run(scenario())


def test_websocket_contract_undo_last_state_change_broadcasts_inverse_patch(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        state = StateSingleton.getState()
        state.instanced_sheets["mage_instance"] = _build_instance_state()
        await websocket_sessions.reset()
        dm_socket = FakeWebSocket()
        player_socket = FakeWebSocket()
        await websocket_sessions.connect(dm_socket, role="dm")
        await websocket_sessions.connect(player_socket, role="player")

        await handle_client_payload(
            dm_socket,
            {
                "type": "adjust_instanced_sheet_resource",
                "instance_id": "mage_instance",
                "resource": "health",
                "delta": -5,
            },
        )
        dm_socket.sent_messages.clear()
        player_socket.sent_messages.clear()

        await handle_client_payload(
            dm_socket,
            {
                "type": "undo_last_state_change",
                "request_id": "req-undo",
            },
        )

        expected_patch = {
            "response_id": None,
            "ops": [
                {
                    "op": "set",
                    "path": "/instanced_sheets/mage_instance/health",
                    "value": 90,
                }
            ],
            "state_version": 2,
            "type": "state_patch",
            "request_id": "req-undo",
        }
        assert state.instanced_sheets["mage_instance"].health == 90
        assert dm_socket.sent_messages == [expected_patch]
        assert player_socket.sent_messages == [expected_patch]

    asyncio.run(scenario())


def test_websocket_contract_resync_replays_missing_patch(monkeypatch) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        state = StateSingleton.getState()
        state.instanced_sheets["mage_instance"] = _build_instance_state()
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="dm")

        await handle_client_payload(
            websocket,
            {
                "type": "adjust_instanced_sheet_resource",
                "instance_id": "mage_instance",
                "resource": "mana",
                "delta": -3,
            },
        )
        websocket.sent_messages.clear()

        await handle_client_payload(
            websocket,
            {
                "type": "resync_state",
                "last_seen_version": 0,
            },
        )

        assert state.instanced_sheets["mage_instance"].mana == 27
        assert websocket.sent_messages == [
            {
                "response_id": None,
                "ops": [
                    {
                        "op": "set",
                        "path": "/instanced_sheets/mage_instance/mana",
                        "value": 27,
                    }
                ],
                "state_version": 1,
                "type": "state_patch",
                "request_id": "req-2",
            }
        ]

    asyncio.run(scenario())


def test_websocket_contract_variable_registry_returns_mutation_metadata() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="player")

        await handle_client_payload(
            websocket,
            {
                "type": "get_variable_registry",
            },
        )

        assert websocket.sent_messages[0]["type"] == "variable_registry"
        assert websocket.sent_messages[0]["request_id"] == "req-1"
        variables_by_key = {
            variable["key"]: variable
            for variable in websocket.sent_messages[0]["variables"]
        }
        assert variables_by_key["instance.health"]["root"] == "instance"
        assert variables_by_key["instance.health"]["path"] == ["health"]
        assert variables_by_key["instance.health"]["value_type"] == "resource"
        assert variables_by_key["instance.health"]["editable_roles"] == [
            "player",
            "dm",
        ]

    asyncio.run(scenario())


def test_websocket_contract_perform_action_variable_mutation_emits_patch(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        state = StateSingleton.getState()
        state.sheets["mage_template"] = _build_sheet_state()
        state.instanced_sheets["mage_instance"] = _build_instance_state()
        state.actions["spend_mana"] = Action.from_dict(
            {
                "id": "spend_mana",
                "name": "Spend Mana",
                "steps": [
                    {
                        "step_id": "step-1",
                        "type": "decrement_value",
                        "target": "caster",
                        "path": ["mana"],
                        "amount": _formula_payload("4"),
                    }
                ],
            }
        )
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await _connect_assigned_player(websocket)

        await handle_client_payload(
            websocket,
            {
                "type": "perform_action",
                "sheet_id": "mage_instance",
                "action_id": "spend_mana",
            },
        )

        assert state.instanced_sheets["mage_instance"].mana == 26
        request_messages = [
            message
            for message in websocket.sent_messages
            if message.get("request_id") == "req-1"
        ]
        assert request_messages == [
            {
                "response_id": None,
                "ops": [
                    {
                        "op": "inc",
                        "path": "/instanced_sheets/mage_instance/mana",
                        "value": -4,
                    }
                ],
                "state_version": 1,
                "type": "state_patch",
                "request_id": "req-1",
            },
        ]
        assert websocket.sent_messages[-1]["request_id"] is None
        history_op = websocket.sent_messages[-1]["ops"][0]
        assert history_op["op"] == "add"
        assert history_op["path"].startswith("/action_history/action_history_")
        assert history_op["value"]["action_id"] == "spend_mana"
        assert history_op["value"]["mutation_summaries"] == []
        assert history_op["value"]["redacted"] is True

    asyncio.run(scenario())


def test_websocket_contract_roll20_only_action_returns_action_executed() -> None:
    async def scenario() -> None:
        state = StateSingleton.getState()
        state.sheets["mage_template"] = _build_sheet_state()
        state.instanced_sheets["mage_instance"] = _build_instance_state()
        state.actions["announce"] = Action.from_dict(
            {
                "id": "announce",
                "name": "Announce",
                "steps": [
                    {
                        "step_id": "step-1",
                        "type": "send_message",
                        "message": _formula_payload(
                            "Mana is @mana",
                            [{"name": "mana", "path": ["mana"]}],
                        ),
                    }
                ],
            }
        )
        await websocket_sessions.reset()
        await chat_service.roll20_chat_bridge.reset()
        websocket = FakeWebSocket()
        bridge_socket = FakeWebSocket()
        await _connect_assigned_player(websocket)
        await chat_service.roll20_chat_bridge.connect(
            bridge_socket,
            binding_key="instance:mage_instance",
        )

        await handle_client_payload(
            websocket,
            {
                "type": "perform_action",
                "sheet_id": "mage_instance",
                "action_id": "announce",
            },
        )

        assert state.instanced_sheets["mage_instance"].mana == 30
        request_messages = [
            message
            for message in websocket.sent_messages
            if message.get("request_id") == "req-1"
        ]
        assert request_messages == [
            {
                "response_id": None,
                "sheet_id": "mage_instance",
                "action_id": "announce",
                "applied_mutations": [],
                "emitted_messages": ["Mana is (30)"],
                "type": "action_executed",
                "request_id": "req-1",
            }
        ]
        assert websocket.sent_messages[0]["request_id"] is None
        history_op = websocket.sent_messages[0]["ops"][0]
        assert history_op["op"] == "add"
        assert history_op["path"].startswith("/action_history/action_history_")
        assert history_op["value"]["action_id"] == "announce"
        assert history_op["value"]["emitted_messages"] == ["Mana is (30)"]
        assert history_op["value"]["redacted"] is True
        assert bridge_socket.sent_messages == [
            {
                "message_id": bridge_socket.sent_messages[0]["message_id"],
                "message": "Mana is (30)",
                "type": "chat_message",
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
                    "action_history": {},
                    "parties": {},
                    "kill_registry": {},
                    "xp_adjustments": {},
                    "player_kill_visibility": {},
                    "actions": {},
                        "augmentations": {},
                        "standalone_effects": {},
                        "standalone_effect_applications": {},
                    "condition_presets": {},
                    "active_conditions": {},
                    "encounter_presets": {},
                    "formulas": {},
                    "attributes": StateSingleton.getState().to_dict()["attributes"],
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
                    "action_history": {},
                    "parties": {},
                    "kill_registry": {},
                    "xp_adjustments": {},
                    "player_kill_visibility": {},
                    "actions": {},
                        "augmentations": {},
                        "standalone_effects": {},
                        "standalone_effect_applications": {},
                    "condition_presets": {},
                    "active_conditions": {},
                    "encounter_presets": {},
                    "formulas": {},
                    "attributes": StateSingleton.getState().to_dict()["attributes"],
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


def test_dm_can_export_private_persisted_state_backup() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="dm")
        StateSingleton.getState().sheet_access_codes["ACCESS-1"] = SheetAccessCode(
            code="ACCESS-1",
            sheet_id="sheet_1",
            instance_id="instance_1",
        )

        await handle_client_payload(
            websocket,
            {
                "type": "export_state_backup",
                "request_id": "backup-1",
            },
        )

        assert len(websocket.sent_messages) == 1
        event = websocket.sent_messages[0]
        assert event["type"] == "state_backup_exported"
        assert event["request_id"] == "backup-1"
        assert event["schema_version"] == CURRENT_STATE_SCHEMA_VERSION
        exported = json.loads(event["persisted_state_json"])
        assert exported["state"]["sheet_access_codes"]["ACCESS-1"]["code"] == "ACCESS-1"

    asyncio.run(scenario())


def test_dm_can_import_state_backup_and_broadcasts_full_snapshots(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        monkeypatch.setattr(
            StateSingleton,
            "replaceState",
            staticmethod(lambda state: setattr(StateSingleton, "_state", state)),
        )
        dm_socket = FakeWebSocket()
        player_socket = FakeWebSocket()
        await websocket_sessions.connect(dm_socket, role="dm")
        await websocket_sessions.connect(player_socket, role="player")

        sheet_payload = asdict(_build_sheet_state())
        sheet_payload["items"] = {
            "helm_bridge": {
                "relationship_id": "helm_bridge",
                "item_id": "helm",
                "count": 1,
                "equipped": True,
            }
        }
        instance_payload = asdict(_build_instance_state())
        instance_payload["items"] = deepcopy(sheet_payload["items"])

        persisted_state_json = json.dumps(
            build_persisted_state(
                {
                    "sheet_access_codes": {
                        "ACCESS-1": {
                            "code": "ACCESS-1",
                            "sheet_id": "sheet_1",
                            "instance_id": "instance_1",
                            "active": True,
                        }
                    },
                    "sheets": {"mage_template": sheet_payload},
                    "instanced_sheets": {"mage_instance": instance_payload},
                    "items": {
                        "helm": {
                            "id": "helm",
                            "name": "Flame Helm",
                            "interaction_type": "equippable",
                            "category": "Helmet",
                            "rank": "A",
                            "description": "A fire-attuned helmet.",
                            "world_anvil_url": "",
                            "gm_notes": "",
                            "gm_special_properties": "",
                            "price": "",
                            "weight": 0,
                            "augmentation_templates": [
                                {
                                    "id": "health-effect",
                                    "name": "Burning Vitality",
                                    "source": {
                                        "type": "item",
                                        "id": "helm",
                                        "label": "Flame Helm",
                                    },
                                    "scope": "instance",
                                    "target": {
                                        "root": "instance",
                                        "path": ["health"],
                                    },
                                    "effect": {
                                        "type": "formula_modifier",
                                        "operation": "add",
                                        "value": {"aliases": None, "text": "5"},
                                    },
                                    "lifecycle_owner": "equipment",
                                }
                            ],
                            "action_grants": [],
                        }
                    },
                }
            )
        )

        await handle_client_payload(
            dm_socket,
            {
                "type": "import_state_backup",
                "persisted_state_json": persisted_state_json,
                "request_id": "import-1",
            },
        )

        imported_state = StateSingleton.getState()
        assert imported_state.sheet_access_codes["ACCESS-1"].sheet_id == "sheet_1"
        assert imported_state.instanced_sheets["mage_instance"].health == 95
        assert len(imported_state.augmentations) == 1
        concrete_effect = next(iter(imported_state.augmentations.values()))
        assert concrete_effect.source.relationship_id == "helm_bridge"
        assert concrete_effect.lifecycle_owner == "equipment"
        assert dm_socket.sent_messages[-1]["type"] == "state_snapshot"
        assert dm_socket.sent_messages[-1]["request_id"] == "import-1"
        assert dm_socket.sent_messages[-1]["state_version"] == 1
        assert player_socket.sent_messages[-1]["type"] == "state_snapshot"
        assert player_socket.sent_messages[-1]["request_id"] is None
        assert player_socket.sent_messages[-1]["state_version"] == 1
        assert "sheet_access_codes" not in dm_socket.sent_messages[-1]["state"]
        assert "sheet_access_codes" not in player_socket.sent_messages[-1]["state"]

    asyncio.run(scenario())


def test_import_state_backup_rejects_invalid_json() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="dm")

        await handle_client_payload(
            websocket,
            {
                "type": "import_state_backup",
                "persisted_state_json": "{not-json",
                "request_id": "import-bad",
            },
        )

        assert websocket.sent_messages == [
            {
                "response_id": None,
                "reason": "Imported state backup is not valid JSON.",
                "type": "error",
                "request_id": "import-bad",
            }
        ]

    asyncio.run(scenario())
