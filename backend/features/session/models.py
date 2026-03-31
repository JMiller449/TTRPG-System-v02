from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from fastapi import WebSocket

SessionRole = Literal["player", "dm"]


@dataclass
class WebSocketSession:
    websocket: WebSocket
    role: SessionRole = "player"
    focused_sheet_id: str | None = None

    @property
    def is_dm(self) -> bool:
        return self.role == "dm"
