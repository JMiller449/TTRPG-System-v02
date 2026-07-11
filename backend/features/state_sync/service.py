from __future__ import annotations

import asyncio
import logging
from collections import deque
from collections.abc import Callable
from copy import deepcopy
from dataclasses import asdict, dataclass, fields, is_dataclass
from typing import Any, TypeVar

from backend.core.request_context import RequestSource, current_request_source
from backend.core.transport import PatchOp
from backend.features.action_history.service import (
    serialize_action_history,
    serialize_action_history_entry,
)
from backend.features.formula_runtime.service import evaluate_sheet_stats
from backend.features.session.models import SessionRole, WebSocketSession
from backend.features.session.service import websocket_sessions
from backend.features.state_sync.schema import (
    StatePatch,
    StateSnapshot,
)
from backend.state.models.state import State
from backend.state.store import StateSingleton

MutationResultT = TypeVar("MutationResultT")
logger = logging.getLogger(__name__)
PRIVATE_ITEM_FIELDS = {"gm_notes", "gm_special_properties"}
PRIVATE_SHEET_FIELDS = {"notes"}
PRIVATE_SHEET_XP_FIELDS = {"xp_cap", "xp_given_when_slayed"}
PRIVATE_STATE_ROOTS = {"equipment_effect_projections"}
DM_ONLY_STATE_ROOTS = {"parties", "kill_registry", "xp_adjustments"}
_MISSING = object()


class DuplicateRequestError(ValueError):
    """Raised when a completed state-changing request is submitted again."""


@dataclass(frozen=True)
class MutationAuditEntry:
    state_version: int
    request_id: str | None
    source: RequestSource | None
    operations: tuple[str, ...]
    paths: tuple[str, ...]

    @property
    def request_type(self) -> str | None:
        return self.source.request_type if self.source is not None else None

    @property
    def action_id(self) -> str | None:
        return self.source.action_id if self.source is not None else None

    @property
    def sheet_id(self) -> str | None:
        return self.source.sheet_id if self.source is not None else None

    @property
    def operation_paths(self) -> tuple[str, ...]:
        return self.paths


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
    await websocket_sessions.send(
        session,
        await state_sync_service.snapshot(
            role=session.role,
            assigned_instance_id=session.assigned_instance_id,
        ),
    )


class StateSyncService:
    def __init__(
        self,
        *,
        patch_history_limit: int = 256,
        processed_request_limit: int = 512,
        mutation_audit_limit: int = 256,
        undo_history_limit: int = 50,
    ) -> None:
        if processed_request_limit < 1:
            raise ValueError("processed_request_limit must be at least 1.")
        if mutation_audit_limit < 1:
            raise ValueError("mutation_audit_limit must be at least 1.")
        self._lock = asyncio.Lock()
        self._state_version = 0
        self._patch_history: deque[StatePatch] = deque(maxlen=patch_history_limit)
        self._processed_request_ids: deque[str] = deque(
            maxlen=processed_request_limit
        )
        self._processed_request_id_set: set[str] = set()
        self._mutation_audit: deque[MutationAuditEntry] = deque(
            maxlen=mutation_audit_limit
        )
        self._undo_history: deque[list[PatchOp]] = deque(maxlen=undo_history_limit)

    @property
    def current_version(self) -> int:
        return self._state_version

    @property
    def undo_depth(self) -> int:
        return len(self._undo_history)

    @property
    def mutation_history(self) -> tuple[MutationAuditEntry, ...]:
        return tuple(self._mutation_audit)

    def _redact_item_payload(self, value: Any) -> Any:
        if is_dataclass(value):
            value = asdict(value)
        elif isinstance(value, dict):
            value = deepcopy(value)
        else:
            return value

        for field_name in PRIVATE_ITEM_FIELDS:
            value.pop(field_name, None)
        self._redact_subject_attributes(value)
        return value

    def _redact_subject_attributes(self, value: dict[str, Any]) -> None:
        subject_attributes = value.get("attributes")
        if not isinstance(subject_attributes, dict):
            return
        hidden_attribute_ids = {
            attribute_id
            for attribute_id, attribute in StateSingleton.getState().attributes.items()
            if attribute.visibility == "gm_only"
        }
        for attribute_id in hidden_attribute_ids:
            subject_attributes.pop(attribute_id, None)

    def _redact_sheet_payload(self, value: Any) -> Any:
        if is_dataclass(value):
            value = asdict(value)
        elif isinstance(value, dict):
            value = deepcopy(value)
        else:
            return value

        for field_name in PRIVATE_SHEET_FIELDS:
            value.pop(field_name, None)
        value["xp_cap"] = 0
        value["xp_given_when_slayed"] = 0
        sheet_attributes = value.get("attributes")
        if isinstance(sheet_attributes, dict):
            hidden_attribute_ids = {
                attribute_id
                for attribute_id, attribute in StateSingleton.getState().attributes.items()
                if attribute.visibility == "gm_only"
            }
            for attribute_id in hidden_attribute_ids:
                sheet_attributes.pop(attribute_id, None)
        return value

    def _redact_state_for_role(
        self,
        state: dict[str, Any],
        *,
        role: SessionRole,
        assigned_instance_id: str | None = None,
    ) -> dict[str, Any]:
        if role == "dm":
            return state

        for root in PRIVATE_STATE_ROOTS | DM_ONLY_STATE_ROOTS:
            state.pop(root, None)

        hidden_attribute_ids = {
            attribute_id
            for attribute_id, attribute in state.get("attributes", {}).items()
            if isinstance(attribute, dict) and attribute.get("visibility") == "gm_only"
        }
        for attribute_id in hidden_attribute_ids:
            state.get("attributes", {}).pop(attribute_id, None)

        hidden_condition_ids = {
            condition_id
            for condition_id, condition in state.get("condition_presets", {}).items()
            if isinstance(condition, dict) and condition.get("visibility") == "gm_only"
        }
        for condition_id in hidden_condition_ids:
            state.get("condition_presets", {}).pop(condition_id, None)

        visible_applications = {
            application_id
            for application_id, condition in state.get("active_conditions", {}).items()
            if isinstance(condition, dict)
            and condition.get("visibility") != "gm_only"
            and condition.get("instance_id") == assigned_instance_id
        }
        state["active_conditions"] = {
            application_id: condition
            for application_id, condition in state.get("active_conditions", {}).items()
            if application_id in visible_applications
        }
        state["standalone_effect_applications"] = {
            application_id: application
            for application_id, application in state.get(
                "standalone_effect_applications", {}
            ).items()
            if isinstance(application, dict)
            and application.get("instance_id") == assigned_instance_id
        }

        hidden_augmentation_ids: set[str] = set()
        for augmentation_id, augmentation in list(
            state.get("augmentations", {}).items()
        ):
            if not isinstance(augmentation, dict):
                continue
            source = augmentation.get("source")
            if not isinstance(source, dict) or source.get("type") != "condition":
                continue
            if source.get("application_id") not in visible_applications:
                hidden_augmentation_ids.add(augmentation_id)
                state["augmentations"].pop(augmentation_id, None)

        for instance in state.get("instanced_sheets", {}).values():
            if not isinstance(instance, dict):
                continue
            augments = instance.get("augments")
            if not isinstance(augments, dict):
                augments = None
            if isinstance(augments, dict):
                for augmentation_id in hidden_augmentation_ids:
                    augments.pop(augmentation_id, None)
            instance_attributes = instance.get("attributes")
            if isinstance(instance_attributes, dict):
                for attribute_id in hidden_attribute_ids:
                    instance_attributes.pop(attribute_id, None)

        for sheet in state.get("sheets", {}).values():
            if not isinstance(sheet, dict):
                continue
            for field_name in PRIVATE_SHEET_FIELDS:
                sheet.pop(field_name, None)
            sheet["xp_cap"] = 0
            sheet["xp_given_when_slayed"] = 0
            sheet_attributes = sheet.get("attributes")
            if isinstance(sheet_attributes, dict):
                for attribute_id in hidden_attribute_ids:
                    sheet_attributes.pop(attribute_id, None)

        for item in state.get("items", {}).values():
            if not isinstance(item, dict):
                continue
            for field_name in PRIVATE_ITEM_FIELDS:
                item.pop(field_name, None)
            self._redact_subject_attributes(item)
        for action in state.get("actions", {}).values():
            if isinstance(action, dict):
                self._redact_subject_attributes(action)
        return state

    def _redact_patch_for_role(
        self,
        patch: StatePatch,
        *,
        role: SessionRole,
        assigned_instance_id: str | None = None,
    ) -> StatePatch:
        redacted_patch = deepcopy(patch)
        if not redacted_patch.ops:
            return redacted_patch

        redacted_ops: list[PatchOp] = []
        for op in redacted_patch.ops:
            segments = self._parse_path(op.path)
            if segments and segments[0] in PRIVATE_STATE_ROOTS:
                continue
            if segments and segments[0] == "action_history":
                if op.op == "remove":
                    redacted_ops.append(op)
                    continue

                if len(segments) == 1:
                    serialized_entries = serialize_action_history(
                        StateSingleton.getState().action_history,
                        role=role,
                        assigned_instance_id=assigned_instance_id,
                    )
                    op.value = {
                        key: value.model_dump(mode="json")
                        for key, value in serialized_entries.items()
                    }
                    redacted_ops.append(op)
                    continue

                entry_id = segments[1]
                entry = StateSingleton.getState().action_history.get(entry_id)
                serialized_entry = (
                    serialize_action_history_entry(
                        entry,
                        role=role,
                        assigned_instance_id=assigned_instance_id,
                    )
                    if entry is not None
                    else None
                )
                if serialized_entry is None:
                    if op.op == "set":
                        redacted_ops.append(PatchOp(op="remove", path=op.path))
                    continue

                redacted_ops.append(
                    PatchOp(
                        op=op.op if len(segments) == 2 else "set",
                        path=(
                            op.path
                            if len(segments) == 2
                            else self.join_path("action_history", entry_id)
                        ),
                        value=serialized_entry.model_dump(mode="json"),
                    )
                )
                continue
            if role == "dm":
                redacted_ops.append(op)
                continue

            if segments and segments[0] in DM_ONLY_STATE_ROOTS:
                continue

            if len(segments) >= 2 and segments[0] == "attributes":
                if op.op == "remove":
                    redacted_ops.append(op)
                    continue
                current_attribute = StateSingleton.getState().attributes.get(segments[1])
                if current_attribute is not None and current_attribute.visibility != "gm_only":
                    redacted_ops.append(op)
                elif op.op == "set":
                    redacted_ops.append(PatchOp(op="remove", path=op.path))
                continue

            if (
                len(segments) >= 4
                and segments[0] == "sheets"
                and segments[2] == "attributes"
            ):
                current_attribute = StateSingleton.getState().attributes.get(segments[3])
                if current_attribute is not None and current_attribute.visibility != "gm_only":
                    redacted_ops.append(op)
                elif op.op == "remove":
                    redacted_ops.append(op)
                elif op.op == "set":
                    redacted_ops.append(PatchOp(op="remove", path=op.path))
                continue

            if (
                len(segments) >= 4
                and segments[0] in {"items", "actions"}
                and segments[2] == "attributes"
            ):
                current_attribute = StateSingleton.getState().attributes.get(segments[3])
                if current_attribute is not None and current_attribute.visibility != "gm_only":
                    redacted_ops.append(op)
                elif op.op == "remove":
                    redacted_ops.append(op)
                elif op.op == "set":
                    redacted_ops.append(PatchOp(op="remove", path=op.path))
                continue

            if len(segments) >= 2 and segments[0] == "active_conditions":
                if op.op == "remove":
                    redacted_ops.append(op)
                    continue
                value = asdict(op.value) if is_dataclass(op.value) else op.value
                visible = (
                    isinstance(value, dict)
                    and value.get("visibility") != "gm_only"
                    and value.get("instance_id") == assigned_instance_id
                )
                if visible:
                    redacted_ops.append(op)
                elif op.op == "set":
                    redacted_ops.append(PatchOp(op="remove", path=op.path))
                continue

            if (
                len(segments) >= 2
                and segments[0] == "standalone_effect_applications"
            ):
                if op.op == "remove":
                    visible_prefix = f"standalone:{assigned_instance_id}:"
                    if segments[1].startswith(visible_prefix):
                        redacted_ops.append(op)
                    continue
                value = asdict(op.value) if is_dataclass(op.value) else op.value
                visible = (
                    isinstance(value, dict)
                    and value.get("instance_id") == assigned_instance_id
                )
                if visible:
                    redacted_ops.append(op)
                elif op.op == "set":
                    redacted_ops.append(PatchOp(op="remove", path=op.path))
                continue

            if len(segments) >= 2 and segments[0] == "condition_presets":
                if op.op == "remove":
                    redacted_ops.append(op)
                    continue
                value = asdict(op.value) if is_dataclass(op.value) else op.value
                visible = not (
                    isinstance(value, dict) and value.get("visibility") == "gm_only"
                )
                if visible:
                    redacted_ops.append(op)
                elif op.op == "set":
                    redacted_ops.append(PatchOp(op="remove", path=op.path))
                continue

            if len(segments) >= 2 and segments[0] == "augmentations":
                if op.op == "remove":
                    redacted_ops.append(op)
                    continue
                current_augmentation = StateSingleton.getState().augmentations.get(
                    segments[1]
                )
                if (
                    current_augmentation is None
                    and segments[1].startswith("condition:")
                ):
                    continue
                if (
                    current_augmentation is not None
                    and current_augmentation.source.type == "condition"
                ):
                    active_condition = StateSingleton.getState().active_conditions.get(
                        current_augmentation.source.application_id
                    )
                    visible = (
                        active_condition is not None
                        and active_condition.visibility != "gm_only"
                        and active_condition.instance_id == assigned_instance_id
                    )
                    if visible:
                        redacted_ops.append(op)
                    elif op.op == "set" and len(segments) == 2:
                        redacted_ops.append(PatchOp(op="remove", path=op.path))
                    continue
                value = asdict(op.value) if is_dataclass(op.value) else op.value
                source = value.get("source") if isinstance(value, dict) else None
                if isinstance(source, dict) and source.get("type") == "condition":
                    active_condition = StateSingleton.getState().active_conditions.get(
                        source.get("application_id")
                    )
                    visible = (
                        active_condition is not None
                        and active_condition.visibility != "gm_only"
                        and active_condition.instance_id == assigned_instance_id
                    )
                    if visible:
                        redacted_ops.append(op)
                    elif op.op == "set":
                        redacted_ops.append(PatchOp(op="remove", path=op.path))
                    continue

            if (
                len(segments) >= 4
                and segments[0] == "instanced_sheets"
                and segments[2] == "augments"
            ):
                if op.op == "remove":
                    if segments[1] == assigned_instance_id:
                        redacted_ops.append(op)
                    continue
                augmentation = StateSingleton.getState().augmentations.get(segments[3])
                if augmentation is not None and augmentation.source.type == "condition":
                    active_condition = StateSingleton.getState().active_conditions.get(
                        augmentation.source.application_id
                    )
                    visible = (
                        active_condition is not None
                        and active_condition.visibility != "gm_only"
                        and active_condition.instance_id == assigned_instance_id
                    )
                    if visible:
                        redacted_ops.append(op)
                    elif op.op == "set":
                        redacted_ops.append(PatchOp(op="remove", path=op.path))
                    continue
            if (
                len(segments) >= 3
                and segments[0] == "sheets"
                and segments[2] in PRIVATE_SHEET_FIELDS | PRIVATE_SHEET_XP_FIELDS
            ):
                continue

            if len(segments) == 2 and segments[0] == "sheets":
                op.value = self._redact_sheet_payload(op.value)

            if (
                len(segments) >= 3
                and segments[0] == "items"
                and segments[2] in PRIVATE_ITEM_FIELDS
            ):
                continue

            if len(segments) >= 2 and segments[0] == "items":
                op.value = self._redact_item_payload(op.value)
            if len(segments) >= 2 and segments[0] == "actions":
                if is_dataclass(op.value):
                    op.value = asdict(op.value)
                if isinstance(op.value, dict):
                    self._redact_subject_attributes(op.value)
            redacted_ops.append(op)

        redacted_patch.ops = redacted_ops
        return redacted_patch

    def _build_snapshot_locked(
        self,
        *,
        role: SessionRole,
        assigned_instance_id: str | None = None,
        request_id: str | None = None,
    ) -> StateSnapshot:
        state_model = StateSingleton.getState()
        state_payload = state_model.to_dict()
        for sheet_id, sheet in state_model.sheets.items():
            sheet_payload = state_payload.get("sheets", {}).get(sheet_id)
            if isinstance(sheet_payload, dict):
                sheet_payload["evaluated_stats"] = evaluate_sheet_stats(sheet)
        for instance_id, instance in state_model.instanced_sheets.items():
            instance_payload = state_payload.get("instanced_sheets", {}).get(instance_id)
            if isinstance(instance_payload, dict):
                template = state_model.sheets.get(instance.parent_id)
                runtime_stat_owner = instance if instance.stats is not None else template
                if runtime_stat_owner is not None:
                    instance_payload["stats"] = asdict(runtime_stat_owner.stats)
                    instance_payload["evaluated_stats"] = evaluate_sheet_stats(
                        runtime_stat_owner
                    )
        state = self._redact_state_for_role(
            state_payload,
            role=role,
            assigned_instance_id=assigned_instance_id,
        )
        state["action_history"] = {
            key: value.model_dump(mode="json")
            for key, value in serialize_action_history(
                state_model.action_history,
                role=role,
                assigned_instance_id=assigned_instance_id,
            ).items()
        }
        return build_state_snapshot(
            state,
            state_version=self._state_version,
            request_id=request_id,
        )

    async def snapshot(
        self,
        *,
        request_id: str | None = None,
        role: SessionRole = "player",
        assigned_instance_id: str | None = None,
    ) -> StateSnapshot:
        async with self._lock:
            return self._build_snapshot_locked(
                role=role,
                assigned_instance_id=assigned_instance_id,
                request_id=request_id,
            )

    async def reset(self) -> None:
        async with self._lock:
            self._state_version = 0
            self._patch_history.clear()
            self._processed_request_ids.clear()
            self._processed_request_id_set.clear()
            self._mutation_audit.clear()
            self._undo_history.clear()

    async def replace_state_and_broadcast_snapshots(
        self,
        state: State,
        *,
        requesting_session: WebSocketSession,
        request_id: str | None = None,
    ) -> None:
        async with self._lock:
            StateSingleton.replaceState(state)
            self._state_version += 1
            self._patch_history.clear()
            self._processed_request_ids.clear()
            self._processed_request_id_set.clear()
            self._mutation_audit.clear()
            self._undo_history.clear()
            sessions = await websocket_sessions.authenticated_sessions()
            snapshots = tuple(
                (
                    session,
                    self._build_snapshot_locked(
                        role=session.role,
                        assigned_instance_id=session.assigned_instance_id,
                        request_id=request_id if session is requesting_session else None,
                    ),
                )
                for session in sessions
            )

        for session, snapshot in snapshots:
            await websocket_sessions.send(session, snapshot)

    async def recent_mutations(self) -> tuple[MutationAuditEntry, ...]:
        async with self._lock:
            return tuple(self._mutation_audit)

    def _remember_processed_request(self, request_id: str) -> None:
        if request_id in self._processed_request_id_set:
            return
        if (
            self._processed_request_ids.maxlen is not None
            and len(self._processed_request_ids) == self._processed_request_ids.maxlen
        ):
            expired_request_id = self._processed_request_ids.popleft()
            self._processed_request_id_set.remove(expired_request_id)
        self._processed_request_ids.append(request_id)
        self._processed_request_id_set.add(request_id)

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

    def _record_mutation(
        self,
        patch: StatePatch,
        *,
        source: RequestSource | None,
    ) -> None:
        ops = patch.ops or []
        entry = MutationAuditEntry(
            state_version=patch.state_version,
            request_id=patch.request_id,
            source=source,
            operations=tuple(op.op for op in ops),
            paths=tuple(op.path for op in ops),
        )
        self._mutation_audit.append(entry)
        logger.debug(
            "Applied state mutation version=%s request_id=%s request_type=%s "
            "actor_role=%s paths=%s",
            entry.state_version,
            entry.request_id,
            source.request_type if source is not None else "internal",
            source.actor_role if source is not None else "internal",
            entry.paths,
        )

    async def replay_since(
        self,
        last_seen_version: int,
        *,
        role: SessionRole = "player",
        assigned_instance_id: str | None = None,
    ) -> list[StatePatch] | None:
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
                self._redact_patch_for_role(
                    patch,
                    role=role,
                    assigned_instance_id=assigned_instance_id,
                )
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

    def _resolve_value(self, root: Any, path: str) -> Any:
        try:
            container, leaf = self._resolve_container(root, path)
        except ValueError:
            return _MISSING

        if isinstance(container, dict):
            return (
                self._clone_value(container[leaf])
                if leaf in container
                else _MISSING
            )
        if isinstance(container, list):
            try:
                return self._clone_value(container[self._list_index(leaf)])
            except (IndexError, ValueError):
                return _MISSING
        if hasattr(container, leaf):
            return self._clone_value(getattr(container, leaf))
        return _MISSING

    def _build_inverse_ops(
        self,
        previous_state: State,
        ops: list[PatchOp],
    ) -> list[PatchOp]:
        inverse_ops: list[PatchOp] = []
        for op in reversed(ops):
            if op.op == "add":
                inverse_ops.append(PatchOp(op="remove", path=op.path))
                continue
            if op.op == "remove":
                previous_value = self._resolve_value(previous_state, op.path)
                if previous_value is _MISSING:
                    raise ValueError(f"Cannot undo remove for missing path {op.path}.")
                inverse_ops.append(PatchOp(op="add", path=op.path, value=previous_value))
                continue
            if op.op == "set":
                previous_value = self._resolve_value(previous_state, op.path)
                inverse_ops.append(
                    PatchOp(op="remove", path=op.path)
                    if previous_value is _MISSING
                    else PatchOp(op="set", path=op.path, value=previous_value)
                )
                continue
            if op.op == "inc":
                if not isinstance(op.value, int | float):
                    raise ValueError(f"Cannot undo non-numeric increment at {op.path}.")
                inverse_ops.append(PatchOp(op="inc", path=op.path, value=-op.value))
                continue
            raise ValueError(f"Cannot undo unsupported operation {op.op}.")
        return inverse_ops

    def _apply_patch_op(self, state: State, op: PatchOp) -> PatchOp:
        if op.op == "add":
            return self.add_mutation(state, op.path, op.value)
        if op.op == "set":
            return self.set_mutation(state, op.path, op.value)
        if op.op == "remove":
            _, applied = self.remove_mutation(state, op.path)
            return applied
        if op.op == "inc":
            if not isinstance(op.value, int | float):
                raise ValueError(f"State path {op.path} increment is not numeric.")
            return self.increment_mutation(state, op.path, op.value)
        raise ValueError(f"Unsupported patch operation {op.op}.")

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

    def _synchronize_sheet_attribute_projections(
        self,
        state: State,
        operations: list[PatchOp],
    ) -> list[PatchOp]:
        affected_sheet_ids: set[str] = set()
        affected_instance_ids: set[str] = set()
        for operation in operations:
            segments = self._parse_path(operation.path)
            if (
                len(segments) >= 3
                and segments[0] == "sheets"
                and segments[2] == "stats"
            ):
                affected_sheet_ids.add(segments[1])
            if (
                len(segments) >= 3
                and segments[0] == "instanced_sheets"
                and segments[2] == "stats"
            ):
                affected_instance_ids.add(segments[1])
        if not affected_sheet_ids and not affected_instance_ids:
            return []

        from backend.features.attributes.service import (
            reevaluate_instance_attributes_mutations,
            reevaluate_sheet_attributes_mutations,
        )

        attribute_operations: list[PatchOp] = []
        for sheet_id in sorted(affected_sheet_ids):
            if sheet_id in state.sheets:
                attribute_operations.extend(
                    reevaluate_sheet_attributes_mutations(state, sheet_id)
                )
        for instance_id in sorted(affected_instance_ids):
            if instance_id in state.instanced_sheets:
                attribute_operations.extend(
                    reevaluate_instance_attributes_mutations(state, instance_id)
                )
        return attribute_operations

    def _stat_projection_operations(
        self,
        state: State,
        operations: list[PatchOp],
    ) -> list[PatchOp]:
        affected_sheet_ids: set[str] = set()
        affected_instance_ids: set[str] = set()
        for operation in operations:
            segments = self._parse_path(operation.path)
            if len(segments) < 2:
                continue
            if segments[0] == "sheets" and (len(segments) == 2 or (
                len(segments) >= 3 and segments[2] in {"stats", "attributes"}
            )):
                affected_sheet_ids.add(segments[1])
            if segments[0] == "instanced_sheets" and (
                len(segments) == 2 or (
                    len(segments) >= 3 and segments[2] in {"stats", "attributes"}
                )
            ):
                affected_instance_ids.add(segments[1])

        sheet_operations = [
            PatchOp(
                op="set",
                path=self.join_path("sheets", sheet_id, "evaluated_stats"),
                value=evaluate_sheet_stats(state.sheets[sheet_id]),
            )
            for sheet_id in sorted(affected_sheet_ids)
            if sheet_id in state.sheets
        ]
        instance_operations = [
            PatchOp(
                op="set",
                path=self.join_path(
                    "instanced_sheets", instance_id, "evaluated_stats"
                ),
                value=evaluate_sheet_stats(state.instanced_sheets[instance_id]),
            )
            for instance_id in sorted(affected_instance_ids)
            if instance_id in state.instanced_sheets
            and state.instanced_sheets[instance_id].stats is not None
        ]
        return [*sheet_operations, *instance_operations]

    async def apply_mutation(
        self,
        mutation: Callable[[State], tuple[MutationResultT, list[PatchOp]]],
        *,
        request_id: str | None = None,
    ) -> MutationResultT:
        async with self._lock:
            if request_id is not None and request_id in self._processed_request_id_set:
                raise DuplicateRequestError(
                    f"Duplicate request '{request_id}' was ignored; its state mutation "
                    "was already processed."
                )

            state = StateSingleton.getState()
            previous_state = deepcopy(state)
            try:
                result, ops = mutation(state)
                from backend.features.augmentations.service import (
                    synchronize_equipment_augmentations_mutation,
                )

                ops.extend(synchronize_equipment_augmentations_mutation(state))
                ops.extend(self._synchronize_sheet_attribute_projections(state, ops))
            except Exception:
                for state_field in fields(state):
                    setattr(
                        state,
                        state_field.name,
                        deepcopy(getattr(previous_state, state_field.name)),
                    )
                raise
            if ops:
                inverse_ops = self._build_inverse_ops(previous_state, ops)
                if inverse_ops:
                    self._undo_history.append(inverse_ops)
                patch_ops = [*ops, *self._stat_projection_operations(state, ops)]
                StateSingleton.dumpState()
                patch = self._next_patch(patch_ops, request_id=request_id)
                self._record_mutation(patch, source=current_request_source())
                if request_id is not None:
                    self._remember_processed_request(request_id)
                await websocket_sessions.broadcast_per_session(
                    lambda session: self._redact_patch_for_role(
                        patch,
                        role=session.role,
                        assigned_instance_id=session.assigned_instance_id,
                    )
                )
            elif request_id is not None:
                self._remember_processed_request(request_id)
            return result

    async def apply_audit_mutation(
        self,
        mutation: Callable[[State], tuple[MutationResultT, list[PatchOp]]],
    ) -> MutationResultT:
        """Persist and broadcast audit state without creating an undo entry."""
        async with self._lock:
            state = StateSingleton.getState()
            previous_state = deepcopy(state)
            try:
                result, ops = mutation(state)
            except Exception:
                for state_field in fields(state):
                    setattr(
                        state,
                        state_field.name,
                        deepcopy(getattr(previous_state, state_field.name)),
                    )
                raise

            if not ops:
                return result

            StateSingleton.dumpState()
            patch = self._next_patch(ops)
            self._record_mutation(patch, source=current_request_source())
            await websocket_sessions.broadcast_per_session(
                lambda session: self._redact_patch_for_role(
                    patch,
                    role=session.role,
                    assigned_instance_id=session.assigned_instance_id,
                )
            )
            return result

    async def undo_last_change(self, *, request_id: str | None = None) -> bool:
        async with self._lock:
            if not self._undo_history:
                return False

            state = StateSingleton.getState()
            inverse_ops = self._undo_history.pop()
            applied_ops = [self._apply_patch_op(state, op) for op in inverse_ops]
            applied_ops.extend(
                self._synchronize_sheet_attribute_projections(state, applied_ops)
            )
            patch_ops = [
                *applied_ops,
                *self._stat_projection_operations(state, applied_ops),
            ]
            StateSingleton.dumpState()
            patch = self._next_patch(patch_ops, request_id=request_id)
            self._record_mutation(patch, source=current_request_source())
            if request_id is not None:
                self._remember_processed_request(request_id)
            await websocket_sessions.broadcast_per_session(
                lambda session: self._redact_patch_for_role(
                    patch,
                    role=session.role,
                    assigned_instance_id=session.assigned_instance_id,
                )
            )
            return True

    async def apply_private_mutation(
        self,
        mutation: Callable[[State], MutationResultT],
    ) -> MutationResultT:
        async with self._lock:
            state = StateSingleton.getState()
            result = mutation(state)
            StateSingleton.dumpState()
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
