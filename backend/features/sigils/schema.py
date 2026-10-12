from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from backend.core.transport import RequestModel


class SetSigilAuthoringAccess(RequestModel):
    type: Literal["set_sigil_authoring_access"]
    instance_id: str = Field(min_length=1)
    enabled: bool


class SigilNodeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    diameter: float = Field(gt=0, allow_inf_nan=False)
    parent_id: str | None = None
    action_id: str | None = None
    mana_cost_step_ids: list[str] = Field(default_factory=list)
    power_step_ids: list[str] = Field(default_factory=list)


class SaveSigil(RequestModel):
    type: Literal["save_sigil"]
    sigil_id: str = Field(min_length=1)
    owner_instance_id: str = Field(min_length=1)
    nodes: list[SigilNodeInput] = Field(min_length=1)
    access_instance_ids: list[str] = Field(default_factory=list)
    item_relationship_id: str | None = None
    expected_revision: int | None = Field(default=None, ge=0)


class DeleteSigil(RequestModel):
    type: Literal["delete_sigil"]
    sigil_id: str = Field(min_length=1)
    expected_revision: int = Field(ge=0)


class DuplicateSigil(RequestModel):
    type: Literal["duplicate_sigil"]
    sigil_id: str = Field(min_length=1)


class SigilNodeRequest(RequestModel):
    sigil_id: str = Field(min_length=1)
    node_id: str = Field(min_length=1)
    instance_id: str = Field(min_length=1)


class ImbueSigil(SigilNodeRequest):
    type: Literal["imbue_sigil"]


class PreviewSigil(SigilNodeRequest):
    type: Literal["preview_sigil"]


class DischargeSigil(SigilNodeRequest):
    type: Literal["discharge_sigil"]


class ActivateSigil(SigilNodeRequest):
    type: Literal["activate_sigil"]
    visibility: Literal["public", "gm"] = "public"
    roll_mode: Literal["normal", "advantage", "disadvantage", "critical"] = "normal"


class SigilPreview(BaseModel):
    type: Literal["sigil_preview"] = "sigil_preview"
    request_id: str | None = None
    sigil_id: str
    node_id: str
    mana_cost: int
    multiplier: float
