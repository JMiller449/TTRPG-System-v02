from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

from backend.features.session.models import WebSocketSession

RequestT = TypeVar("RequestT", bound=BaseModel)


class RegistryError(Exception):
    """Base error for request registry failures."""


class UnknownRequestTypeError(RegistryError):
    """Raised when no route is registered for a request type."""


class MalformedRequestError(RegistryError):
    """Raised when the request payload is missing routing information."""


class RequestRoute(ABC, Generic[RequestT]):
    type_name: str
    request_model: type[RequestT]
    requires_dm: bool = False
    permission_denied_reason: str = "This request requires an authenticated DM session."

    def parse(self, payload: dict[str, Any]) -> RequestT:
        return self.request_model.model_validate(payload)

    def authorize(self, session: WebSocketSession) -> None:
        if self.requires_dm and not session.is_dm:
            raise PermissionError(self.permission_denied_reason)

    async def run(self, session: WebSocketSession, request: RequestT) -> None:
        self.authorize(session)
        await self.handle(session, request)

    @abstractmethod
    async def handle(self, session: WebSocketSession, request: RequestT) -> None:
        raise NotImplementedError


@dataclass(frozen=True)
class RouteMatch(Generic[RequestT]):
    route: RequestRoute[RequestT]
    request: RequestT


class RequestRegistry:
    def __init__(self) -> None:
        self._routes: dict[str, RequestRoute[Any]] = {}

    def register(self, route: RequestRoute[Any]) -> None:
        if route.type_name in self._routes:
            raise ValueError(f"Request type '{route.type_name}' is already registered.")
        self._routes[route.type_name] = route

    def request_types(self) -> tuple[str, ...]:
        return tuple(sorted(self._routes))

    def _resolve_route(self, payload: Any) -> RequestRoute[Any]:
        if not isinstance(payload, dict):
            raise MalformedRequestError("Invalid Request: payload must be an object")

        raw_type = payload.get("type")
        if not isinstance(raw_type, str) or not raw_type:
            raise MalformedRequestError("type: Field required")

        route = self._routes.get(raw_type)
        if route is None:
            raise UnknownRequestTypeError(f"Unknown request type: {raw_type}")
        return route

    def resolve(self, payload: Any) -> RouteMatch[BaseModel]:
        route = self._resolve_route(payload)
        request = route.parse(payload)
        return RouteMatch(route=route, request=request)

    async def dispatch(self, session: WebSocketSession, payload: Any) -> BaseModel:
        match = self.resolve(payload)
        await match.route.run(session, match.request)
        return match.request


def _register_feature_routes(registry: RequestRegistry) -> None:
    from backend.features.chat.route import register_routes as register_chat_routes
    from backend.features.sheet_admin.route import (
        register_routes as register_sheet_admin_routes,
    )
    from backend.features.sheet_runtime.route import (
        register_routes as register_sheet_runtime_routes,
    )
    from backend.features.state_sync.route import (
        register_routes as register_state_sync_routes,
    )

    register_chat_routes(registry)
    register_state_sync_routes(registry)
    register_sheet_runtime_routes(registry)
    register_sheet_admin_routes(registry)


request_registry = RequestRegistry()
_register_feature_routes(request_registry)
