from typing import Any, Dict, Type, TypeVar

from backend.schemas.ipc_types.requests import CreatePlayer
from backend.schemas.ipc_types.responses import PlayerState
from backend.schemas.state.enemy import EnemyBridge
from backend.schemas.state.item import ItemBridge
from backend.schemas.state.player import Player
from backend.schemas.state.proficiency import ProficiencyBridge
from backend.schemas.state.shared import Bridge
from backend.state.store import StateSingleton

T = TypeVar("T")


class GameLogic:
    @staticmethod
    def _coerce_bridge_dict(
        data: Dict[str, Any] | None,
        bridge_cls: Type[T],
    ) -> Dict[str, T]:
        if not data:
            return {}
        coerced: Dict[str, T] = {}
        for key, value in data.items():
            if isinstance(value, bridge_cls):
                coerced[key] = value
                continue
            if isinstance(value, dict):
                coerced[key] = bridge_cls(**value)
                continue
            raise ValueError(f"Invalid bridge payload for {bridge_cls.__name__}")
        return coerced

    @staticmethod
    def create_player(req: CreatePlayer) -> Player:
        player = Player(
            id=req.player_id,
            name=req.name,
            health=req.health or "0",
            ac=req.ac or "0",
            xp_cap=req.xp_cap or "0",
            proficiencies=GameLogic._coerce_bridge_dict(
                req.proficiencies, ProficiencyBridge
            ),
            items=GameLogic._coerce_bridge_dict(req.items, ItemBridge),
            stats=GameLogic._coerce_bridge_dict(req.stats, Bridge),
            enemy_slained=GameLogic._coerce_bridge_dict(
                req.enemy_slained, EnemyBridge
            ),
            actions=GameLogic._coerce_bridge_dict(req.actions, Bridge),
        )
        state = StateSingleton.getState()
        state.players[player.id] = player
        StateSingleton.dumpState()
        return player

    @staticmethod
    def player_to_state(player: Player) -> PlayerState:
        return PlayerState(
            player_id=player.id,
            name=player.name,
            health=player.health,
            ac=player.ac,
            xp_cap=player.xp_cap,
            proficiencies=player.proficiencies,
            items=player.items,
            stats=player.stats,
            enemy_slained=player.enemy_slained,
            actions=player.actions,
        )

    @staticmethod
    def state_snapshot_players() -> list[PlayerState]:
        state = StateSingleton.getState()
        return [GameLogic.player_to_state(p) for p in state.players.values()]
