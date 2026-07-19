from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

from backend.core.request_context import build_request_source, request_source_context
from backend.features.session.models import SessionRole, WebSocketSession

RequestT = TypeVar("RequestT", bound=BaseModel)
EventModelT = TypeVar("EventModelT")


class RegistryError(Exception):
    """Base error for request registry failures."""


class UnknownRequestTypeError(RegistryError):
    """Raised when no route is registered for a request type."""


class MalformedRequestError(RegistryError):
    """Raised when the request payload is missing routing information."""


@dataclass(frozen=True)
class ClientGenerationMetadata:
    namespace: str
    method_name: str


@dataclass(frozen=True)
class RouteContract:
    type_name: str
    request_model: type[BaseModel]
    emitted_event_models: tuple[type[Any], ...]
    minimum_role: SessionRole
    client_generation: ClientGenerationMetadata | None


class RequestRoute(ABC, Generic[RequestT]):
    type_name: str
    request_model: type[RequestT]
    emitted_event_models: tuple[type[Any], ...] = ()
    minimum_role: SessionRole = "player"
    permission_denied_reason: str | None = None
    client_generation: ClientGenerationMetadata | None = None

    def parse(self, payload: dict[str, Any]) -> RequestT:
        return self.request_model.model_validate(payload)

    def _permission_denied_reason(self) -> str:
        if self.permission_denied_reason is not None:
            return self.permission_denied_reason
        if self.minimum_role == "dm":
            return "This request requires an authenticated DM session."
        if self.minimum_role == "player":
            return "Authenticate first."
        return "This request is not available for the current session role."

    def authorize(self, session: WebSocketSession) -> None:
        role_rank = {"unauthenticated": 0, "player": 1, "dm": 2}
        if role_rank[session.role] < role_rank[self.minimum_role]:
            raise PermissionError(self._permission_denied_reason())

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
        self._client_generation_keys: set[tuple[str, str]] = set()

    def register(self, route: RequestRoute[Any]) -> None:
        if route.type_name in self._routes:
            raise ValueError(f"Request type '{route.type_name}' is already registered.")
        metadata = route.client_generation
        if metadata is not None:
            if not metadata.namespace.isidentifier():
                raise ValueError(
                    "Client generation namespace must be a valid identifier: "
                    f"{metadata.namespace!r}"
                )
            if not metadata.method_name.isidentifier():
                raise ValueError(
                    "Client generation method_name must be a valid identifier: "
                    f"{metadata.method_name!r}"
                )
            key = (metadata.namespace, metadata.method_name)
            if key in self._client_generation_keys:
                raise ValueError(
                    "Client generation metadata already registered for "
                    f"{metadata.namespace}.{metadata.method_name}."
                )
            self._client_generation_keys.add(key)
        self._routes[route.type_name] = route

    def request_types(self) -> tuple[str, ...]:
        return tuple(sorted(self._routes))

    def routes(self) -> tuple[RequestRoute[Any], ...]:
        return tuple(self._routes[type_name] for type_name in sorted(self._routes))

    def request_models(self) -> tuple[type[BaseModel], ...]:
        return tuple(route.request_model for route in self.routes())

    def emitted_event_models(self) -> tuple[type[Any], ...]:
        ordered_models: list[type[Any]] = []
        for route in self.routes():
            for model in route.emitted_event_models:
                if model not in ordered_models:
                    ordered_models.append(model)
        return tuple(ordered_models)

    def route_contracts(self) -> tuple[RouteContract, ...]:
        return tuple(
            RouteContract(
                type_name=route.type_name,
                request_model=route.request_model,
                emitted_event_models=route.emitted_event_models,
                minimum_role=route.minimum_role,
                client_generation=route.client_generation,
            )
            for route in self.routes()
        )

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
        source = build_request_source(match.request, actor_role=session.role)
        with request_source_context(source):
            await match.route.run(session, match.request)
        return match.request


def _register_feature_routes(registry: RequestRegistry) -> None:
    from backend.features.auth.route import register_routes as register_auth_routes
    from backend.features.chat.route import register_routes as register_chat_routes
    from backend.features.encounters.route import (
        register_routes as register_encounter_routes,
    )
    from backend.features.contribution_points.route import (
        register_routes as register_contribution_point_routes,
    )
    from backend.features.pinned_actions.route import (
        register_routes as register_pinned_action_routes,
    )
    from backend.features.attributes.route import register_routes as register_attribute_routes
    from backend.features.sheet_runtime.route import (
        register_routes as register_sheet_runtime_routes,
    )
    from backend.features.sheet_access.route import (
        register_routes as register_sheet_access_routes,
    )
    from backend.features.sheet_admin.conditions.route import (
        register_routes as register_sheet_admin_conditions_routes,
    )
    from backend.features.sheet_admin.actions.route import (
        register_routes as register_sheet_admin_actions_routes,
    )
    from backend.features.sheet_admin.formulas.route import (
        register_routes as register_sheet_admin_formulas_routes,
    )
    from backend.features.sheet_admin.items.route import (
        register_routes as register_sheet_admin_items_routes,
    )
    from backend.features.sheet_admin.proficiencies.route import (
        register_routes as register_sheet_admin_proficiencies_routes,
    )
    from backend.features.sheet_admin.sheets.route import (
        register_routes as register_sheet_admin_sheets_routes,
    )
    from backend.features.sheet_admin.stats.route import (
        register_routes as register_sheet_admin_stats_routes,
    )
    from backend.features.state_sync.route import (
        register_routes as register_state_sync_routes,
    )
    from backend.features.state_backup.route import (
        register_routes as register_state_backup_routes,
    )
    from backend.features.standalone_effects.route import (
        register_routes as register_standalone_effect_routes,
    )
    from backend.features.variable_registry.route import (
        register_routes as register_variable_registry_routes,
    )
    from backend.features.xp_tracker.route import (
        register_routes as register_xp_tracker_routes,
    )

    register_auth_routes(registry)
    register_chat_routes(registry)
    register_encounter_routes(registry)
    register_contribution_point_routes(registry)
    register_attribute_routes(registry)
    register_sheet_admin_actions_routes(registry)
    register_sheet_admin_conditions_routes(registry)
    register_sheet_admin_formulas_routes(registry)
    register_sheet_admin_items_routes(registry)
    register_sheet_admin_proficiencies_routes(registry)
    register_sheet_admin_sheets_routes(registry)
    register_sheet_admin_stats_routes(registry)
    register_sheet_access_routes(registry)
    register_state_backup_routes(registry)
    register_standalone_effect_routes(registry)
    register_state_sync_routes(registry)
    register_sheet_runtime_routes(registry)
    register_pinned_action_routes(registry)
    register_variable_registry_routes(registry)
    register_xp_tracker_routes(registry)


request_registry = RequestRegistry()
_register_feature_routes(request_registry)
