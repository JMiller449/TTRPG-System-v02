from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from backend.state.models.action_history import prune_action_history
from backend.state.models.state import State
from backend.state.migrations import (
    PersistedStateError,
    build_persisted_state,
    migrate_persisted_state,
)

logger = logging.getLogger(__name__)
STATE_PATH = Path(__file__).resolve().parents[2] / "state_dumpy.json"
DEFAULT_STATE = State()


class StateSingleton:
    _state: State | None = None

    @classmethod
    def initializeState(cls) -> State:
        loaded_from_file = True
        try:
            with STATE_PATH.open("r", encoding="utf-8") as file:
                data = json.load(file)
        except FileNotFoundError:
            logger.warning("Failed to load state: file not found")
            data = {}
            loaded_from_file = False
        except json.JSONDecodeError as exc:
            raise PersistedStateError("Persisted state is not valid JSON.") from exc

        migration = migrate_persisted_state(data)
        cls._state = State.from_dict(migration.state)
        if loaded_from_file and migration.migrated:
            logger.info(
                "Migrated persisted state schema from version %s to the current version.",
                migration.source_version,
            )
            cls.dumpState()
        return cls._state

    @classmethod
    def getState(cls) -> State:
        if cls._state is None:
            state = cls.initializeState()
            return state
        return cls._state

    @classmethod
    def dumpState(cls) -> None:
        if cls._state is None:
            cls._state = State()
        cls._state.action_history = prune_action_history(cls._state.action_history)
        persisted_state = build_persisted_state(
            cls._state.to_dict(include_private=True)
        )
        cls.writePersistedState(persisted_state)

    @classmethod
    def writePersistedState(cls, persisted_state: dict[str, Any]) -> None:
        temporary_path = STATE_PATH.with_suffix(f"{STATE_PATH.suffix}.tmp")
        with temporary_path.open("w", encoding="utf-8") as file:
            json.dump(persisted_state, file)
            file.flush()
            os.fsync(file.fileno())
        temporary_path.replace(STATE_PATH)

    @classmethod
    def exportPersistedState(cls) -> dict[str, Any]:
        if cls._state is None:
            cls._state = State()
        cls._state.action_history = prune_action_history(cls._state.action_history)
        return build_persisted_state(cls._state.to_dict(include_private=True))

    @classmethod
    def replaceState(cls, state: State) -> None:
        state.action_history = prune_action_history(state.action_history)
        persisted_state = build_persisted_state(state.to_dict(include_private=True))
        cls.writePersistedState(persisted_state)
        cls._state = state

    @classmethod
    def restartState(cls) -> None:
        cls._state = State()
        cls.dumpState()
