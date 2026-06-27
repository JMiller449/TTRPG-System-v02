from backend.core.request_context import (
    build_request_source,
    current_request_source,
    request_source_context,
)
from backend.features.sheet_admin.actions.schema import CreateAction
from backend.features.sheet_runtime.schema import PerformAction


def test_request_source_extracts_direct_runtime_entity_ids() -> None:
    source = build_request_source(
        PerformAction(
            type="perform_action",
            request_id="request-1",
            sheet_id="instance-1",
            action_id="attack",
            target_sheet_id="enemy-1",
        ),
        actor_role="player",
    )

    assert source.request_id == "request-1"
    assert source.request_type == "perform_action"
    assert source.actor_role == "player"
    assert dict(source.entity_ids) == {
        "action_id": "attack",
        "sheet_id": "instance-1",
        "target_sheet_id": "enemy-1",
    }


def test_request_source_extracts_nested_authored_entity_id() -> None:
    source = build_request_source(
        CreateAction(
            type="create_action",
            request_id="request-2",
            action={
                "id": "battle_cry",
                "name": "Battle Cry",
                "steps": [],
            },
        ),
        actor_role="dm",
    )

    assert source.entity_id("action_id") == "battle_cry"


def test_request_source_context_restores_previous_task_context() -> None:
    source = build_request_source(
        PerformAction(
            type="perform_action",
            request_id="request-3",
            sheet_id="instance-1",
            action_id="attack",
        ),
        actor_role="dm",
    )

    assert current_request_source() is None
    with request_source_context(source):
        assert current_request_source() == source
    assert current_request_source() is None
