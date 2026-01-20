import json
from dataclasses import asdict
from typing import Optional
from backend.schemas.state.state import State
import logging

logger = logging.getLogger(__name__)
STATE_PATH = "state_dumpy.json"


class StateSingleton:
    _state: Optional[State] = None

    @classmethod
    def initializeState(cls) -> State:
        try:
            with open(STATE_PATH, "r") as file:
                data = json.load(file)
            cls._state = State(**data) if isinstance(data, dict) else State()
        except FileNotFoundError:
            logger.warning("Failed to load state: file not found")
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
        with open(STATE_PATH, "w") as file:
            json.dump(asdict(cls._state), file)

    @classmethod
    def restartState(cls) -> None:
        cls._state = State()
        cls.dumpState()
