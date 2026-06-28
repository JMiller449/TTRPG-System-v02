import re

import pytest

from backend.core.permissions import (
    can_role,
    permission_allowed_roles,
    permission_denied_reason,
    permission_minimum_role,
)
from backend.core.request_registry import request_registry
from backend.features.session.models import SessionRole, WebSocketSession


EXPECTED_ROUTE_MINIMUM_ROLES = {
    "adjust_instanced_sheet_resource": "player",
    "apply_instanced_sheet_damage": "player",
    "authenticate": "unauthenticated",
    "claim_sheet_access_code": "player",
    "create_action": "dm",
    "create_condition_preset": "dm",
    "create_formula": "dm",
    "create_instanced_sheet": "dm",
    "create_item": "dm",
    "create_proficiency": "dm",
    "create_sheet": "dm",
    "create_sheet_action_bridge": "dm",
    "create_sheet_item_bridge": "dm",
    "create_sheet_proficiency_bridge": "dm",
    "delete_action": "dm",
    "delete_condition_preset": "dm",
    "delete_encounter_preset": "dm",
    "delete_formula": "dm",
    "delete_item": "dm",
    "delete_proficiency": "dm",
    "delete_sheet": "dm",
    "delete_sheet_action_bridge": "dm",
    "delete_sheet_item_bridge": "dm",
    "delete_sheet_proficiency_bridge": "dm",
    "export_state_backup": "dm",
    "generate_sheet_access_code": "dm",
    "get_action_formula_authoring_metadata": "player",
    "get_augmentation_target_metadata": "player",
    "get_roll20_bridge_status": "player",
    "get_sheet_access_codes": "dm",
    "get_variable_registry": "player",
    "get_xp_tracker": "player",
    "import_state_backup": "dm",
    "perform_action": "player",
    "remove_item_augmentation_template": "dm",
    "resync_state": "player",
    "save_encounter_preset": "dm",
    "send_roll20_chat_message": "player",
    "set_instanced_sheet_notes": "player",
    "set_instanced_sheet_resource": "player",
    "set_sheet_base_stat": "dm",
    "set_sheet_formula_stat": "dm",
    "set_sheet_notes": "dm",
    "set_sheet_mob_kill_count": "player",
    "set_sheet_xp_required": "dm",
    "set_mob_xp_value": "dm",
    "set_sheet_slayed_count": "player",
    "spawn_encounter_preset": "dm",
    "undo_last_state_change": "dm",
    "update_action": "dm",
    "update_condition_preset": "dm",
    "update_formula": "dm",
    "update_item": "dm",
    "update_proficiency": "dm",
    "update_sheet": "dm",
    "update_sheet_action_bridge": "dm",
    "update_sheet_item_bridge": "dm",
    "update_sheet_proficiency_bridge": "dm",
    "upsert_item_augmentation_template": "dm",
}

EXPECTED_CUSTOM_DENIAL_REASONS = {
    "adjust_instanced_sheet_resource": "Authenticate first to edit current resources.",
    "apply_instanced_sheet_damage": "Authenticate first to edit current resources.",
    "claim_sheet_access_code": "Authenticate first to claim a sheet access code.",
    "create_item": "Only a DM can edit equipment.",
    "create_proficiency": "Only a DM can edit proficiencies.",
    "create_sheet_item_bridge": "Only a DM can edit equipment.",
    "create_sheet_proficiency_bridge": "Only a DM can edit proficiencies.",
    "delete_item": "Only a DM can edit equipment.",
    "delete_proficiency": "Only a DM can edit proficiencies.",
    "delete_sheet_item_bridge": "Only a DM can edit equipment.",
    "delete_sheet_proficiency_bridge": "Only a DM can edit proficiencies.",
    "perform_action": "Authenticate first to execute actions.",
    "remove_item_augmentation_template": "Only a DM can edit equipment.",
    "set_instanced_sheet_notes": "Authenticate first to edit instance notes.",
    "set_instanced_sheet_resource": "Authenticate first to edit current resources.",
    "set_sheet_base_stat": "Only a DM can edit sheet stats.",
    "set_sheet_formula_stat": "Only a DM can edit sheet stats.",
    "set_sheet_notes": "Only a DM can edit backend notes.",
    "undo_last_state_change": "Only a DM can undo state changes.",
    "update_item": "Only a DM can edit equipment.",
    "update_proficiency": "Only a DM can edit proficiencies.",
    "update_sheet_item_bridge": "Only a DM can edit equipment.",
    "update_sheet_proficiency_bridge": "Only a DM can edit proficiencies.",
    "upsert_item_augmentation_template": "Only a DM can edit equipment.",
}


def _session(role: SessionRole) -> WebSocketSession:
    return WebSocketSession(websocket=object(), role=role)  # type: ignore[arg-type]


def test_permission_policy_defines_edit_and_execution_roles() -> None:
    assert permission_allowed_roles("notes_edit") == ("dm",)
    assert permission_allowed_roles("instance_notes_edit") == ("player", "dm")
    assert permission_allowed_roles("equipment_edit") == ("dm",)
    assert permission_allowed_roles("proficiency_edit") == ("dm",)
    assert permission_allowed_roles("stat_edit") == ("dm",)
    assert permission_allowed_roles("resource_edit") == ("player", "dm")
    assert permission_allowed_roles("action_execute") == ("player", "dm")

    assert permission_minimum_role("notes_edit") == "dm"
    assert permission_minimum_role("instance_notes_edit") == "player"
    assert permission_minimum_role("equipment_edit") == "dm"
    assert permission_minimum_role("proficiency_edit") == "dm"
    assert permission_minimum_role("stat_edit") == "dm"
    assert permission_minimum_role("resource_edit") == "player"
    assert permission_minimum_role("action_execute") == "player"


def test_permission_policy_rejects_unauthenticated_and_disallowed_roles() -> None:
    assert not can_role("unauthenticated", "action_execute")
    assert not can_role("unauthenticated", "resource_edit")
    assert not can_role("player", "stat_edit")
    assert not can_role("player", "equipment_edit")
    assert not can_role("player", "proficiency_edit")
    assert not can_role("player", "notes_edit")

    assert can_role("player", "action_execute")
    assert can_role("player", "resource_edit")
    assert can_role("player", "instance_notes_edit")
    assert can_role("dm", "notes_edit")
    assert can_role("dm", "instance_notes_edit")
    assert can_role("dm", "equipment_edit")
    assert can_role("dm", "proficiency_edit")
    assert can_role("dm", "stat_edit")
    assert can_role("dm", "resource_edit")
    assert can_role("dm", "action_execute")


def test_permission_policy_exposes_specific_denial_reasons() -> None:
    assert permission_denied_reason("notes_edit") == "Only a DM can edit backend notes."
    assert (
        permission_denied_reason("instance_notes_edit")
        == "Authenticate first to edit instance notes."
    )
    assert permission_denied_reason("equipment_edit") == "Only a DM can edit equipment."
    assert (
        permission_denied_reason("proficiency_edit")
        == "Only a DM can edit proficiencies."
    )
    assert permission_denied_reason("stat_edit") == "Only a DM can edit sheet stats."
    assert (
        permission_denied_reason("resource_edit")
        == "Authenticate first to edit current resources."
    )
    assert (
        permission_denied_reason("action_execute")
        == "Authenticate first to execute actions."
    )


def test_registered_routes_have_explicit_role_classification() -> None:
    actual_roles = {
        route.type_name: route.minimum_role for route in request_registry.routes()
    }

    assert actual_roles == EXPECTED_ROUTE_MINIMUM_ROLES


def test_registered_routes_expose_expected_custom_denial_reasons() -> None:
    actual_denial_reasons = {
        route.type_name: route.permission_denied_reason
        for route in request_registry.routes()
        if route.permission_denied_reason is not None
    }

    assert actual_denial_reasons == EXPECTED_CUSTOM_DENIAL_REASONS


@pytest.mark.parametrize(
    ("minimum_role", "allowed_roles", "denied_roles"),
    [
        ("unauthenticated", ("unauthenticated", "player", "dm"), ()),
        ("player", ("player", "dm"), ("unauthenticated",)),
        ("dm", ("dm",), ("unauthenticated", "player")),
    ],
)
def test_registered_route_authorization_matches_declared_role(
    minimum_role: SessionRole,
    allowed_roles: tuple[SessionRole, ...],
    denied_roles: tuple[SessionRole, ...],
) -> None:
    routes = [
        route
        for route in request_registry.routes()
        if route.minimum_role == minimum_role
    ]

    assert routes

    for route in routes:
        for role in allowed_roles:
            route.authorize(_session(role))

        for role in denied_roles:
            with pytest.raises(
                PermissionError,
                match=re.escape(route._permission_denied_reason()),
            ):
                route.authorize(_session(role))
