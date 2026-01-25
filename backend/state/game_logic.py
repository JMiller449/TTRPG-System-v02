from typing import Any, Dict, Type, TypeVar

from backend.schemas.ipc_types.requests import CreateEntity
from backend.schemas.ipc_types.responses import PlayerState
from backend.schemas.state.item import ItemBridge
from backend.schemas.state.sheet import Sheet
from backend.schemas.state.proficiency import ProficiencyBridge
from backend.schemas.state.shared import Bridge
from backend.state.store import StateSingleton

T = TypeVar("T")


class GameLogic:
