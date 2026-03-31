from dataclasses import dataclass
from typing import Literal

from backend.core.transport import RequestModel, ResponseModel

AuthRole = Literal["player", "dm", "service"]


class Authenticate(RequestModel):
    token: str
    type: Literal["authenticate"]


@dataclass
class AuthenticateResponse(ResponseModel):
    authenticated: bool
    role: AuthRole | None
    reason: str | None = None
    type: Literal["authenticate_response"] = "authenticate_response"
    request_id: str | None = None
