from dataclasses import dataclass
from typing import Dict, Literal, Optional, Union

from backend.schemas.state.action import Action
from backend.schemas.state.item import Item

CrudEntityUnion = Union[Item, Action]


@dataclass
class RequestParent:
    request_id: Optional[str]


# turn order handling
@dataclass
class BuildTurnOrder(RequestParent):
    type: Literal["build_turn_order"] = "buld_turn_order"


@dataclass
class EndTurn(RequestParent):
    type: Literal["end_turn"] = "end_turn"


@dataclass
class DestoryTurnOrder(RequestParent):
    type: Literal["destory_turn_order"] = "destory_turn_order"


# actions
@dataclass
class PerformReaction(RequestParent):
    victim_id: Optional[str]
    action_id: str
    type: Literal["perform_action"] = "perform_action"


@dataclass
class RespondToAttack(RequestParent):
    response_type: Literal["parry", "block", "dodge", "action"]
    action_id: Optional[str]
    type: Literal["respond"] = "respond"


@dataclass
class CreateEntity(RequestParent):
    entitry: CrudEntityUnion
    type: Literal["create_entity"] = "create_entity"


@dataclass
class UpdateEntity(RequestParent):
    # this is a dict instead of entity because having duplicate shape for optional is a pain
    entity_id: str
    entity_partiala: Dict[str, any]
    type: Literal["update_entity"] = "update_entity"


@dataclass
class DeleteEntity(RequestParent):
    entity_id: str
    type: Literal["delete_entity"] = "delete_entity"
    request_id: Optional[str] = None


# Request from client
Requests = Union[
    # basic crud
    CreateEntity,
    UpdateEntity,
    DeleteEntity,
    # reaction
    RespondToAttack,
    # action
    PerformReaction,
    # turn order
    DestoryTurnOrder,
    EndTurn,
    BuildTurnOrder,
]
