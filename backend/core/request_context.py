from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass

from pydantic import BaseModel

from backend.features.session.models import SessionRole


@dataclass(frozen=True)
class RequestSource:
    request_id: str | None
    request_type: str
    actor_role: SessionRole
    entity_ids: tuple[tuple[str, str], ...] = ()

    def entity_id(self, name: str) -> str | None:
        return dict(self.entity_ids).get(name)

    @property
    def action_id(self) -> str | None:
        return self.entity_id("action_id")

    @property
    def sheet_id(self) -> str | None:
        return (
            self.entity_id("sheet_id")
            or self.entity_id("instance_id")
            or self.entity_id("parent_sheet_id")
        )


_current_request_source: ContextVar[RequestSource | None] = ContextVar(
    "current_request_source",
    default=None,
)


def _request_entity_ids(request: BaseModel) -> tuple[tuple[str, str], ...]:
    payload = request.model_dump(mode="python")
    entity_ids: dict[str, str] = {}

    for field_name, value in payload.items():
        if field_name == "request_id":
            continue
        if field_name.endswith("_id") and isinstance(value, str) and value:
            entity_ids[field_name] = value
            continue
        if not isinstance(value, dict):
            continue

        nested_id = value.get("id")
        if isinstance(nested_id, str) and nested_id:
            entity_ids[f"{field_name}_id"] = nested_id
        for nested_name, nested_value in value.items():
            if (
                nested_name.endswith("_id")
                and isinstance(nested_value, str)
                and nested_value
            ):
                entity_ids.setdefault(nested_name, nested_value)

    return tuple(sorted(entity_ids.items()))


def build_request_source(
    request: BaseModel,
    *,
    actor_role: SessionRole,
) -> RequestSource:
    request_type = getattr(request, "type", None)
    if not isinstance(request_type, str) or not request_type:
        raise ValueError("Request source requires a request type.")
    request_id = getattr(request, "request_id", None)
    if request_id is not None and not isinstance(request_id, str):
        raise ValueError("Request source request ID must be a string or null.")
    return RequestSource(
        request_id=request_id,
        request_type=request_type,
        actor_role=actor_role,
        entity_ids=_request_entity_ids(request),
    )


def current_request_source() -> RequestSource | None:
    return _current_request_source.get()


def get_request_context() -> RequestSource | None:
    """Compatibility name for callers that treat request source as context."""
    return current_request_source()


@contextmanager
def request_source_context(source: RequestSource) -> Iterator[None]:
    token = _current_request_source.set(source)
    try:
        yield
    finally:
        _current_request_source.reset(token)
