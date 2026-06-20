from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from backend.core.transport import RequestModel


class EncounterEntryPayload(BaseModel):
    template_id: str = Field(min_length=1)
    count: int = Field(ge=1)


class EncounterPresetPayload(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    entries: list[EncounterEntryPayload] = Field(min_length=1)
    updated_at: str = ""


class SaveEncounterPreset(RequestModel):
    encounter: EncounterPresetPayload
    type: Literal["save_encounter_preset"]


class DeleteEncounterPreset(RequestModel):
    encounter_id: str = Field(min_length=1)
    type: Literal["delete_encounter_preset"]


class SpawnEncounterPreset(RequestModel):
    encounter_id: str = Field(min_length=1)
    type: Literal["spawn_encounter_preset"]
