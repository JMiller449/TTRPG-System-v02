import asyncio
from copy import deepcopy

import pytest

from backend.features.augmentations import service as augmentation_service
from backend.features.session.service import websocket_sessions
from backend.state.models.augmentation import (
    Augmentation,
    AugmentationSource,
    AugmentationTarget,
    FormulaModifierEffect,
)
from backend.state.models.condition import ConditionPreset
from backend.state.models.formula import Formula, FormulaAliases
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


def _reset_state() -> None:
    StateSingleton._state = deepcopy(DEFAULT_STATE)


def _build_instance() -> InstancedSheet:
    return InstancedSheet.from_dict(
        {
            "parent_id": "sheet-1",
            "health": 10,
            "mana": 5,
            "augments": {},
        }
    )


def _build_augmentation(
    *,
    augmentation_id: str = "aug-1",
    active: bool = True,
    applied: bool = False,
    applied_target_id: str | None = None,
    path: list[str] | None = None,
    operation: str = "add",
    value: str = "5",
    aliases: list[FormulaAliases] | None = None,
) -> Augmentation:
    return Augmentation(
        id=augmentation_id,
        name="Blessed Health",
        description="Temporary health modifier.",
        source=AugmentationSource(type="manual", label="GM adjustment"),
        scope="instance",
        target=AugmentationTarget(
            root="instance",
            path=["health"] if path is None else path,
        ),
        effect=FormulaModifierEffect(
            operation=operation,
            value=Formula(
                aliases=aliases,
                text=value,
            ),
        ),
        active=active,
        applied=applied,
        applied_target_id=applied_target_id,
    )


def _condition_template_payload(
    *,
    template_id: str = "poison-drain",
    root: str = "instance",
    path: list[str] | None = None,
) -> dict:
    return {
        "id": template_id,
        "name": "Poison Drain",
        "description": "Health penalty while poisoned.",
        "source": {
            "type": "condition",
            "id": "poisoned",
            "label": "Poisoned",
        },
        "scope": "instance",
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
            },
        },
        "active": True,
        "applied": False,
        "applied_target_id": None,
        "lifecycle": {
            "duration": None,
            "expires_at": None,
            "removal_condition": None,
        },
    }


def _build_condition_preset(
    *,
    condition_id: str = "poisoned",
    template_root: str = "instance",
) -> ConditionPreset:
    return ConditionPreset.from_dict(
        {
            "id": condition_id,
            "name": "Poisoned",
            "description": "Ongoing poison effect.",
            "visibility": "public",
            "augmentation_ids": [],
            "augmentation_templates": [
                _condition_template_payload(root=template_root),
            ],
        }
    )


def test_apply_augmentation_mutates_target_and_marks_record(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.augmentations["aug-1"] = _build_augmentation()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            result = await augmentation_service.apply_augmentation(
                "aug-1",
                instance_id="inst-1",
                request_id="req-1",
            )

            assert result.operation == "applied"
            assert result.value == 15
            assert state.instanced_sheets["inst-1"].health == 15
            assert state.augmentations["aug-1"].applied is True
            assert state.augmentations["aug-1"].applied_target_id == "inst-1"
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/instanced_sheets/inst-1/health",
                            "value": 15,
                        },
                        {
                            "op": "set",
                            "path": "/augmentations/aug-1/applied",
                            "value": True,
                        },
                        {
                            "op": "set",
                            "path": "/augmentations/aug-1/applied_target_id",
                            "value": "inst-1",
                        },
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_apply_condition_preset_creates_links_and_applies_current_instance_only(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.instanced_sheets["inst-2"] = _build_instance()
            state.instanced_sheets["inst-2"].health = 20
            state.condition_presets["poisoned"] = _build_condition_preset()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            result = await augmentation_service.apply_condition_preset(
                instance_id="inst-1",
                condition_id="poisoned",
                request_id="req-1",
            )

            concrete_id = "condition:poisoned:inst-1:poison-drain"
            assert result.operation == "applied"
            assert [item.operation for item in result.augmentation_results] == [
                "applied"
            ]
            assert state.instanced_sheets["inst-1"].health == 8
            assert state.instanced_sheets["inst-2"].health == 20
            assert concrete_id in state.augmentations
            assert state.augmentations[concrete_id].source.type == "condition"
            assert state.augmentations[concrete_id].source.id == "poisoned"
            assert state.augmentations[concrete_id].applied_target_id == "inst-1"
            assert state.instanced_sheets["inst-1"].augments[concrete_id].entry_id == (
                concrete_id
            )
            assert concrete_id not in state.instanced_sheets["inst-2"].augments
            assert [op["path"] for op in websocket.sent_messages[0]["ops"]] == [
                f"/augmentations/{concrete_id}",
                f"/instanced_sheets/inst-1/augments/{concrete_id}",
                "/instanced_sheets/inst-1/health",
                f"/augmentations/{concrete_id}/applied",
                f"/augmentations/{concrete_id}/applied_target_id",
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_remove_condition_preset_reverses_unlinks_and_removes_concrete_augmentation(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.condition_presets["poisoned"] = _build_condition_preset()
            await augmentation_service.apply_condition_preset(
                instance_id="inst-1",
                condition_id="poisoned",
                request_id="req-1",
            )

            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            result = await augmentation_service.remove_condition_preset(
                instance_id="inst-1",
                condition_id="poisoned",
                request_id="req-2",
            )

            concrete_id = "condition:poisoned:inst-1:poison-drain"
            assert result.operation == "removed"
            assert [item.operation for item in result.augmentation_results] == [
                "removed"
            ]
            assert state.instanced_sheets["inst-1"].health == 10
            assert concrete_id not in state.instanced_sheets["inst-1"].augments
            assert concrete_id not in state.augmentations
            assert websocket.sent_messages[0]["ops"][-2:] == [
                {
                    "op": "remove",
                    "path": f"/instanced_sheets/inst-1/augments/{concrete_id}",
                    "value": None,
                },
                {
                    "op": "remove",
                    "path": f"/augmentations/{concrete_id}",
                    "value": None,
                },
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_condition_preset_hook_rejects_missing_preset_or_instance(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()

            with pytest.raises(
                ValueError,
                match="Condition preset 'missing' does not exist.",
            ):
                await augmentation_service.apply_condition_preset(
                    instance_id="inst-1",
                    condition_id="missing",
                    request_id="req-1",
                )

            state.condition_presets["poisoned"] = _build_condition_preset()
            with pytest.raises(
                ValueError,
                match="Instanced sheet 'missing' does not exist.",
            ):
                await augmentation_service.apply_condition_preset(
                    instance_id="missing",
                    condition_id="poisoned",
                    request_id="req-2",
                )
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_condition_preset_hook_rejects_non_instance_templates(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.condition_presets["poisoned"] = _build_condition_preset(
                template_root="sheet"
            )

            with pytest.raises(
                ValueError,
                match="must target the current instance",
            ):
                await augmentation_service.apply_condition_preset(
                    instance_id="inst-1",
                    condition_id="poisoned",
                    request_id="req-1",
                )

            assert state.instanced_sheets["inst-1"].health == 10
            assert state.augmentations == {}
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_remove_augmentation_reverses_target_and_marks_record(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.instanced_sheets["inst-1"].health = 15
            state.augmentations["aug-1"] = _build_augmentation(
                applied=True,
                applied_target_id="inst-1",
            )

            result = await augmentation_service.remove_augmentation(
                "aug-1",
                request_id="req-1",
            )

            assert result.operation == "removed"
            assert result.value == 10
            assert state.instanced_sheets["inst-1"].health == 10
            assert state.augmentations["aug-1"].applied is False
            assert state.augmentations["aug-1"].applied_target_id is None
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_inactive_augmentation_is_ignored(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.augmentations["aug-1"] = _build_augmentation(active=False)
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            result = await augmentation_service.apply_augmentation(
                "aug-1",
                instance_id="inst-1",
                request_id="req-1",
            )

            assert result.operation == "ignored"
            assert result.reason == "inactive"
            assert state.instanced_sheets["inst-1"].health == 10
            assert websocket.sent_messages == []
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_invalid_augmentation_target_is_rejected(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.augmentations["aug-1"] = _build_augmentation(path=["missing"])

            with pytest.raises(ValueError, match="does not exist"):
                await augmentation_service.apply_augmentation(
                    "aug-1",
                    instance_id="inst-1",
                    request_id="req-1",
                )

            assert state.instanced_sheets["inst-1"].health == 10
            assert state.augmentations["aug-1"].applied is False
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_recompute_applies_active_and_removes_inactive_augmentations(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.instanced_sheets["inst-1"].health = 15
            state.augmentations["active"] = _build_augmentation(
                augmentation_id="active",
                value="2",
            )
            state.augmentations["inactive"] = _build_augmentation(
                augmentation_id="inactive",
                active=False,
                applied=True,
                applied_target_id="inst-1",
                value="5",
            )

            results = await augmentation_service.recompute_augmentations(
                instance_id="inst-1",
                request_id="req-1",
            )

            assert [result.operation for result in results] == ["applied", "removed"]
            assert state.instanced_sheets["inst-1"].health == 12
            assert state.augmentations["active"].applied is True
            assert state.augmentations["inactive"].applied is False
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_augmentation_formula_can_reference_target_root(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            state = StateSingleton.getState()
            state.instanced_sheets["inst-1"] = _build_instance()
            state.augmentations["aug-1"] = _build_augmentation(
                value="@mana",
                aliases=[FormulaAliases(name="mana", path=["mana"])],
            )

            result = await augmentation_service.apply_augmentation(
                "aug-1",
                instance_id="inst-1",
                request_id="req-1",
            )

            assert result.value == 15
            assert state.instanced_sheets["inst-1"].health == 15
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
