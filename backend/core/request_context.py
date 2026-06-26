from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass


@dataclass(frozen=True)
class RequestContext:
    request_id: str | None
    request_type: str
    action_id: str | None = None
    sheet_id: str | None = None


_current_request_context: ContextVar[RequestContext | None] = ContextVar(
    "current_request_context",
    default=None,
)


def set_request_context(context: RequestContext) -> Token[RequestContext | None]:
    return _current_request_context.set(context)


def reset_request_context(token: Token[RequestContext | None]) -> None:
    _current_request_context.reset(token)


def get_request_context() -> RequestContext | None:
    return _current_request_context.get()
