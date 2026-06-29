from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.state.models.action_history import prune_action_history
from backend.state.migrations import (
    CURRENT_STATE_SCHEMA_VERSION,
    PersistedStateError,
    migrate_persisted_state,
)
from backend.state.models.state import State

logger = logging.getLogger(__name__)
STATE_PATH = Path(__file__).resolve().parents[2] / "state_dumpy.json"
DEFAULT_STATE = State()


def _backup_path(path: Path) -> Path:
    return path.with_name(f"{path.name}.bak")


def _temporary_path(path: Path) -> Path:
    return path.with_name(f"{path.name}.tmp")


def _decode_checkpoint(document: Any) -> State:
    migration = migrate_persisted_state(document)
    return State.from_dict(migration.state)


def _load_checkpoint(path: Path) -> State | None:
    try:
        with path.open("r", encoding="utf-8") as file:
            return _decode_checkpoint(json.load(file))
    except FileNotFoundError:
        return None
    except (
        AttributeError,
        json.JSONDecodeError,
        KeyError,
        OSError,
        PersistedStateError,
        TypeError,
        ValueError,
    ) as exc:
        logger.warning("Failed to load state checkpoint %s: %s", path, exc)
        return None


def _checkpoint_document(state: State) -> dict[str, Any]:
    return {
        "schema_version": CURRENT_STATE_SCHEMA_VERSION,
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "state": state.to_dict(include_private=True),
    }


def _fsync_directory(path: Path) -> None:
    flags = os.O_RDONLY
    if hasattr(os, "O_DIRECTORY"):
        flags |= os.O_DIRECTORY
    directory_fd = os.open(path, flags)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)


def _write_checkpoint(path: Path, state: State) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = _temporary_path(path)
    backup_path = _backup_path(path)

    try:
        with temporary_path.open("w", encoding="utf-8") as file:
            json.dump(_checkpoint_document(state), file)
            file.flush()
            os.fsync(file.fileno())

        if path.exists() and _load_checkpoint(path) is not None:
            os.replace(path, backup_path)
            _fsync_directory(path.parent)

        os.replace(temporary_path, path)
        _fsync_directory(path.parent)
    finally:
        temporary_path.unlink(missing_ok=True)


class StateSingleton:
    _state: State | None = None

    @classmethod
    def initializeState(cls) -> State:
        cls._state = _load_checkpoint(STATE_PATH)
        if cls._state is None:
            cls._state = _load_checkpoint(_backup_path(STATE_PATH))
            if cls._state is not None:
                logger.warning(
                    "Recovered state from backup checkpoint %s.",
                    _backup_path(STATE_PATH),
                )
        if cls._state is None:
            logger.warning("No valid state checkpoint found; using empty state.")
            cls._state = State()
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
        _write_checkpoint(STATE_PATH, cls._state)

    @classmethod
    def exportPersistedState(cls) -> dict[str, Any]:
        if cls._state is None:
            cls._state = State()
        cls._state.action_history = prune_action_history(cls._state.action_history)
        return _checkpoint_document(cls._state)

    @classmethod
    def replaceState(cls, state: State) -> None:
        state.action_history = prune_action_history(state.action_history)
        _write_checkpoint(STATE_PATH, state)
        cls._state = state

    @classmethod
    def restartState(cls) -> None:
        cls._state = State()
        cls.dumpState()
