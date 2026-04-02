from __future__ import annotations

import ast
from typing import Any
from uuid import uuid4

from backend.features.chat import service as chat_service
from backend.features.chat.schema import Roll20ChatMessage
from backend.features.sheet_runtime.schema import ActionExecuted, PerformAction
from backend.features.state_sync.service import state_sync_service
from backend.state.models.action import Action, SendMessageStep, SetValueStep
from backend.state.models.sheet import Sheet
from backend.state.models.state import State
from backend.state.store import StateSingleton

_ALLOWED_BINARY_OPERATORS = {
    ast.Add: lambda left, right: left + right,
    ast.Sub: lambda left, right: left - right,
    ast.Mult: lambda left, right: left * right,
    ast.Div: lambda left, right: left / right,
    ast.FloorDiv: lambda left, right: left // right,
    ast.Mod: lambda left, right: left % right,
    ast.Pow: lambda left, right: left**right,
}
_ALLOWED_UNARY_OPERATORS = {
    ast.UAdd: lambda value: value,
    ast.USub: lambda value: -value,
}


def _numeric_result(value: float | int) -> float | int:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def _evaluate_math_node(node: ast.AST) -> float | int:
    if isinstance(node, ast.Expression):
        return _evaluate_math_node(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, int | float):
        return node.value
    if isinstance(node, ast.BinOp):
        operator_type = type(node.op)
        operator = _ALLOWED_BINARY_OPERATORS.get(operator_type)
        if operator is None:
            raise ValueError(f"Unsupported formula operator: {operator_type.__name__}")
        return operator(
            _evaluate_math_node(node.left),
            _evaluate_math_node(node.right),
        )
    if isinstance(node, ast.UnaryOp):
        operator_type = type(node.op)
        operator = _ALLOWED_UNARY_OPERATORS.get(operator_type)
        if operator is None:
            raise ValueError(f"Unsupported formula operator: {operator_type.__name__}")
        return operator(_evaluate_math_node(node.operand))
    raise ValueError(f"Unsupported formula expression: {node.__class__.__name__}")


def _state() -> State:
    return StateSingleton.getState()


def get_sheet(sheet_id: str, state: State | None = None) -> Sheet:
    current_state = _state() if state is None else state
    sheet = current_state.sheets.get(sheet_id)
    if sheet is None:
        raise ValueError(f"Sheet '{sheet_id}' does not exist.")
    return sheet


def _resolve_value_container(root: Any, path: list[str]) -> tuple[Any, str]:
    if not path:
        raise ValueError("Mutation path must not be empty.")

    current = root
    for idx, branch in enumerate(path[:-1]):
        if isinstance(current, dict):
            if branch not in current:
                raise ValueError(
                    f"Mutation branch '{branch}' which is idx {idx} does not exist."
                )
            current = current[branch]
            continue

        current = getattr(current, branch, None)
        if current is None:
            raise ValueError(
                f"Mutation branch '{branch}' which is idx {idx} does not exist."
            )

    return current, path[-1]


def _apply_set_value(
    root: dict[str, Any],
    path: list[str],
    value: float | int,
) -> None:
    container, leaf = _resolve_value_container(root, path)
    if isinstance(container, dict):
        container[leaf] = value
        return
    if not hasattr(container, leaf):
        raise ValueError(f"Mutation branch '{leaf}' does not exist.")
    setattr(container, leaf, value)


def _resolve_action(
    sheet: Sheet,
    action_id: str,
    *,
    state: State | None = None,
) -> Action:
    current_state = _state() if state is None else state
    action = current_state.actions.get(action_id)
    if action is None:
        raise ValueError(f"Action '{action_id}' does not exist.")

    sheet_action_bridges = sheet.actions
    if sheet_action_bridges:
        for bridge in sheet_action_bridges.values():
            if bridge.entry_id == action_id:
                return action
        raise ValueError(f"Sheet '{sheet.id}' does not reference action '{action_id}'.")

    return action


async def perform_action(request: PerformAction) -> ActionExecuted:
    sheet = get_sheet(request.sheet_id)
    action = _resolve_action(sheet, request.action_id)
    steps = action.steps

    if any(isinstance(step, SendMessageStep) for step in steps):
        if not await chat_service.roll20_chat_bridge.is_connected():
            raise ValueError("Roll20 chat bridge is not connected.")

    def mutation(state: State) -> tuple[tuple[list[str], list[str]], list[Any]]:
        current_sheet = get_sheet(request.sheet_id, state=state)
        current_action = _resolve_action(current_sheet, request.action_id, state=state)
        current_steps = current_action.steps

        applied_mutations: list[str] = []
        emitted_messages: list[str] = []
        ops: list[Any] = []

        for step in current_steps:
            if isinstance(step, SendMessageStep):
                message = step.message.expand_formula(current_sheet)
                emitted_messages.append(message)
                continue

            if isinstance(step, SetValueStep):
                if step.target != "caster":
                    raise ValueError(
                        f"Unsupported runtime action target '{step.target}'."
                    )
                expanded_formula = step.value.expand_formula(current_sheet)
                parsed = ast.parse(expanded_formula, mode="eval")
                result = _numeric_result(_evaluate_math_node(parsed))
                path = state_sync_service.join_path(
                    "sheets", request.sheet_id, *step.path
                )
                op = state_sync_service.set_mutation(state, path, result)
                ops.append(op)
                applied_mutations.append(".".join(step.path) + f"={result}")
                continue

            raise ValueError(
                f"Unsupported runtime action step '{step.__class__.__name__}'."
            )

        return (applied_mutations, emitted_messages), ops

    applied_mutations, emitted_messages = await state_sync_service.apply_mutation(
        mutation,
        request_id=request.request_id,
    )

    for message in emitted_messages:
        await chat_service.roll20_chat_bridge.send(
            Roll20ChatMessage(
                message_id=str(uuid4()),
                message=message,
                request_id=request.request_id,
            )
        )

    return ActionExecuted(
        response_id=None,
        sheet_id=request.sheet_id,
        action_id=request.action_id,
        applied_mutations=applied_mutations,
        emitted_messages=emitted_messages,
        request_id=request.request_id,
    )
