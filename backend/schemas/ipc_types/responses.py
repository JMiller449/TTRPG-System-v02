from dataclasses import dataclass
from typing import Any, Literal, Union

from backend.schemas.state.enemy import EnemyBridge
from backend.schemas.state.item import ItemBridge
from backend.schemas.state.proficiency import ProficiencyBridge
from backend.schemas.state.shared import Bridge


@dataclass
class PlayerState:
    player_id: str
    name: str
    health: str
    ac: str
    xp_cap: str
    proficiencies: dict[str, ProficiencyBridge]
    items: dict[str, ItemBridge]
    stats: dict[str, Bridge]
    enemy_slained: dict[str, EnemyBridge]
    actions: dict[str, Bridge]


@dataclass
class PatchOp:
    op: Literal["set", "inc", "add", "remove"]
    path: str
    value: Any | None = None


@dataclass
class StateSnapshot:
    type: Literal["state_snapshot"] = "state_snapshot"
    request_id: str | None = None
    players: list[PlayerState] | None = None


@dataclass
class StatePatch:
    type: Literal["state_patch"] = "state_patch"
    request_id: str | None = None
    ops: list[PatchOp] | None = None


@dataclass
class Error:
    message: str
    type: Literal["error"] = "error"
    request_id: str | None = None


# Response to client
Responses = Union[StateSnapshot, StatePatch, Error]
