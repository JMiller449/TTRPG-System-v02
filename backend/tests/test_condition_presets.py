import asyncio
from copy import deepcopy

from backend.features.augmentations import service as augmentation_service
from backend.protocol.socket import normalize_server_event
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.action import Action
from backend.state.models.state import State
from backend.state.models.sheet import InstancedSheet
from backend.state.store import DEFAULT_STATE, StateSingleton


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


def _reset_state() -> None:
    StateSingleton._state = deepcopy(DEFAULT_STATE)


def _augmentation_template(
    *,
    root: str = "instance",
    scope: str = "instance",
    path: list[str] | None = None,
) -> dict:
    return {
        "id": "poisoned-health-drain",
        "name": "Poisoned Health Drain",
        "description": "Manual health penalty while poisoned.",
        "source": {
            "type": "condition",
            "id": "poisoned",
            "label": "Poisoned",
            "relationship_id": None,
            "application_id": None,
        },
        "scope": scope,
        "target": {
            "root": root,
            "path": ["health"] if path is None else path,
        },
        "effect": {
            "type": "formula_modifier",
            "operation": "subtract",
            "value": {
                "aliases": None,
                "text": "2",
                "tags": [],
            },
            "selector": {
                "required_tags": [],
                "excluded_tags": [],
                "action_id": None,
                "formula_id": None,
                "step_id": None,
                "same_source_item": False,
            },
        },
        "active": True,
        "applied": False,
        "applied_target_id": None,
        "lifecycle_owner": "manual",
        "lifecycle": {
            "duration": None,
            "expires_at": None,
            "removal_condition": "Remove when poison is cured.",
        },
    }


def _condition_payload(*, augmentation_template: dict | None = None) -> dict:
    return {
        "id": "poisoned",
        "name": "Poisoned",
        "description": "Ongoing poison effect.",
        "visibility": "public",
        "augmentation_ids": ["poisoned-penalty"],
        "augmentation_templates": [augmentation_template or _augmentation_template()],
    }


def test_state_round_trips_condition_presets() -> None:
    state = State.from_dict(
        {
            "condition_presets": {
                "poisoned": _condition_payload(),
            }
        }
    )

    condition = state.condition_presets["poisoned"]
    assert condition.name == "Poisoned"
    assert condition.visibility == "public"
    assert condition.augmentation_ids == ["poisoned-penalty"]
    assert condition.augmentation_templates[0].source.type == "condition"

    assert state.to_dict()["condition_presets"]["poisoned"] == _condition_payload()


def test_state_snapshot_protocol_accepts_condition_presets() -> None:
    normalized = normalize_server_event(
        {
            "response_id": None,
            "state": {
                "sheets": {},
                "instanced_sheets": {},
                "formulas": {},
                "actions": {},
                "items": {},
                "proficiencies": {},
                "augmentations": {},
                "condition_presets": {
                    "poisoned": _condition_payload(),
                },
            },
            "state_version": 4,
            "type": "state_snapshot",
            "request_id": "req-1",
        }
    )

    assert normalized["state"]["condition_presets"]["poisoned"]["visibility"] == (
        "public"
    )
    assert normalized["state"]["condition_presets"]["poisoned"][
        "augmentation_templates"
    ][0]["source"]["type"] == "condition"


def test_dm_can_create_update_and_delete_condition_preset(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_condition_preset",
                    "condition": _condition_payload(),
                    "request_id": "client-id-ignored",
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "update_condition_preset",
                    "condition_id": "poisoned",
                    "condition_partial": {
                        "description": "Updated poison description.",
                        "visibility": "gm_only",
                    },
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "delete_condition_preset",
                    "condition_id": "poisoned",
                },
            )

            assert "poisoned" not in StateSingleton.getState().condition_presets
            assert websocket.sent_messages[0]["ops"][0]["op"] == "add"
            assert websocket.sent_messages[0]["ops"][0]["path"] == (
                "/condition_presets/poisoned"
            )
            assert websocket.sent_messages[1]["ops"][0]["op"] == "set"
            assert websocket.sent_messages[1]["ops"][0]["value"]["visibility"] == (
                "gm_only"
            )
            assert websocket.sent_messages[2]["ops"][0] == {
                "op": "remove",
                "path": "/condition_presets/poisoned",
                "value": None,
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_delete_condition_preset_rejects_action_references(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.condition_presets["poisoned"] = State.from_dict(
                {"condition_presets": {"poisoned": _condition_payload()}}
            ).condition_presets["poisoned"]
            state.actions["poison_strike"] = Action.from_dict(
                {
                    "id": "poison_strike",
                    "name": "Poison Strike",
                    "steps": [
                        {
                            "step_id": "apply-poison",
                            "type": "apply_condition_preset",
                            "target": "caster",
                            "condition_id": "poisoned",
                            "operation": "apply",
                        }
                    ],
                }
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {"type": "delete_condition_preset", "condition_id": "poisoned"},
            )

            assert "poisoned" in state.condition_presets
            assert websocket.sent_messages[0]["reason"] == (
                "Condition preset 'poisoned' is referenced by actions: poison_strike."
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_condition_preset_accepts_instance_resistance_catalog_target(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_condition_preset",
                    "condition": _condition_payload(
                        augmentation_template=_augmentation_template(
                            path=["resistances", "fire"],
                        )
                    ),
                },
            )

            condition = StateSingleton.getState().condition_presets["poisoned"]
            assert condition.augmentation_templates[0].target.path == [
                "resistances",
                "fire",
            ]
            assert websocket.sent_messages[0]["ops"][0]["op"] == "add"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_condition_preset_rejects_sheet_target(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_condition_preset",
                    "condition": _condition_payload(
                        augmentation_template=_augmentation_template(
                            root="sheet",
                            scope="sheet",
                            path=["stats", "strength"],
                        )
                    ),
                },
            )

            assert StateSingleton.getState().condition_presets == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Condition preset augmentation templates must target the "
                        "current instance."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_condition_preset_rejects_global_target(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_condition_preset",
                    "condition": _condition_payload(
                        augmentation_template=_augmentation_template(
                            root="state",
                            scope="instance",
                            path=["condition_presets"],
                        )
                    ),
                },
            )

            assert StateSingleton.getState().condition_presets == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Condition preset augmentation templates must target the "
                        "current instance."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_condition_preset_rejects_uncataloged_instance_target(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_condition_preset",
                    "condition": _condition_payload(
                        augmentation_template=_augmentation_template(path=["actions"])
                    ),
                },
            )

            assert StateSingleton.getState().condition_presets == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Condition preset augmentation template target "
                        "'instance.actions' is not allowed."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_condition_preset_update_rejects_uncataloged_instance_target(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().condition_presets["poisoned"] = (
                State.from_dict(
                    {"condition_presets": {"poisoned": _condition_payload()}}
                ).condition_presets["poisoned"]
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_condition_preset",
                    "condition_id": "poisoned",
                    "condition_partial": {
                        "augmentation_templates": [
                            _augmentation_template(path=["actions"])
                        ],
                    },
                },
            )

            condition = StateSingleton.getState().condition_presets["poisoned"]
            assert condition.augmentation_templates[0].target.path == ["health"]
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": (
                        "Condition preset augmentation template target "
                        "'instance.actions' is not allowed."
                    ),
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_create_condition_preset(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_condition_preset",
                    "condition": _condition_payload(),
                },
            )

            assert StateSingleton.getState().condition_presets == {}
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "This request requires an authenticated DM session.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_missing_condition_update_is_rejected(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "update_condition_preset",
                    "condition_id": "missing",
                    "condition_partial": {"name": "Missing"},
                },
            )

            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "reason": "Condition preset 'missing' does not exist.",
                    "type": "error",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_active_condition_removal_is_dm_only_and_preserves_preset(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.condition_presets["poisoned"] = State.from_dict(
                {"condition_presets": {"poisoned": _condition_payload()}}
            ).condition_presets["poisoned"]
            state.instanced_sheets["instance-1"] = InstancedSheet.from_dict(
                {
                    "parent_id": "sheet-1",
                    "health": 10,
                    "mana": 5,
                    "augments": {},
                }
            )
            await augmentation_service.apply_condition_preset(
                instance_id="instance-1",
                condition_id="poisoned",
            )
            application_id = "condition:poisoned:instance-1"
            assert state.instanced_sheets["instance-1"].health == 8

            await websocket_sessions.reset()
            player = FakeWebSocket()
            await websocket_sessions.connect(player, role="player")
            await handle_client_payload(
                player,
                {
                    "type": "remove_active_condition",
                    "instance_id": "instance-1",
                    "application_id": application_id,
                },
            )
            assert application_id in state.active_conditions
            assert player.sent_messages[-1]["reason"] == (
                "This request requires an authenticated DM session."
            )

            dm = FakeWebSocket()
            await websocket_sessions.connect(dm, role="dm")
            await handle_client_payload(
                dm,
                {
                    "type": "remove_active_condition",
                    "instance_id": "instance-1",
                    "application_id": application_id,
                    "request_id": "remove-condition-1",
                },
            )

            assert application_id not in state.active_conditions
            assert "poisoned" in state.condition_presets
            assert state.instanced_sheets["instance-1"].health == 10
            assert dm.sent_messages[-1]["request_id"] == "remove-condition-1"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_delete_condition_preset_rejects_active_applications(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.condition_presets["poisoned"] = State.from_dict(
                {"condition_presets": {"poisoned": _condition_payload()}}
            ).condition_presets["poisoned"]
            state.instanced_sheets["instance-1"] = InstancedSheet.from_dict(
                {
                    "parent_id": "sheet-1",
                    "health": 10,
                    "mana": 5,
                    "augments": {},
                }
            )
            await augmentation_service.apply_condition_preset(
                instance_id="instance-1",
                condition_id="poisoned",
            )

            await websocket_sessions.reset()
            dm = FakeWebSocket()
            await websocket_sessions.connect(dm, role="dm")
            await handle_client_payload(
                dm,
                {"type": "delete_condition_preset", "condition_id": "poisoned"},
            )

            assert "poisoned" in state.condition_presets
            assert dm.sent_messages[-1]["reason"] == (
                "Condition preset 'poisoned' has active applications. "
                "Remove them before deleting the preset."
            )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
