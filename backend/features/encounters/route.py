from __future__ import annotations

from backend.core.request_registry import (
    ClientGenerationMetadata,
    RequestRegistry,
    RequestRoute,
)
from backend.features.encounters import service
from backend.features.encounters.schema import (
    DeleteEncounterPreset,
    SaveEncounterPreset,
    SpawnEncounterPreset,
)
from backend.features.session.models import WebSocketSession
from backend.protocol.socket import StatePatchEvent


class SaveEncounterPresetRoute(RequestRoute[SaveEncounterPreset]):
    type_name = "save_encounter_preset"
    request_model = SaveEncounterPreset
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="encounterPresets",
        method_name="saveEncounterPreset",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SaveEncounterPreset,
    ) -> None:
        await service.save_encounter_preset(request)


class DeleteEncounterPresetRoute(RequestRoute[DeleteEncounterPreset]):
    type_name = "delete_encounter_preset"
    request_model = DeleteEncounterPreset
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="encounterPresets",
        method_name="deleteEncounterPreset",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: DeleteEncounterPreset,
    ) -> None:
        await service.delete_encounter_preset(request)


class SpawnEncounterPresetRoute(RequestRoute[SpawnEncounterPreset]):
    type_name = "spawn_encounter_preset"
    request_model = SpawnEncounterPreset
    emitted_event_models = (StatePatchEvent,)
    minimum_role = "dm"
    client_generation = ClientGenerationMetadata(
        namespace="encounterPresets",
        method_name="spawnEncounterPreset",
    )

    async def handle(
        self,
        session: WebSocketSession,
        request: SpawnEncounterPreset,
    ) -> None:
        await service.spawn_encounter_preset(request)


def register_routes(registry: RequestRegistry) -> None:
    registry.register(SaveEncounterPresetRoute())
    registry.register(DeleteEncounterPresetRoute())
    registry.register(SpawnEncounterPresetRoute())
