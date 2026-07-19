from typing import Literal

from pydantic import Field

from backend.core.transport import RequestModel


class SetPinnedInstanceActions(RequestModel):
    instance_id: str = Field(min_length=1)
    action_relationship_ids: list[str] = Field(default_factory=list)
    type: Literal["set_pinned_instance_actions"]
