from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict

from backend.core.transport import RequestModel


class SendRoll20ChatMessage(RequestModel):
    message: str
    type: Literal["send_roll20_chat_message"]


class GetRoll20BridgeStatus(RequestModel):
    type: Literal["get_roll20_bridge_status"]


class GetRoll20BridgeSyncConfig(RequestModel):
    type: Literal["get_roll20_bridge_sync_config"]


@dataclass
class Roll20ChatMessage:
    message_id: str
    message: str
    type: Literal["chat_message"] = "chat_message"
    request_id: str | None = None


class Roll20BridgeHello(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: Literal["roll20_violentmonkey_userscript"]
    type: Literal["hello"]


class Roll20ChatDelivery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_id: str
    success: bool
    reason: Literal[
        "chat_ui_not_found",
        "chat_input_failed",
        "chat_submit_failed",
        "unknown",
    ] | None = None
    type: Literal["chat_delivery"]
