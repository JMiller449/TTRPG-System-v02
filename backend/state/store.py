from __future__ import annotations

import logging
import json
from pathlib import Path

from backend.state.models.state import State

logger = logging.getLogger(__name__)
STATE_PATH = Path(__file__).resolve().parents[2] / "state_dumpy.json"
DEFAULT_STATE = State()


class StateSingleton:
    _state: State | None = None

    @classmethod
    def initializeState(cls) -> State:
        try:
            with STATE_PATH.open("r", encoding="utf-8") as file:
                data = json.load(file)
        except FileNotFoundError:
            logger.warning("Failed to load state: file not found")
            data = {}

        if not isinstance(data, dict):
            logger.warning(
                "Failed to load state: persisted state was not a JSON object"
            )
            data = {}

        cls._state = State.from_dict(data)
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
        with STATE_PATH.open("w", encoding="utf-8") as file:
            json.dump(cls._state.to_dict(), file)

    @classmethod
    def restartState(cls) -> None:
        cls._state = State()
        cls.dumpState()
