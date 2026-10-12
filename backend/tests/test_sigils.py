import asyncio
from copy import deepcopy
from dataclasses import asdict

import pytest

from backend.core.request_registry import request_registry
from backend.features.sigils import service
from backend.features.sigils.schema import (
    ActivateSigil, DeleteSigil, DischargeSigil, DuplicateSigil, ImbueSigil, PreviewSigil, SaveSigil, SetSigilAuthoringAccess,
)
from backend.features.state_sync.service import state_sync_service as sync
from backend.protocol.socket import normalize_server_event, parse_application_request
from backend.state.models.action import Action, DecrementValueStep, IncrementValueStep, SendRollStep, RollResult
from backend.state.models.formula import Formula, FormulaAliases
from backend.state.models.sigil import Sigil, SigilNode
from backend.state.models.state import State
from backend.state.store import StateSingleton
from backend.tests.test_sheet_runtime import _build_sheet_state, _build_instance_state


@pytest.fixture
def state():
    original = StateSingleton._state
    template = _build_sheet_state()
    imbuer = _build_instance_state(template)
    activator = _build_instance_state(template)
    imbuer.can_inscribe_sigils = True
    imbuer.stats.arcane = 14
    activator.stats.arcane = 2
    activator.mana = 10
    action = Action("spell", "Stored spell", steps=[
        DecrementValueStep("cost", ["mana"], Formula([], "3.5")),
        IncrementValueStep("power", ["health"], Formula([FormulaAliases("power", ["stats", "arcane"])], "@power")),
        IncrementValueStep("restore_mana", ["mana"], Formula([], "1")),
    ])
    current = State(sheets={template.id: template}, instanced_sheets={"imbuer": imbuer, "activator": activator}, actions={"spell": action})
    StateSingleton._state = current
    yield current
    StateSingleton._state = original


def save_request(**changes):
    values = dict(type="save_sigil", sigil_id="sigil", owner_instance_id="imbuer",
        access_instance_ids=["activator"], nodes=[dict(id="root", name="Inscription", diameter=1.5,
        action_id="spell", mana_cost_step_ids=["cost"], power_step_ids=["power"]),
        dict(id="child", name="Child", diameter=2, parent_id="root")])
    values.update(changes)
    return SaveSigil(**values)


def node_request(model, instance_id="imbuer", **changes):
    return model(type={ImbueSigil: "imbue_sigil", ActivateSigil: "activate_sigil", DischargeSigil: "discharge_sigil", PreviewSigil: "preview_sigil"}[model],
        sigil_id="sigil", node_id="root", instance_id=instance_id, **changes)


def test_imbue_activate_recharge_uses_imbuer_stats_and_only_skips_explicit_cost(state):
    async def scenario():
        original = asdict(state.actions["spell"])
        await service.save(save_request(), "player", "imbuer")
        assert state.sigils["sigil"].nodes[0].charge is None
        preview = await service.preview(node_request(PreviewSigil), "player", "imbuer")
        assert preview.mana_cost == 5
        assert state.instanced_sheets["imbuer"].mana == 30
        assert normalize_server_event(preview)["type"] == "sigil_preview"
        await service.imbue(node_request(ImbueSigil), "player", "imbuer")
        assert state.instanced_sheets["imbuer"].mana == 25
        assert state.instanced_sheets["imbuer"].health == 90
        result = await service.activate(node_request(ActivateSigil, "activator"), "player", "activator")
        assert state.instanced_sheets["activator"].health == 111
        assert state.instanced_sheets["activator"].mana == 11  # restore executes; the selected casting cost does not
        assert "mana+=1" in result.applied_mutations
        assert state.instanced_sheets["imbuer"].mana == 25
        assert state.sigils["sigil"].nodes[0].charge is None
        assert state.sigils["sigil"].nodes[0].last_imbuer_instance_id == "imbuer"
        assert len(state.sigils["sigil"].nodes) == 2
        assert asdict(state.actions["spell"]) == original
        await service.imbue(node_request(ImbueSigil), "player", "imbuer")
        assert state.instanced_sheets["imbuer"].mana == 20
        assert state.sigils["sigil"].nodes[0].diameter == 1.5
    asyncio.run(scenario())


def test_insufficient_mana_and_double_imbue_are_atomic(state):
    async def scenario():
        await service.save(save_request(), "dm", None)
        state.instanced_sheets["imbuer"].mana = 4
        with pytest.raises(ValueError, match="Insufficient mana"):
            await service.imbue(node_request(ImbueSigil), "player", "imbuer")
        assert state.instanced_sheets["imbuer"].mana == 4
        assert state.sigils["sigil"].nodes[0].charge is None
        state.instanced_sheets["imbuer"].mana = 30
        await service.imbue(node_request(ImbueSigil), "player", "imbuer")
        with pytest.raises(ValueError, match="already charged"):
            await service.imbue(node_request(ImbueSigil), "player", "imbuer")
        assert state.instanced_sheets["imbuer"].mana == 25
    asyncio.run(scenario())


@pytest.mark.parametrize("failure", ["action_changed", "imbuer_missing", "execution", "delivery", "persist"])
def test_activation_failure_preserves_charge_and_resources(state, monkeypatch, failure):
    async def scenario():
        if failure == "delivery":
            state.actions["spell"].steps.append(SendRollStep("roll", "Power", "default", [RollResult("Power", Formula([], "10"))]))
        await service.save(save_request(), "dm", None)
        await service.imbue(node_request(ImbueSigil), "dm", None)
        if failure == "action_changed":
            state.actions["spell"].name = "Changed"
        elif failure == "imbuer_missing":
            del state.instanced_sheets["imbuer"]
        elif failure == "execution":
            # Mutation path valid when charging; a runtime resource cannot be evaluated as a number.
            state.instanced_sheets["activator"].health = "bad"
        elif failure == "delivery":
            from backend.features.chat.service import roll20_chat_bridge
            async def connected(*args, **kwargs): return True
            async def fail(*args, **kwargs): raise RuntimeError("delivery failed")
            monkeypatch.setattr(roll20_chat_bridge, "is_connected", connected)
            monkeypatch.setattr(roll20_chat_bridge, "send", fail)
        elif failure == "persist":
            def fail(): raise OSError("disk failed")
            monkeypatch.setattr(StateSingleton, "dumpState", fail)
        before = deepcopy(state.to_dict(include_private=True))
        with pytest.raises((ValueError, RuntimeError, TypeError, OSError)):
            await service.activate(node_request(ActivateSigil, "activator"), "player", "activator")
        assert state.to_dict(include_private=True) == before
    asyncio.run(scenario())


def test_concurrent_activation_consumes_exactly_once(state):
    async def scenario():
        await service.save(save_request(), "dm", None)
        await service.imbue(node_request(ImbueSigil), "dm", None)
        results = await asyncio.gather(*[service.activate(node_request(ActivateSigil, "activator", request_id=f"activation-{i}"), "player", "activator") for i in range(2)], return_exceptions=True)
        assert sum(isinstance(result, ValueError) for result in results) == 1
        assert state.instanced_sheets["activator"].health == 111
        assert len(state.action_history) == 1
    asyncio.run(scenario())


def test_save_preserves_ids_charge_and_rejects_stale_or_charged_reconfiguration(state):
    async def scenario():
        await service.save(save_request(), "dm", None)
        await service.imbue(node_request(ImbueSigil), "dm", None)
        request = save_request(expected_revision=1)
        request.nodes[0].name = "Renamed"
        request.nodes[1].parent_id = "root"
        await service.save(request, "dm", None)
        assert state.sigils["sigil"].nodes[0].charge.imbuer_instance_id == "imbuer"
        assert state.sigils["sigil"].nodes[0].id == "root"
        with pytest.raises(ValueError, match="changed"):
            await service.save(request, "dm", None)
        request.expected_revision = 2
        request.nodes[0].diameter = 4
        with pytest.raises(ValueError, match="Discharge"):
            await service.save(request, "dm", None)
        await service.discharge(node_request(DischargeSigil), "dm", None)
        request.expected_revision = 3
        await service.save(request, "dm", None)
        assert state.sigils["sigil"].nodes[0].diameter == 4
    asyncio.run(scenario())


def test_duplicate_does_not_copy_charges_and_backup_round_trip(state):
    async def scenario():
        await service.save(save_request(), "dm", None)
        await service.imbue(node_request(ImbueSigil), "dm", None)
        await service.manage(DuplicateSigil(type="duplicate_sigil", sigil_id="sigil"), "dm", None)
        duplicate = next(value for key, value in state.sigils.items() if key != "sigil")
        assert all(node.charge is None for node in duplicate.nodes)
        assert not {node.id for node in duplicate.nodes} & {"root", "child"}
        assert State.from_dict(state.to_dict(include_private=True)).sigils == state.sigils
        # Full backup migration is exercised through the same store parser below.
        from backend.state.store import StateSingleton
        StateSingleton.dumpState()
    asyncio.run(scenario())


def test_access_redaction_and_revocation(state):
    async def scenario():
        await service.save(save_request(), "dm", None)
        snapshot = await sync.snapshot(role="player", assigned_instance_id="activator")
        assert "sigil" in snapshot.state["sigils"]
        hidden = await sync.snapshot(role="player", assigned_instance_id="other")
        assert hidden.state["sigils"] == {}
        with pytest.raises(PermissionError):
            await service.imbue(node_request(ImbueSigil), "player", "activator")
        with pytest.raises(PermissionError):
            await service.save(save_request(expected_revision=0), "player", "activator")
        await service.save(save_request(expected_revision=0, access_instance_ids=[]), "dm", None)
        patch = sync._redact_patch_for_role(sync._patch_history[-1], role="player", assigned_instance_id="activator")
        assert next(op.value for op in patch.ops if op.path == "/sigils") == {}
    asyncio.run(scenario())


@pytest.mark.parametrize("kind", ["cycle", "duplicate", "missing_parent", "diameter"])
def test_invalid_hierarchy(kind):
    nodes = [SigilNode("root", "Root", 1), SigilNode("child", "Child", 1, "root")]
    if kind == "cycle":
        nodes += [SigilNode("a", "A", 1, "b"), SigilNode("b", "B", 1, "a")]
    elif kind == "duplicate":
        nodes.append(SigilNode("child", "Duplicate", 1, "root"))
    elif kind == "missing_parent":
        nodes[1].parent_id = "missing"
    elif kind == "diameter":
        with pytest.raises(ValueError): SigilNode("bad", "Bad", float("nan"))
        return
    with pytest.raises(ValueError): Sigil("sigil", "owner", nodes)


def test_arbitrary_depth_serialization_is_iterative():
    nodes = [SigilNode(str(i), "Node", 1, str(i - 1) if i else None) for i in range(2000)]
    sigil = Sigil("deep", "owner", nodes)
    assert Sigil.from_dict(asdict(sigil)) == sigil


@pytest.mark.parametrize("change", ["action", "cost", "power", "item"])
def test_invalid_references(state, change):
    async def scenario():
        request = save_request()
        if change == "action": request.nodes[0].action_id = "missing"
        elif change == "cost": request.nodes[0].mana_cost_step_ids = ["restore_mana"]
        elif change == "power": request.nodes[0].power_step_ids = ["missing"]
        else: request.item_relationship_id = "missing"
        with pytest.raises(ValueError): await service.save(request, "dm", None)
        assert state.sigils == {}
    asyncio.run(scenario())


def test_contracts_registered_and_transport_parse():
    request = save_request()
    assert request_registry.resolve(request.model_dump()).request == request
    assert parse_application_request(request.model_dump()) == request


def test_gm_selects_authoring_players_and_revocation_preserves_activation(state):
    async def scenario():
        state.instanced_sheets["imbuer"].can_inscribe_sigils = False
        with pytest.raises(PermissionError, match="not enabled"):
            await service.save(save_request(), "player", "imbuer")
        grant = SetSigilAuthoringAccess(type="set_sigil_authoring_access", instance_id="imbuer", enabled=True)
        with pytest.raises(PermissionError, match="Only the GM"):
            await service.set_authoring_access(grant, "player")
        assert state.instanced_sheets["imbuer"].can_inscribe_sigils is False
        await service.set_authoring_access(grant, "dm")
        await service.save(save_request(), "player", "imbuer")
        await service.imbue(node_request(ImbueSigil), "player", "imbuer")
        grant.enabled = False
        await service.set_authoring_access(grant, "dm")
        for request in (save_request(expected_revision=1), DuplicateSigil(type="duplicate_sigil", sigil_id="sigil"),
                        DeleteSigil(type="delete_sigil", sigil_id="sigil", expected_revision=1)):
            with pytest.raises(PermissionError, match="not enabled"):
                if isinstance(request, SaveSigil):
                    await service.save(request, "player", "imbuer")
                else:
                    await service.manage(request, "player", "imbuer")
        await service.activate(node_request(ActivateSigil, "activator"), "player", "activator")
        assert state.sigils["sigil"].nodes[0].charge is None
        snapshot = await sync.snapshot(role="player", assigned_instance_id="imbuer")
        assert snapshot.state["instanced_sheets"]["imbuer"]["can_inscribe_sigils"] is False
        assert "activator" not in snapshot.state["instanced_sheets"]
    asyncio.run(scenario())


def test_authoring_permission_defaults_off_and_persists(state):
    from backend.state.migrations import migrate_persisted_state
    raw = state.to_dict(include_private=True)
    for instance in raw["instanced_sheets"].values():
        instance.pop("can_inscribe_sigils")
    migrated = migrate_persisted_state({"schema_version": 58, "state": raw})
    restored = State.from_dict(migrated.state)
    assert all(not instance.can_inscribe_sigils for instance in restored.instanced_sheets.values())
    restored.instanced_sheets["imbuer"].can_inscribe_sigils = True
    assert State.from_dict(restored.to_dict(include_private=True)).instanced_sheets["imbuer"].can_inscribe_sigils


def test_authoring_access_route_requires_dm_and_existing_player(state):
    async def scenario():
        from backend.features.session.models import WebSocketSession
        from backend.tests.test_sheet_runtime import FakeWebSocket
        request = SetSigilAuthoringAccess(type="set_sigil_authoring_access", instance_id="imbuer", enabled=True)
        with pytest.raises(PermissionError):
            await request_registry.dispatch(WebSocketSession(FakeWebSocket(), role="player"), request.model_dump())
        request.instance_id = "missing"
        with pytest.raises(ValueError, match="does not exist"):
            await service.set_authoring_access(request, "dm")
        request.instance_id = "imbuer"
        state.sheets["mage_template"].dm_only = True
        with pytest.raises(ValueError, match="player character"):
            await service.set_authoring_access(request, "dm")
    asyncio.run(scenario())


def test_delete_and_request_replay_do_not_repeat_charge_mutations(state):
    async def scenario():
        await service.save(save_request(), "dm", None)
        request = node_request(ImbueSigil, request_id="one-charge")
        await service.imbue(request, "dm", None)
        await service.discharge(node_request(DischargeSigil), "dm", None)
        with pytest.raises(ValueError, match="Duplicate request"):
            await service.imbue(request, "dm", None)
        assert state.instanced_sheets["imbuer"].mana == 25
        await service.manage(DeleteSigil(type="delete_sigil", sigil_id="sigil", expected_revision=2), "dm", None)
        assert state.sigils == {}
    asyncio.run(scenario())


def test_nodes_charge_independently_and_round_trip_through_backup_import(state):
    async def scenario():
        request = save_request()
        request.nodes[1].action_id = "spell"
        request.nodes[1].mana_cost_step_ids = ["cost"]
        request.nodes[1].power_step_ids = ["power"]
        await service.save(request, "dm", None)
        await service.imbue(node_request(ImbueSigil), "dm", None)
        child = ImbueSigil(type="imbue_sigil", sigil_id="sigil", node_id="child", instance_id="imbuer")
        await service.imbue(child, "dm", None)
        assert state.instanced_sheets["imbuer"].mana == 18
        from backend.features.state_backup.service import export_state_backup, import_state_backup
        from backend.features.session.models import WebSocketSession
        from backend.tests.test_sheet_runtime import FakeWebSocket
        backup = export_state_backup()
        expected = deepcopy(state.sigils)
        await import_state_backup(WebSocketSession(FakeWebSocket(), role="dm"), persisted_state_json=backup.persisted_state_json)
        restored = StateSingleton.getState()
        assert restored.sigils == expected
        StateSingleton.dumpState()
        assert StateSingleton.initializeState().sigils == expected
    asyncio.run(scenario())


def test_item_copy_references_are_distinct_and_missing_items_reject_activation(state):
    async def scenario():
        from backend.state.models.item import Item, ItemBridge
        state.items["stone"] = Item.from_dict({"id": "stone", "name": "Stone", "description": "", "price": ""})
        inventory = state.instanced_sheets["imbuer"].items
        for key in ("copy1", "copy2"):
            inventory[key] = ItemBridge.from_dict({"relationship_id": key, "item_id": "stone", "count": 1, "equipped": False})
        await service.save(save_request(item_relationship_id="copy1"), "dm", None)
        await service.save(save_request(sigil_id="second", item_relationship_id="copy2"), "dm", None)
        await service.imbue(node_request(ImbueSigil), "dm", None)
        assert state.sigils["second"].nodes[0].charge is None
        await service.activate(node_request(ActivateSigil, "activator"), "dm", None)
        assert state.sigils["sigil"].nodes[0].charge is None
        assert state.sigils["second"].nodes[0].charge is None
        assert state.sigils["sigil"].item_relationship_id == "copy1"
        await service.imbue(node_request(ImbueSigil), "dm", None)
        del inventory["copy1"]
        with pytest.raises(ValueError, match="inventory item"):
            await service.activate(node_request(ActivateSigil, "activator"), "dm", None)
        assert state.sigils["sigil"].nodes[0].charge is not None
        assert state.items["stone"].name == "Stone"
    asyncio.run(scenario())


def test_power_scaling_preserves_authored_mutation_bounds(state):
    async def scenario():
        step = state.actions["spell"].steps[1]
        step.max_value = Formula([], "100")
        step.on_max_violation = "clamp"
        await service.save(save_request(), "dm", None)
        await service.imbue(node_request(ImbueSigil), "dm", None)
        await service.activate(node_request(ActivateSigil, "activator"), "dm", None)
        # 90 + (14 * 1.5) clamps at the authored 100, not a multiplied 150.
        assert state.instanced_sheets["activator"].health == 100
    asyncio.run(scenario())


def test_imbuement_reuses_calculated_value_mana_dependencies(state):
    async def scenario():
        from backend.state.models.action import CalculateValueStep, CalculatedValueReference
        action = state.actions["spell"]
        action.steps.insert(0, CalculateValueStep("calculate_cost", "mana_cost",
            Formula([FormulaAliases("arcane", ["stats", "arcane"])], "@arcane / 4")))
        action.steps[1].amount = CalculatedValueReference("mana_cost")
        await service.save(save_request(), "dm", None)
        await service.imbue(node_request(ImbueSigil), "dm", None)
        assert state.instanced_sheets["imbuer"].mana == 25
        assert state.instanced_sheets["imbuer"].health == 90
    asyncio.run(scenario())


@pytest.mark.parametrize("roll_mode", ["normal", "critical"])
def test_scaled_roll_output_uses_imbuer_values_and_activator_bridge(state, monkeypatch, roll_mode):
    async def scenario():
        from backend.features.chat import service as chat
        sent = []
        async def connected(*args, **kwargs): return True
        async def deliver(message, **kwargs): sent.append((message.message, kwargs))
        monkeypatch.setattr(chat.roll20_chat_bridge, "is_connected", connected)
        monkeypatch.setattr(chat.roll20_chat_bridge, "send", deliver)
        state.actions["spell"].roll_mode_kind = "damage"
        state.actions["spell"].steps.append(SendRollStep("roll", "Spell power", "default", [
            RollResult("Power", Formula([FormulaAliases("arcane", ["stats", "arcane"])], "@arcane"))]))
        request = save_request()
        request.nodes[0].power_step_ids.append("roll")
        await service.save(request, "dm", None)
        await service.imbue(node_request(ImbueSigil), "dm", None)
        assert sent == []
        await service.activate(node_request(ActivateSigil, "activator", roll_mode=roll_mode), "player", "activator")
        assert len(sent) == 1
        if roll_mode == "critical":
            assert "Critical" in sent[0][0]
        assert "14" in sent[0][0] and "* 1.5" in sent[0][0]
        assert sent[0][1]["await_delivery"] is True
        assert sent[0][1]["binding_key"] == chat.binding_for_actor(actor_role="player", assigned_instance_id="activator").key
        assert state.sigils["sigil"].nodes[0].charge is None
    asyncio.run(scenario())
