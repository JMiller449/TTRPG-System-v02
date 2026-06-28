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
    assert variables["sheet.stats.strength"].shortcuts == ["str", "strength"]

    assert variables["sheet.stats.health"].root == "sheet"
    assert variables["sheet.stats.health"].path == ["stats", "health"]
    assert variables["sheet.stats.health"].value_type == "formula"
    assert variables["sheet.stats.health"].formula_backed is True
    assert variables["sheet.stats.health"].shortcuts is None

    assert variables["instance.health"].root == "instance"
    assert variables["instance.health"].path == ["health"]
    assert variables["instance.health"].value_type == "resource"
    assert variables["instance.health"].editable_roles == ["player", "dm"]
    assert variables["instance.health"].shortcuts == ["hp", "health"]
    assert variables["instance.mana"].shortcuts == ["mana"]
    assert variables["sheet.resistances.fire"].root == "sheet"
    assert variables["sheet.resistances.fire"].path == ["resistances", "fire"]
    assert variables["sheet.resistances.fire"].value_type == "percent"
    assert variables["sheet.resistances.fire"].editable_roles == ["dm"]
    assert variables["sheet.resistances.fire"].shortcuts == ["fire_resistance"]
    assert variables["instance.resistances.fire"].root == "instance"
    assert variables["instance.resistances.fire"].path == ["resistances", "fire"]
    assert variables["instance.resistances.fire"].value_type == "percent"
    assert variables["instance.resistances.fire"].editable_roles == ["player", "dm"]
    assert variables["instance.resistances.fire"].shortcuts == [
        "current_fire_resistance"
    ]

    assert "sheet.items" not in variables
    assert "raw_path" not in variables


def test_action_formula_authoring_metadata_exposes_scoped_catalogs() -> None:
    metadata = service.build_action_formula_authoring_metadata(request_id="req-1")
    variables = {variable.key: variable for variable in metadata.variables}
    aliases = {alias.name: alias for alias in metadata.formula_aliases}
    action_steps = {step.type: step for step in metadata.action_steps}
    action_presets = {
        preset.id: preset for preset in metadata.action_preset_templates
    }

    assert metadata.type == "action_formula_authoring_metadata"
    assert metadata.formula_roots == ["sheet", "instance"]
    assert metadata.action_mutation_roots == ["sheet", "instance"]

    strength = variables["sheet.stats.strength"]
    assert strength.formula_reference_allowed is True
    assert strength.action_mutation_allowed is True
    assert strength.path == ["stats", "strength"]

    health_formula = variables["sheet.stats.health"]
    assert health_formula.formula_reference_allowed is True
    assert health_formula.action_mutation_allowed is False

    instance_health = variables["instance.health"]
    assert instance_health.formula_reference_allowed is True
    assert instance_health.action_mutation_allowed is True
    assert instance_health.path == ["health"]
    sheet_fire_resistance = variables["sheet.resistances.fire"]
    assert sheet_fire_resistance.formula_reference_allowed is True
    assert sheet_fire_resistance.action_mutation_allowed is True
    instance_fire_resistance = variables["instance.resistances.fire"]
    assert instance_fire_resistance.formula_reference_allowed is True
    assert instance_fire_resistance.action_mutation_allowed is True

    assert aliases["str"].key == "sheet.stats.strength"
    assert aliases["str"].path == ["stats", "strength"]
    assert aliases["hp"].key == "instance.health"
    assert aliases["hp"].root == "instance"

    assert action_steps["set_value"].category == "bounded_mutation"
    assert action_steps["set_value"].allowed_targets == ["caster"]
    assert action_steps["set_value"].path_catalog == "variable_mutation_paths"
    assert action_steps["decrement_value"].formula_fields == [
        "amount",
        "min_value",
        "max_value",
    ]
    assert action_steps["send_message"].path_catalog == "none"
    assert action_steps["calculate_value"].category == "calculation"
    assert action_steps["calculate_value"].formula_fields == ["value"]
    assert action_steps["calculate_value"].path_catalog == "none"
    assert action_steps["resolve_damage"].category == "semantic_mutation"
    assert action_steps["resolve_damage"].formula_fields == ["amount"]
    assert action_steps["resolve_damage"].path_catalog == "none"
    assert action_steps["gain_proficiency_use"].path_catalog == "proficiency_bridges"
    assert action_steps["apply_augmentation"].category == "semantic_mutation"
    assert action_steps["apply_augmentation"].path_catalog == "augmentation_records"
    assert action_steps["apply_condition_preset"].category == "semantic_mutation"
    assert action_steps["apply_condition_preset"].path_catalog == "condition_presets"
    assert set(action_presets) == {
        "heal_health",
        "spend_mana",
        "restore_mana",
    }
    assert action_presets["spend_mana"].steps == [
        {
            "step_id": "spend-mana",
            "type": "decrement_value",
            "target": "caster",
            "path": ["mana"],
            "amount": {"aliases": None, "text": "0"},
            "min_value": {"aliases": None, "text": "0"},
            "max_value": None,
            "on_min_violation": "reject",
            "on_max_violation": "clamp",
        }
    ]
    assert action_presets["heal_health"].editable_formula_fields == [
        "steps.0.amount",
        "steps.0.max_value",
    ]


def test_augmentation_target_catalog_reuses_mutation_safe_variable_metadata() -> None:
    catalog = service.build_augmentation_target_catalog()
    targets = {target.key: target for target in catalog}

    assert targets["instance.health"].root == "instance"
    assert targets["instance.health"].path == ["health"]
    assert targets["instance.health"].value_type == "resource"
    assert targets["instance.health"].allowed_contexts == [
        "runtime",
        "item_template",
        "condition_template",
    ]

    assert targets["instance.mana"].path == ["mana"]
    assert targets["sheet.stats.strength"].root == "sheet"
    assert targets["sheet.stats.strength"].path == ["stats", "strength"]
    assert targets["sheet.stats.strength"].allowed_contexts == [
        "runtime",
        "item_template",
    ]
    assert "condition_template" not in targets["sheet.stats.strength"].allowed_contexts

    assert targets["sheet.resistances.fire"].path == ["resistances", "fire"]
    assert targets["sheet.resistances.fire"].value_type == "percent"
    assert targets["instance.resistances.fire"].path == ["resistances", "fire"]
    assert targets["instance.resistances.fire"].value_type == "percent"

    assert "sheet.stats.health" not in targets
    assert "sheet.items" not in targets
    assert all(target.root != "state" for target in catalog)
    assert {target.value_type for target in catalog} <= {
        "number",
        "percent",
        "resource",
    }


def test_augmentation_target_catalog_can_filter_authoring_contexts() -> None:
    item_targets = {
        target.key: target
        for target in service.build_augmentation_target_catalog(context="item_template")
    }
    condition_targets = {
        target.key: target
        for target in service.build_augmentation_target_catalog(
            context="condition_template"
        )
    }

    assert "sheet.stats.strength" in item_targets
    assert "instance.health" in item_targets
    assert "sheet.stats.strength" not in condition_targets
    assert condition_targets["instance.health"].root == "instance"
    assert condition_targets["instance.resistances.fire"].root == "instance"
    assert all(target.root == "instance" for target in condition_targets.values())


def test_augmentation_target_metadata_response_filters_contexts() -> None:
    response = service.build_augmentation_target_metadata(
        context="condition_template",
        request_id="req-1",
    )
    targets = {target.key: target for target in response.targets}

    assert response.type == "augmentation_target_metadata"
    assert response.context == "condition_template"
    assert response.request_id == "req-1"
    assert "instance.health" in targets
    assert "instance.resistances.fire" in targets
    assert "sheet.stats.strength" not in targets
    assert all(target.root == "instance" for target in response.targets)


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
        assert websocket.sent_messages[0]["request_id"] == "client-id-ignored"
        variables = {
            variable["key"]: variable
            for variable in websocket.sent_messages[0]["variables"]
        }
        assert variables["sheet.stats.arcane"]["path"] == ["stats", "arcane"]
        assert variables["sheet.stats.arcane"]["shortcuts"] == ["arc", "arcane"]
        assert variables["instance.mana"]["value_type"] == "resource"
        assert variables["instance.mana"]["shortcuts"] == ["mana"]

    asyncio.run(scenario())


def test_player_can_request_augmentation_target_metadata() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="player")

        await handle_client_payload(
            websocket,
            {
                "type": "get_augmentation_target_metadata",
                "context": "item_template",
                "request_id": "client-id-ignored",
            },
        )

        assert websocket.sent_messages[0]["type"] == "augmentation_target_metadata"
        assert websocket.sent_messages[0]["context"] == "item_template"
        assert websocket.sent_messages[0]["request_id"] == "client-id-ignored"
        targets = {
            target["key"]: target for target in websocket.sent_messages[0]["targets"]
        }
        assert targets["sheet.stats.strength"]["path"] == ["stats", "strength"]
        assert targets["sheet.stats.strength"]["allowed_contexts"] == [
            "runtime",
            "item_template",
        ]
        assert targets["instance.health"]["root"] == "instance"
        assert targets["instance.health"]["value_type"] == "resource"
        assert "sheet.stats.health" not in targets

    asyncio.run(scenario())


def test_player_can_request_action_formula_authoring_metadata() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="player")

        await handle_client_payload(
            websocket,
            {
                "type": "get_action_formula_authoring_metadata",
                "request_id": "client-id-ignored",
            },
        )

        assert websocket.sent_messages[0]["type"] == (
            "action_formula_authoring_metadata"
        )
        assert websocket.sent_messages[0]["request_id"] == "client-id-ignored"
        variables = {
            variable["key"]: variable
            for variable in websocket.sent_messages[0]["variables"]
        }
        aliases = {
            alias["name"]: alias
            for alias in websocket.sent_messages[0]["formula_aliases"]
        }
        action_steps = {
            step["type"]: step
            for step in websocket.sent_messages[0]["action_steps"]
        }
        action_presets = {
            preset["id"]: preset
            for preset in websocket.sent_messages[0]["action_preset_templates"]
        }

        assert variables["sheet.stats.arcane"]["shortcuts"] == ["arc", "arcane"]
        assert variables["sheet.stats.arcane"]["action_mutation_allowed"] is True
        assert variables["sheet.stats.mana"]["action_mutation_allowed"] is False
        assert variables["sheet.resistances.fire"]["value_type"] == "percent"
        assert variables["sheet.resistances.fire"]["action_mutation_allowed"] is True
        assert variables["instance.resistances.fire"]["value_type"] == "percent"
        assert variables["instance.resistances.fire"]["action_mutation_allowed"] is True
        assert aliases["mana"]["key"] == "instance.mana"
        assert action_steps["increment_value"]["allowed_targets"] == ["caster"]
        assert action_steps["resolve_damage"]["formula_fields"] == ["amount"]
        assert action_steps["resolve_damage"]["path_catalog"] == "none"
        assert set(action_presets) == {
            "heal_health",
            "spend_mana",
            "restore_mana",
        }
        assert action_presets["restore_mana"]["steps"][0]["type"] == (
            "increment_value"
        )
        assert "damage" not in action_presets

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


def test_unauthenticated_client_cannot_request_action_formula_authoring_metadata() -> None:
    async def scenario() -> None:
        await websocket_sessions.reset()
        websocket = FakeWebSocket()
        await websocket_sessions.connect(websocket, role="unauthenticated")

        await handle_client_payload(
            websocket,
            {
                "type": "get_action_formula_authoring_metadata",
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
