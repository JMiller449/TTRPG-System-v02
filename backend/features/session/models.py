from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from fastapi import WebSocket

SessionRole = Literal["unauthenticated", "player", "dm"]


@dataclass
class WebSocketSession:
    websocket: WebSocket
    role: SessionRole = "unauthenticated"
    assigned_sheet_id: str | None = None
    assigned_instance_id: str | None = None

    @property
    def is_authenticated(self) -> bool:
        return self.role != "unauthenticated"

    @property
    def is_dm(self) -> bool:
        return self.role == "dm"
