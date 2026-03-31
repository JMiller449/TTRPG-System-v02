from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel

from backend.core.transport import RequestModel, ResponseModel


class SendRoll20ChatMessage(RequestModel):
    message: str
    type: Literal["send_roll20_chat_message"]


@dataclass
class Roll20ChatMessageSent(ResponseModel):
    message_id: str
    type: Literal["roll20_chat_message_sent"] = "roll20_chat_message_sent"
    request_id: str | None = None


@dataclass
class Roll20ChatMessage:
    message_id: str
    message: str
    type: Literal["chat_message"] = "chat_message"
    request_id: str | None = None


class Roll20BridgeHello(BaseModel):
    source: str
    page_url: str
    type: Literal["hello"]


class Roll20ChatDelivery(BaseModel):
    message_id: str
    success: bool
    error: str | None = None
    type: Literal["chat_delivery"]


class SendRoll20ChatMessageRequest(BaseModel):
    admin_code: str
    message: str
