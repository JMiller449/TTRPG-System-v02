from __future__ import annotations

from typing import Literal

from pydantic import Field

from backend.core.transport import RequestModel
from backend.protocol.state_schema import StandaloneEffectDefinitionPayload


class CreateStandaloneEffect(RequestModel):
    effect: StandaloneEffectDefinitionPayload
    type: Literal["create_standalone_effect"]


class UpdateStandaloneEffect(RequestModel):
    effect_id: str = Field(min_length=1)
    effect: StandaloneEffectDefinitionPayload
    type: Literal["update_standalone_effect"]


class DeleteStandaloneEffect(RequestModel):
    effect_id: str = Field(min_length=1)
    type: Literal["delete_standalone_effect"]
