from __future__ import annotations

import asyncio
from collections import deque
from collections.abc import Callable
from copy import deepcopy
from typing import Any, TypeVar

from backend.core.transport import PatchOp
from backend.features.session.models import WebSocketSession
from backend.features.session.service import websocket_sessions
from backend.features.state_sync.schema import (
    SocketGroupAssigned,
    StatePatch,
    StateSnapshot,
)
from backend.state.models.state import State
from backend.state.store import StateSingleton

MutationResultT = TypeVar("MutationResultT")


def build_connection_state(
    session: WebSocketSession,
    *,
    groups: dict[str, int],
    request_id: str | None = None,
) -> SocketGroupAssigned:
    return SocketGroupAssigned(
        response_id=None,
        is_dm=session.is_dm,
        groups=groups,
        request_id=request_id,
    )


def build_state_snapshot(
    state: dict[str, Any],
    *,
    state_version: int,
    request_id: str | None = None,
) -> StateSnapshot:
    return StateSnapshot(
        response_id=None,
        state=state,
        state_version=state_version,
        request_id=request_id,
    )


def build_state_patch(
    ops: list[PatchOp],
    *,
    state_version: int,
    request_id: str | None = None,
) -> StatePatch:
    return StatePatch(
        response_id=None,
        ops=ops,
        state_version=state_version,
        request_id=request_id,
    )


async def send_bootstrap(session: WebSocketSession) -> None:
    groups = await websocket_sessions.group_counts()
    await websocket_sessions.send(
        session, build_connection_state(session, groups=groups)
    )
    await websocket_sessions.send(session, await state_sync_service.snapshot())


class StateSyncService:
    def __init__(self, *, patch_history_limit: int = 256) -> None:
        self._lock = asyncio.Lock()
        self._state_version = 0
        self._patch_history: deque[StatePatch] = deque(maxlen=patch_history_limit)

    @property
    def current_version(self) -> int:
        return self._state_version

    async def snapshot(self, *, request_id: str | None = None) -> StateSnapshot:
        async with self._lock:
            return build_state_snapshot(
                StateSingleton.getState().to_dict(),
                state_version=self._state_version,
                request_id=request_id,
            )

    async def reset(self) -> None:
        async with self._lock:
            self._state_version = 0
            self._patch_history.clear()

    def _next_patch(
        self,
        ops: list[PatchOp],
        *,
        request_id: str | None = None,
    ) -> StatePatch:
        self._state_version += 1
        patch = build_state_patch(
            ops,
            state_version=self._state_version,
            request_id=request_id,
        )
        self._patch_history.append(patch)
        return patch

    async def replay_since(self, last_seen_version: int) -> list[StatePatch] | None:
        async with self._lock:
            if last_seen_version < 0:
                return None

            if last_seen_version > self._state_version:
                return None

            if last_seen_version == self._state_version:
                return []

            if not self._patch_history:
                return None

            earliest_version = self._patch_history[0].state_version
            if last_seen_version + 1 < earliest_version:
                return None

            return [
                deepcopy(patch)
                for patch in self._patch_history
                if patch.state_version > last_seen_version
            ]

    def _encode_segment(self, segment: str) -> str:
        return segment.replace("~", "~0").replace("/", "~1")

    def join_path(self, *segments: str) -> str:
        return "/" + "/".join(self._encode_segment(segment) for segment in segments)

    def _decode_segment(self, segment: str) -> str:
        return segment.replace("~1", "/").replace("~0", "~")

    def _parse_path(self, path: str) -> list[str]:
        if not path.startswith("/"):
            raise ValueError(f"State path must start with '/': {path}")
        if path == "/":
            return []
        return [self._decode_segment(segment) for segment in path[1:].split("/")]

    def _list_index(self, raw_index: str) -> int:
        try:
            return int(raw_index)
        except ValueError as exc:
            raise ValueError(f"Invalid list index '{raw_index}'.") from exc

    def _resolve_container(self, root: Any, path: str) -> tuple[Any, str]:
        segments = self._parse_path(path)
        if not segments:
            raise ValueError("Root path mutations are not supported.")

        current = root
        for idx, segment in enumerate(segments[:-1]):
            if isinstance(current, dict):
                if segment not in current:
                    raise ValueError(
                        f"State branch '{segment}' which is idx {idx} does not exist for path {path}."
                    )
                current = current[segment]
                continue

            if isinstance(current, list):
                list_index = self._list_index(segment)
                try:
                    current = current[list_index]
                except IndexError as exc:
                    raise ValueError(
                        f"State branch '{segment}' which is idx {idx} does not exist for path {path}."
                    ) from exc
                continue

            if hasattr(current, segment):
                current = getattr(current, segment)
                continue

            raise ValueError(
                f"Cannot traverse state path {path}; encountered {current.__class__.__name__}."
            )

        return current, segments[-1]

    def _clone_value(self, value: Any) -> Any:
        return deepcopy(value)

    def add_mutation(self, state: State, path: str, value: Any) -> PatchOp:
        container, leaf = self._resolve_container(state, path)
        value_copy = self._clone_value(value)

        if isinstance(container, dict):
            if leaf in container:
                raise ValueError(f"State path {path} already exists.")
            container[leaf] = value_copy
            return PatchOp(op="add", path=path, value=self._clone_value(value))

        if isinstance(container, list):
            if leaf == "-":
                container.append(value_copy)
                return PatchOp(op="add", path=path, value=self._clone_value(value))
            index = self._list_index(leaf)
            if index < 0 or index > len(container):
                raise ValueError(f"State path {path} does not support that list index.")
            container.insert(index, value_copy)
            return PatchOp(op="add", path=path, value=self._clone_value(value))

        raise ValueError(f"State path {path} does not support add mutations.")

    def set_mutation(self, state: State, path: str, value: Any) -> PatchOp:
        container, leaf = self._resolve_container(state, path)
        value_copy = self._clone_value(value)

        if isinstance(container, dict):
            container[leaf] = value_copy
            return PatchOp(op="set", path=path, value=self._clone_value(value))

        if isinstance(container, list):
            index = self._list_index(leaf)
            try:
                container[index] = value_copy
            except IndexError as exc:
                raise ValueError(f"State path {path} does not exist.") from exc
            return PatchOp(op="set", path=path, value=self._clone_value(value))

        if hasattr(container, leaf):
            setattr(container, leaf, value_copy)
            return PatchOp(op="set", path=path, value=self._clone_value(value))

        raise ValueError(f"State path {path} does not support set mutations.")

    def remove_mutation(self, state: State, path: str) -> tuple[Any, PatchOp]:
        container, leaf = self._resolve_container(state, path)

        if isinstance(container, dict):
            if leaf not in container:
                raise ValueError(f"State path {path} does not exist.")
            removed = container.pop(leaf)
            return self._clone_value(removed), PatchOp(op="remove", path=path)

        if isinstance(container, list):
            index = self._list_index(leaf)
            try:
                removed = container.pop(index)
            except IndexError as exc:
                raise ValueError(f"State path {path} does not exist.") from exc
            return self._clone_value(removed), PatchOp(op="remove", path=path)

        raise ValueError(f"State path {path} does not support remove mutations.")

    def increment_mutation(
        self, state: State, path: str, amount: int | float
    ) -> PatchOp:
        container, leaf = self._resolve_container(state, path)

        if isinstance(container, dict):
            if leaf not in container:
                raise ValueError(f"State path {path} does not exist.")
            current_value = container[leaf]
            if not isinstance(current_value, int | float):
                raise ValueError(f"State path {path} is not numeric.")
            container[leaf] = current_value + amount
            return PatchOp(op="inc", path=path, value=amount)

        if isinstance(container, list):
            index = self._list_index(leaf)
            try:
                current_value = container[index]
            except IndexError as exc:
                raise ValueError(f"State path {path} does not exist.") from exc
            if not isinstance(current_value, int | float):
                raise ValueError(f"State path {path} is not numeric.")
            container[index] = current_value + amount
            return PatchOp(op="inc", path=path, value=amount)

        if hasattr(container, leaf):
            current_value = getattr(container, leaf)
            if not isinstance(current_value, int | float):
                raise ValueError(f"State path {path} is not numeric.")
            setattr(container, leaf, current_value + amount)
            return PatchOp(op="inc", path=path, value=amount)

        raise ValueError(f"State path {path} does not support increment mutations.")

    def decrement_mutation(
        self, state: State, path: str, amount: int | float
    ) -> PatchOp:
        return self.increment_mutation(state, path, -amount)

    async def apply_mutation(
        self,
        mutation: Callable[[State], tuple[MutationResultT, list[PatchOp]]],
        *,
        request_id: str | None = None,
    ) -> MutationResultT:
        async with self._lock:
            state = StateSingleton.getState()
            result, ops = mutation(state)
            if ops:
                StateSingleton.dumpState()
                patch = self._next_patch(ops, request_id=request_id)
                await websocket_sessions.broadcast(patch)
            return result

    async def add(
        self,
        path: str,
        value: Any,
        *,
        request_id: str | None = None,
    ) -> PatchOp:
        def mutation(state: State) -> tuple[PatchOp, list[PatchOp]]:
            op = self.add_mutation(state, path, value)
            return op, [op]

        return await self.apply_mutation(mutation, request_id=request_id)

    async def set(
        self,
        path: str,
        value: Any,
        *,
        request_id: str | None = None,
    ) -> PatchOp:
        def mutation(state: State) -> tuple[PatchOp, list[PatchOp]]:
            op = self.set_mutation(state, path, value)
            return op, [op]

        return await self.apply_mutation(mutation, request_id=request_id)

    async def remove(
        self,
        path: str,
        *,
        request_id: str | None = None,
    ) -> tuple[Any, PatchOp]:
        def mutation(state: State) -> tuple[tuple[Any, PatchOp], list[PatchOp]]:
            removed, op = self.remove_mutation(state, path)
            return (removed, op), [op]

        return await self.apply_mutation(mutation, request_id=request_id)

    async def increment(
        self,
        path: str,
        amount: int | float,
        *,
        request_id: str | None = None,
    ) -> PatchOp:
        def mutation(state: State) -> tuple[PatchOp, list[PatchOp]]:
            op = self.increment_mutation(state, path, amount)
            return op, [op]

        return await self.apply_mutation(mutation, request_id=request_id)

    async def decrement(
        self,
        path: str,
        amount: int | float,
        *,
        request_id: str | None = None,
    ) -> PatchOp:
        def mutation(state: State) -> tuple[PatchOp, list[PatchOp]]:
            op = self.decrement_mutation(state, path, amount)
            return op, [op]

        return await self.apply_mutation(mutation, request_id=request_id)


state_sync_service = StateSyncService()
