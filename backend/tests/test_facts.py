import asyncio
from copy import deepcopy

from backend.features.state_sync.service import state_sync_service
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.fact import synchronize_required_sheet_facts
from backend.state.models.action import Action
from backend.state.models.item import Item
from backend.state.models.sheet import Sheet
from backend.state.store import DEFAULT_STATE, StateSingleton


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        return None

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)


def _formula(text: str, aliases: list[dict] | None = None) -> dict:
    return {"aliases": aliases, "text": text}


def _sheet() -> Sheet:
    aliases = {
        "strength": [{"name": "strength", "path": ["stats", "strength"]}],
        "dexterity": [{"name": "dexterity", "path": ["stats", "dexterity"]}],
        "constitution": [
            {"name": "constitution", "path": ["stats", "constitution"]}
        ],
        "perception": [
            {"name": "perception", "path": ["stats", "perception"]}
        ],
        "arcane": [{"name": "arcane", "path": ["stats", "arcane"]}],
        "will": [{"name": "will", "path": ["stats", "will"]}],
    }
    return Sheet.from_dict(
        {
            "id": "mage",
            "name": "Mage",
            "dm_only": False,
            "xp_given_when_slayed": 0,
            "xp_cap": "",
            "proficiencies": {},
            "items": {},
            "stats": {
                "strength": 10,
                "dexterity": 11,
                "constitution": 12,
                "perception": 13,
                "arcane": 14,
                "will": 15,
                "lifting": _formula("@strength", aliases["strength"]),
                "carry_weight": _formula("@strength", aliases["strength"]),
                "acrobatics": _formula("@dexterity", aliases["dexterity"]),
                "stamina": _formula("@dexterity", aliases["dexterity"]),
                "reaction_time": _formula("@dexterity", aliases["dexterity"]),
                "health": _formula("@constitution", aliases["constitution"]),
                "endurance": _formula("@constitution", aliases["constitution"]),
                "pain_tolerance": _formula("@will", aliases["will"]),
                "sight_distance": _formula("@perception", aliases["perception"]),
                "intuition": _formula("@perception", aliases["perception"]),
                "registration": _formula("@arcane", aliases["arcane"]),
                "mana": _formula("@arcane", aliases["arcane"]),
                "control": _formula("@arcane", aliases["arcane"]),
                "sensitivity": _formula("@arcane", aliases["arcane"]),
                "charisma": _formula("@will", aliases["will"]),
                "mental_fortitude": _formula("@will", aliases["will"]),
                "courage": _formula("@will", aliases["will"]),
            },
            "slayed_record": {},
            "actions": {},
        }
    )


def _reset_with_sheet() -> None:
    StateSingleton._state = deepcopy(DEFAULT_STATE)
    sheet = _sheet()
    synchronize_required_sheet_facts(sheet)
    StateSingleton.getState().sheets[sheet.id] = sheet


def test_required_amount_of_reactions_is_seeded_and_evaluated() -> None:
    state = deepcopy(DEFAULT_STATE)
    sheet = _sheet()
    state.sheets[sheet.id] = sheet
    synchronize_required_sheet_facts(sheet)

    definition = state.facts["amount_of_reactions"]
    bridge = sheet.facts["amount_of_reactions"]
    assert definition.required is True
    assert definition.default_value.formula is not None
    assert bridge.evaluated_value == 25
    assert bridge.evaluation_error is None


def test_dm_can_edit_and_reset_required_sheet_fact(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_with_sheet()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_fact_value",
                    "sheet_id": "mage",
                    "fact_id": "amount_of_reactions",
                    "value": {
                        "type": "formula",
                        "formula": {
                            "aliases": [
                                {
                                    "name": "registration",
                                    "path": ["stats", "registration"],
                                }
                            ],
                            "text": "@registration * 2",
                        },
                    },
                },
            )

            bridge = StateSingleton.getState().sheets["mage"].facts[
                "amount_of_reactions"
            ]
            assert bridge.evaluated_value == 28
            assert websocket.sent_messages[-1]["ops"][0]["path"] == (
                "/sheets/mage/facts/amount_of_reactions"
            )

            await handle_client_payload(
                websocket,
                {
                    "type": "reset_sheet_fact_value",
                    "sheet_id": "mage",
                    "fact_id": "amount_of_reactions",
                },
            )
            bridge = StateSingleton.getState().sheets["mage"].facts[
                "amount_of_reactions"
            ]
            assert bridge.evaluated_value == 25
            assert bridge.value.formula is not None
            assert bridge.value.formula.text == "@registration + @reaction_time"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_fact_recomputes_when_dependency_changes(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_with_sheet()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_base_stat",
                    "sheet_id": "mage",
                    "stat_name": "arcane",
                    "value": 20,
                },
            )

            bridge = StateSingleton.getState().sheets["mage"].facts[
                "amount_of_reactions"
            ]
            assert bridge.evaluated_value == 31
            assert [op["path"] for op in websocket.sent_messages[-1]["ops"]] == [
                "/sheets/mage/stats/arcane",
                "/sheets/mage/facts/amount_of_reactions",
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_player_cannot_edit_sheet_fact(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_with_sheet()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")

            await handle_client_payload(
                websocket,
                {
                    "type": "reset_sheet_fact_value",
                    "sheet_id": "mage",
                    "fact_id": "amount_of_reactions",
                },
            )

            assert websocket.sent_messages[-1]["type"] == "error"
            assert "DM" in websocket.sent_messages[-1]["reason"]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_dm_can_author_attach_update_detach_and_delete_optional_fact(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_with_sheet()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_fact",
                    "fact": {
                        "id": "level",
                        "name": "Level",
                        "description": "Current character level.",
                        "subject_types": ["sheet"],
                        "value_type": "number",
                        "default_value": {"type": "number", "value": 1},
                        "unit": "levels",
                        "visibility": "public",
                        "required": False,
                    },
                },
            )
            await handle_client_payload(
                websocket,
                {
                    "type": "attach_sheet_fact",
                    "sheet_id": "mage",
                    "relationship_id": "mage-level",
                    "fact_id": "level",
                },
            )
            bridge = StateSingleton.getState().sheets["mage"].facts["level"]
            assert bridge.evaluated_value == 1

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_fact_value",
                    "sheet_id": "mage",
                    "fact_id": "level",
                    "value": {"type": "number", "value": 3},
                },
            )
            assert StateSingleton.getState().sheets["mage"].facts[
                "level"
            ].evaluated_value == 3

            await handle_client_payload(
                websocket,
                {
                    "type": "detach_sheet_fact",
                    "sheet_id": "mage",
                    "fact_id": "level",
                },
            )
            await handle_client_payload(
                websocket,
                {"type": "delete_fact", "fact_id": "level"},
            )
            assert "level" not in StateSingleton.getState().facts
            assert "level" not in StateSingleton.getState().sheets["mage"].facts
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_optional_fact_dependencies_recompute_and_report_cycles(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_with_sheet()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            for fact_id, default_value in (
                ("level", {"type": "number", "value": 1}),
                (
                    "next_level",
                    {
                        "type": "formula",
                        "formula": {
                            "aliases": [
                                {"name": "level", "path": ["facts", "level"]}
                            ],
                            "text": "@level + 1",
                        },
                    },
                ),
            ):
                await handle_client_payload(
                    websocket,
                    {
                        "type": "create_fact",
                        "fact": {
                            "id": fact_id,
                            "name": fact_id.replace("_", " ").title(),
                            "subject_types": ["sheet"],
                            "value_type": "number",
                            "default_value": default_value,
                        },
                    },
                )
                await handle_client_payload(
                    websocket,
                    {
                        "type": "attach_sheet_fact",
                        "sheet_id": "mage",
                        "relationship_id": f"mage-{fact_id}",
                        "fact_id": fact_id,
                    },
                )

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_fact_value",
                    "sheet_id": "mage",
                    "fact_id": "level",
                    "value": {"type": "number", "value": 4},
                },
            )
            assert StateSingleton.getState().sheets["mage"].facts[
                "next_level"
            ].evaluated_value == 5

            await handle_client_payload(
                websocket,
                {
                    "type": "set_sheet_fact_value",
                    "sheet_id": "mage",
                    "fact_id": "level",
                    "value": {
                        "type": "formula",
                        "formula": {
                            "aliases": [
                                {
                                    "name": "next_level",
                                    "path": ["facts", "next_level"],
                                }
                            ],
                            "text": "@next_level",
                        },
                    },
                },
            )
            bridge = StateSingleton.getState().sheets["mage"].facts["level"]
            assert bridge.evaluated_value is None
            assert "cycle detected" in (bridge.evaluation_error or "")
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_required_fact_definition_cannot_be_deleted(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_with_sheet()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")
            await handle_client_payload(
                websocket,
                {"type": "delete_fact", "fact_id": "amount_of_reactions"},
            )
            assert websocket.sent_messages[-1]["type"] == "error"
            assert "cannot be deleted" in websocket.sent_messages[-1]["reason"]
            await handle_client_payload(
                websocket,
                {"type": "delete_fact", "fact_id": "action_rank"},
            )
            assert websocket.sent_messages[-1]["type"] == "error"
            assert "Backend-owned" in websocket.sent_messages[-1]["reason"]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_constrained_fact_definitions_require_validation_metadata(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_with_sheet()
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_fact",
                    "fact": {
                        "id": "armor_type",
                        "name": "Armor Type",
                        "subject_types": ["item"],
                        "value_type": "enum",
                        "default_value": {"type": "enum", "value": "Sword"},
                    },
                },
            )
            assert websocket.sent_messages[-1]["type"] == "error"
            assert "validation options" in websocket.sent_messages[-1]["reason"]

            await handle_client_payload(
                websocket,
                {
                    "type": "create_fact",
                    "fact": {
                        "id": "armor_type",
                        "name": "Armor Type",
                        "subject_types": ["item"],
                        "value_type": "enum",
                        "default_value": {"type": "enum", "value": "Sword"},
                        "validation_options": ["Sword", "Axe"],
                    },
                },
            )
            assert StateSingleton.getState().facts["armor_type"].validation_options == [
                "Sword",
                "Axe",
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_item_and_action_subject_facts_persist_and_evaluate(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_with_sheet()
            state = StateSingleton.getState()
            state.items["sword"] = Item.from_dict(
                {
                    "id": "sword",
                    "name": "Sword",
                    "interaction_type": "equippable",
                    "category": "Sword",
                    "rank": "D",
                    "description": "",
                    "price": "",
                    "weight": "3 lbs",
                    "augmentation_templates": [],
                    "action_grants": [],
                }
            )
            state.actions["parry"] = Action.from_dict(
                {"id": "parry", "name": "Parry", "steps": []}
            )
            await websocket_sessions.reset()
            websocket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="dm")

            await handle_client_payload(
                websocket,
                {
                    "type": "create_fact",
                    "fact": {
                        "id": "rank",
                        "name": "Rank",
                        "subject_types": ["item", "action"],
                        "value_type": "text",
                        "default_value": {"type": "text", "value": "F"},
                    },
                },
            )
            for subject_type, subject_id, rank in (
                ("item", "sword", "D"),
                ("action", "parry", "C"),
            ):
                await handle_client_payload(
                    websocket,
                    {
                        "type": "attach_subject_fact",
                        "subject_type": subject_type,
                        "subject_id": subject_id,
                        "relationship_id": f"{subject_id}-rank",
                        "fact_id": "rank",
                        "value": {"type": "text", "value": rank},
                    },
                )

            assert state.items["sword"].facts["rank"].evaluated_value == "D"
            assert state.actions["parry"].facts["rank"].evaluated_value == "C"

            await handle_client_payload(
                websocket,
                {
                    "type": "set_subject_fact_value",
                    "subject_type": "action",
                    "subject_id": "parry",
                    "fact_id": "rank",
                    "value": {"type": "text", "value": "B"},
                },
            )
            assert state.actions["parry"].facts["rank"].evaluated_value == "B"
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())


def test_fact_visibility_changes_reconcile_all_subject_bridges(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_with_sheet()
            state = StateSingleton.getState()
            state.items["sword"] = Item.from_dict(
                {
                    "id": "sword",
                    "name": "Sword",
                    "interaction_type": "equippable",
                    "category": "Sword",
                    "rank": "D",
                    "description": "",
                    "price": "",
                    "weight": "3 lbs",
                    "augmentation_templates": [],
                    "action_grants": [],
                }
            )
            state.actions["parry"] = Action.from_dict(
                {"id": "parry", "name": "Parry", "steps": []}
            )
            await websocket_sessions.reset()
            dm_socket = FakeWebSocket()
            player_socket = FakeWebSocket()
            await websocket_sessions.connect(dm_socket, role="dm")
            await websocket_sessions.connect(player_socket, role="player")

            definition = {
                "id": "rank_label",
                "name": "Rank Label",
                "subject_types": ["sheet", "item", "action"],
                "value_type": "text",
                "default_value": {"type": "text", "value": "F"},
                "visibility": "public",
            }
            await handle_client_payload(
                dm_socket,
                {"type": "create_fact", "fact": definition},
            )
            await handle_client_payload(
                dm_socket,
                {
                    "type": "attach_sheet_fact",
                    "sheet_id": "mage",
                    "relationship_id": "mage-rank-label",
                    "fact_id": "rank_label",
                },
            )
            for subject_type, subject_id in (
                ("item", "sword"),
                ("action", "parry"),
            ):
                await handle_client_payload(
                    dm_socket,
                    {
                        "type": "attach_subject_fact",
                        "subject_type": subject_type,
                        "subject_id": subject_id,
                        "relationship_id": f"{subject_id}-rank-label",
                        "fact_id": "rank_label",
                    },
                )

            public_snapshot = await state_sync_service.snapshot(role="player")
            assert "rank_label" in public_snapshot.state["facts"]
            assert "rank_label" in public_snapshot.state["sheets"]["mage"]["facts"]
            assert "rank_label" in public_snapshot.state["items"]["sword"]["facts"]
            assert "rank_label" in public_snapshot.state["actions"]["parry"]["facts"]

            await handle_client_payload(
                dm_socket,
                {
                    "type": "update_fact",
                    "fact_id": "rank_label",
                    "fact": {**definition, "visibility": "gm_only"},
                },
            )
            player_ops = player_socket.sent_messages[-1]["ops"]
            assert {(op["op"], op["path"]) for op in player_ops} == {
                ("remove", "/facts/rank_label"),
                ("remove", "/sheets/mage/facts/rank_label"),
                ("remove", "/items/sword/facts/rank_label"),
                ("remove", "/actions/parry/facts/rank_label"),
            }
            private_snapshot = await state_sync_service.snapshot(role="player")
            assert "rank_label" not in private_snapshot.state["facts"]
            assert "rank_label" not in private_snapshot.state["sheets"]["mage"]["facts"]
            assert "rank_label" not in private_snapshot.state["items"]["sword"]["facts"]
            assert "rank_label" not in private_snapshot.state["actions"]["parry"]["facts"]

            await handle_client_payload(
                dm_socket,
                {
                    "type": "update_fact",
                    "fact_id": "rank_label",
                    "fact": definition,
                },
            )
            player_ops = player_socket.sent_messages[-1]["ops"]
            assert {(op["op"], op["path"]) for op in player_ops} == {
                ("set", "/facts/rank_label"),
                ("set", "/sheets/mage/facts/rank_label"),
                ("set", "/items/sword/facts/rank_label"),
                ("set", "/actions/parry/facts/rank_label"),
            }
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())
