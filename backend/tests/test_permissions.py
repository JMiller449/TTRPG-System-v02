from backend.core.permissions import (
    can_role,
    permission_allowed_roles,
    permission_denied_reason,
    permission_minimum_role,
)


def test_permission_policy_defines_edit_and_execution_roles() -> None:
    assert permission_allowed_roles("notes_edit") == ("dm",)
    assert permission_allowed_roles("equipment_edit") == ("dm",)
    assert permission_allowed_roles("proficiency_edit") == ("dm",)
    assert permission_allowed_roles("stat_edit") == ("dm",)
    assert permission_allowed_roles("resource_edit") == ("player", "dm")
    assert permission_allowed_roles("action_execute") == ("player", "dm")

    assert permission_minimum_role("notes_edit") == "dm"
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
    assert can_role("dm", "notes_edit")
    assert can_role("dm", "equipment_edit")
    assert can_role("dm", "proficiency_edit")
    assert can_role("dm", "stat_edit")
    assert can_role("dm", "resource_edit")
    assert can_role("dm", "action_execute")


def test_permission_policy_exposes_specific_denial_reasons() -> None:
    assert permission_denied_reason("notes_edit") == "Only a DM can edit backend notes."
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
