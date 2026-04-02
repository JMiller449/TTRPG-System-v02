from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from fastapi import WebSocket

SessionRole = Literal["player", "dm"]


@dataclass
class WebSocketSession:
    websocket: WebSocket
    role: SessionRole = "player"

    @property
    def is_dm(self) -> bool:
        return self.role == "dm"
