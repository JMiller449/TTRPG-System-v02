import asyncio
from copy import deepcopy

from backend.features.chat import service as chat_service
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state.models.action import Action
from backend.state.models.sheet import Sheet
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


def _formula_payload(text: str, aliases: list[dict] | None = None) -> dict:
    return {
        "aliases": aliases,
        "text": text,
    }


def _build_sheet_state() -> Sheet:
    return Sheet.from_dict({
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
            "lifting": _formula_payload("@strength * 2", [{"name": "strength", "path": ["stats", "strength"]}]),
            "carry_weight": _formula_payload("@strength * 3", [{"name": "strength", "path": ["stats", "strength"]}]),
            "acrobatics": _formula_payload("@dexterity", [{"name": "dexterity", "path": ["stats", "dexterity"]}]),
            "stamina": _formula_payload("@constitution", [{"name": "constitution", "path": ["stats", "constitution"]}]),
            "reaction_time": _formula_payload("@dexterity", [{"name": "dexterity", "path": ["stats", "dexterity"]}]),
            "health": _formula_payload("@constitution * 10", [{"name": "constitution", "path": ["stats", "constitution"]}]),
            "endurance": _formula_payload("@constitution * 2", [{"name": "constitution", "path": ["stats", "constitution"]}]),
            "pain_tolerance": _formula_payload("@will", [{"name": "will", "path": ["stats", "will"]}]),
            "sight_distance": _formula_payload("@perception * 4", [{"name": "perception", "path": ["stats", "perception"]}]),
            "intuition": _formula_payload("@perception", [{"name": "perception", "path": ["stats", "perception"]}]),
            "registration": _formula_payload("@arcane", [{"name": "arcane", "path": ["stats", "arcane"]}]),
            "mana": _formula_payload("@arcane * 8", [{"name": "arcane", "path": ["stats", "arcane"]}]),
            "control": _formula_payload("@arcane", [{"name": "arcane", "path": ["stats", "arcane"]}]),
            "sensitivity": _formula_payload("@arcane", [{"name": "arcane", "path": ["stats", "arcane"]}]),
            "charisma": _formula_payload("@will", [{"name": "will", "path": ["stats", "will"]}]),
            "mental_fortitude": _formula_payload("@will * 2", [{"name": "will", "path": ["stats", "will"]}]),
            "courage": _formula_payload("@will", [{"name": "will", "path": ["stats", "will"]}]),
        },
        "slayed_record": {},
        "actions": {
            "primary": {
                "relationship_id": "bridge-1",
                "entry_id": "battle_cry",
            }
        },
    })


def test_perform_action_executes_steps_and_returns_snapshot(monkeypatch) -> None:
    async def scenario() -> None:
        original_state = deepcopy(StateSingleton.getState())
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        try:
            _reset_state()
            StateSingleton.getState().sheets["mage_template"] = _build_sheet_state()
            StateSingleton.getState().actions["battle_cry"] = Action.from_dict({
                "id": "battle_cry",
                "name": "Battle Cry",
                "notes": "Lower strength, then announce it.",
                "steps": [
                    {
                        "step_id": "step-1",
                        "type": "set_value",
                        "target": "caster",
                        "path": ["stats", "strength"],
                        "value": _formula_payload(
                            "@strength - 2",
                            [{"name": "strength", "path": ["stats", "strength"]}],
                        ),
                    },
                    {
                        "step_id": "step-2",
                        "type": "send_message",
                        "message": _formula_payload(
                            "Strength now @strength",
                            [{"name": "strength", "path": ["stats", "strength"]}],
                        ),
                    },
                ],
            })
            await websocket_sessions.reset()
            await chat_service.roll20_chat_bridge.reset()
            websocket = FakeWebSocket()
            bridge_socket = FakeWebSocket()
            await websocket_sessions.connect(websocket, role="player")
            await chat_service.roll20_chat_bridge.connect(bridge_socket)

            await handle_client_payload(
                websocket,
                {
                    "type": "perform_action",
                    "sheet_id": "mage_template",
                    "action_id": "battle_cry",
                    "request_id": "req-4",
                },
            )

            assert StateSingleton.getState().sheets["mage_template"].stats.strength == 8
            assert websocket.sent_messages == [
                {
                    "response_id": None,
                    "ops": [
                        {
                            "op": "set",
                            "path": "/sheets/mage_template/stats/strength",
                            "value": 8,
                        }
                    ],
                    "state_version": 1,
                    "type": "state_patch",
                    "request_id": "req-1",
                },
                {
                    "response_id": None,
                    "sheet_id": "mage_template",
                    "action_id": "battle_cry",
                    "applied_mutations": ["stats.strength=8"],
                    "emitted_messages": ["Strength now (8)"],
                    "type": "action_executed",
                    "request_id": "req-1",
                },
            ]
            assert bridge_socket.sent_messages == [
                {
                    "message_id": bridge_socket.sent_messages[0]["message_id"],
                    "message": "Strength now (8)",
                    "type": "chat_message",
                    "request_id": "req-1",
                }
            ]
        finally:
            StateSingleton._state = original_state

    asyncio.run(scenario())

