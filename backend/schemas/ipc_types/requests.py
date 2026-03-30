from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, Field, TypeAdapter

CrudEntityUnion = dict[str, Any]
SocketGroup = Literal["dms", "players"]


class RequestParent(BaseModel):
    request_id: str | None = None


class PerformAction(RequestParent):
    victim_id: str | None
    action_id: str
    type: Literal["perform_action"]


class CreateEntity(RequestParent):
    entity: CrudEntityUnion
    type: Literal["create_entity"]


class UpdateEntity(RequestParent):
    entity_id: str
    entity_partial: dict[str, Any]
    type: Literal["update_entity"]


class DeleteEntity(RequestParent):
    entity_id: str
    type: Literal["delete_entity"]


class ElevateToDM(RequestParent):
    admin_code: str
    type: Literal["elevate_to_dm"]


class ChatUpdate(RequestParent):
    message: str
    target_group: SocketGroup | None = None
    type: Literal["chat_update"]


Requests = Annotated[
    Union[
        CreateEntity,
        UpdateEntity,
        DeleteEntity,
        PerformAction,
        ElevateToDM,
        ChatUpdate,
    ],
    Field(discriminator="type"),
]

REQUEST_ADAPTER = TypeAdapter(Requests)


def parse_request(payload: Any) -> Requests:
    return REQUEST_ADAPTER.validate_python(payload)
