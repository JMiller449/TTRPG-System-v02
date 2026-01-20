from dataclasses import dataclass
from typing import Literal, Union

from backend.schemas.state.enemy import EnemyBridge
from backend.schemas.state.item import ItemBridge
from backend.schemas.state.proficiency import ProficiencyBridge
from backend.schemas.state.shared import Bridge


@dataclass
class Yap:
    message: str
    type: Literal["yap"] = "yap"


@dataclass
class CreatePlayer:
    type: Literal["create_player"] = "create_player"
    request_id: str | None = None
    player_id: str = ""
    name: str = ""
    health: str | None = None
    ac: str | None = None
    xp_cap: str | None = None
    proficiencies: dict[str, ProficiencyBridge] | None = None
    items: dict[str, ItemBridge] | None = None
    stats: dict[str, Bridge] | None = None
    enemy_slained: dict[str, EnemyBridge] | None = None
    actions: dict[str, Bridge] | None = None


@dataclass
class UpdatePlayer:
    type: Literal["update_player"] = "update_player"
    request_id: str | None = None
    player_id: str = ""
    name: str | None = None
    health: str | None = None
    ac: str | None = None
    xp_cap: str | None = None
    proficiencies: dict[str, ProficiencyBridge] | None = None
    items: dict[str, ItemBridge] | None = None
    stats: dict[str, Bridge] | None = None
    enemy_slained: dict[str, EnemyBridge] | None = None
    actions: dict[str, Bridge] | None = None


@dataclass
class DeletePlayer:
    type: Literal["delete_player"] = "delete_player"
    request_id: str | None = None
    player_id: str = ""


# Request from client
Requests = Union[Yap, CreatePlayer, UpdatePlayer, DeletePlayer]
