"""Build and install a deterministic development checkpoint."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from backend.dev.dm_examples import (
    CONDITION_IDS,
    ENCOUNTER_IDS,
    ENEMY_TEMPLATE_IDS,
    FORMULA_IDS,
    INSTANCE_ID,
    PLAYER_TEMPLATE_IDS,
    SHEET_ID,
    SHADOWBLADE_INSTANCE_ID,
    SHADOWBLADE_SHEET_ID,
    STARTER_ACTION_IDS,
    STARTER_ITEM_IDS,
    authoring_requests,
)
from backend.features.state_sync.service import state_sync_service
from backend.routes.ws import handle_client_payload, websocket_sessions
from backend.state import store as store_module
from backend.state.models.access_code import SheetAccessCode
from backend.state.models.state import State
from backend.state.store import StateSingleton

SEED_ACCESS_CODES = {
    "EXAMPLE1": (SHEET_ID, INSTANCE_ID),
    "EXAMPLE2": (SHADOWBLADE_SHEET_ID, SHADOWBLADE_INSTANCE_ID),
}


class _SeedWebSocket:
    def __init__(self) -> None:
        self.sent_messages: list[dict[str, Any]] = []

    async def accept(self) -> None:
        return None

    async def send_json(self, payload: dict[str, Any]) -> None:
        self.sent_messages.append(payload)


async def _send_authoring_request(
    websocket: _SeedWebSocket,
    payload: dict[str, Any],
) -> None:
    start = len(websocket.sent_messages)
    await handle_client_payload(websocket, payload)
    responses = websocket.sent_messages[start:]
    errors = [response for response in responses if response.get("type") == "error"]
    if errors:
        raise RuntimeError(
            f"Seed request '{payload['type']}' failed: {errors[0].get('reason')}"
        )
    if not responses:
        raise RuntimeError(f"Seed request '{payload['type']}' returned no response.")


def _add_seed_access_codes(state: State) -> None:
    for code, (sheet_id, instance_id) in SEED_ACCESS_CODES.items():
        sheet = state.sheets.get(sheet_id)
        instance = state.instanced_sheets.get(instance_id)
        if sheet is None:
            raise ValueError(f"Seed access code references missing sheet '{sheet_id}'.")
        if instance is None or instance.parent_id != sheet_id:
            raise ValueError(
                f"Seed access code references invalid instance '{instance_id}'."
            )
        state.sheet_access_codes[code] = SheetAccessCode(
            code=code,
            sheet_id=sheet_id,
            instance_id=instance_id,
            active=True,
        )


def _validate_seed_state(state: State) -> None:
    required_collections = {
        "actions": state.actions,
        "attributes": state.attributes,
        "conditions": state.condition_presets,
        "encounters": state.encounter_presets,
        "formulas": state.formulas,
        "instances": state.instanced_sheets,
        "items": state.items,
        "proficiencies": state.proficiencies,
        "standalone effects": state.standalone_effects,
        "templates": state.sheets,
    }
    empty = [
        name for name, collection in required_collections.items() if not collection
    ]
    if empty:
        raise ValueError(f"Seed state has empty collections: {', '.join(empty)}.")

    expected_subsets = (
        ("actions", set(STARTER_ACTION_IDS), set(state.actions)),
        ("conditions", set(CONDITION_IDS), set(state.condition_presets)),
        ("encounters", set(ENCOUNTER_IDS), set(state.encounter_presets)),
        ("formulas", set(FORMULA_IDS), set(state.formulas)),
        ("items", set(STARTER_ITEM_IDS), set(state.items)),
        (
            "templates",
            set((*PLAYER_TEMPLATE_IDS, *ENEMY_TEMPLATE_IDS)),
            set(state.sheets),
        ),
    )
    for name, expected, actual in expected_subsets:
        missing = sorted(expected - actual)
        if missing:
            raise ValueError(f"Seed state is missing {name}: {', '.join(missing)}.")

    if not all(state.sheets[sheet_id].dm_only for sheet_id in ENEMY_TEMPLATE_IDS):
        raise ValueError("Seed enemy templates must be DM-only.")
    if set(state.sheet_access_codes) != set(SEED_ACCESS_CODES):
        raise ValueError("Seed state does not contain the deterministic access codes.")

    if state.active_conditions:
        raise ValueError("Seed state should start without active conditions.")


async def _build_seed_checkpoint(build_path: Path) -> State:
    store_module.STATE_PATH = build_path
    StateSingleton._state = None
    StateSingleton.restartState()
    await websocket_sessions.reset()
    await state_sync_service.reset()

    websocket = _SeedWebSocket()
    await websocket_sessions.connect(websocket, role="dm")
    for index, request in enumerate(
        authoring_requests(mana_manipulation_effect_bonus=7),
        start=1,
    ):
        payload = deepcopy(request)
        payload["request_id"] = f"seed-{index:03d}"
        await _send_authoring_request(websocket, payload)

    def add_access_codes(state: State) -> None:
        _add_seed_access_codes(state)

    await state_sync_service.apply_private_mutation(add_access_codes)
    seeded_state = store_module._load_checkpoint(build_path)
    if seeded_state is None:
        raise RuntimeError("The temporary seed checkpoint could not be reloaded.")
    _validate_seed_state(seeded_state)
    return seeded_state


async def seed_state(target_path: Path | None = None) -> State:
    """Build, validate, and atomically install the development seed state."""

    target = (target_path or store_module.STATE_PATH).resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    original_path = store_module.STATE_PATH
    original_state = StateSingleton._state

    try:
        with TemporaryDirectory(prefix=".seed-build-", dir=target.parent) as directory:
            build_path = Path(directory) / target.name
            seeded_state = await _build_seed_checkpoint(build_path)

        store_module.STATE_PATH = target
        StateSingleton.replaceState(seeded_state)
        installed_state = store_module._load_checkpoint(target)
        if installed_state is None:
            raise RuntimeError("The installed seed checkpoint could not be reloaded.")
        _validate_seed_state(installed_state)
        return installed_state
    finally:
        await websocket_sessions.reset()
        await state_sync_service.reset()
        store_module.STATE_PATH = original_path
        StateSingleton._state = original_state


def _print_summary(path: Path, state: State) -> None:
    print(f"Seeded development state at {path}")
    print(
        "Collections: "
        f"{len(state.sheets)} templates, "
        f"{len(state.instanced_sheets)} instances, "
        f"{len(state.actions)} actions, "
        f"{len(state.formulas)} formulas, "
        f"{len(state.attributes)} attributes, "
        f"{len(state.items)} items, "
        f"{len(state.condition_presets)} conditions, "
        f"{len(state.standalone_effects)} standalone effects"
    )
    print(f"Example Player 1 access code: EXAMPLE1 ({INSTANCE_ID})")
    print(f"Example Player 2 access code: EXAMPLE2 ({SHADOWBLADE_INSTANCE_ID})")
    print("Run this command only while the backend is stopped.")


def main() -> None:
    target = store_module.STATE_PATH.resolve()
    state = asyncio.run(seed_state(target))
    _print_summary(target, state)


if __name__ == "__main__":
    main()
