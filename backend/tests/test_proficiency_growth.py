from types import SimpleNamespace

from backend.features.proficiency_growth.service import (
    effective_growth_rate,
    growth_points_after_uses,
)
from backend.state.models.augmentation import (
    AugmentationSource,
    AugmentationTarget,
    FormulaModifierSelector,
    ProficiencyGrowthModifierEffect,
    StandaloneEffectApplication,
    StandaloneEffectDefinition,
)
from backend.state.models.formula import Formula
from backend.state.models.proficiency import Proficiency, ProficiencyBridge
from backend.state.models.state import State


def _growth_state() -> tuple[State, ProficiencyBridge]:
    state = State()
    state.sheets["hero"] = SimpleNamespace(items={})
    state.instanced_sheets["hero-1"] = SimpleNamespace(parent_id="hero", items={})
    state.proficiencies["longsword"] = Proficiency(
        id="longsword",
        name="Longsword",
        description="",
        default_growth_rate=0.01,
        tags=["weapon", "sword"],
    )
    bridge = ProficiencyBridge(
        relationship_id="longsword-bridge",
        prof_id="longsword",
        use_count=10,
        growth_rate=0.01,
        growth_points=0.1,
    )
    return state, bridge


def _apply_growth_effect(
    state: State,
    *,
    effect_id: str,
    operation: str,
    value: str,
    required_tags: list[str],
    excluded_tags: list[str] | None = None,
) -> None:
    state.standalone_effects[effect_id] = StandaloneEffectDefinition(
        id=effect_id,
        name=effect_id,
        scope="instance",
        target=AugmentationTarget(root="instance", path=["proficiencies"]),
        effect=ProficiencyGrowthModifierEffect(
            operation=operation,  # type: ignore[arg-type]
            value=Formula(aliases=None, text=value),
            selector=FormulaModifierSelector(
                required_tags=required_tags,
                excluded_tags=excluded_tags or [],
            ),
        ),
    )
    state.standalone_effect_applications[effect_id] = StandaloneEffectApplication(
        application_id=effect_id,
        definition_id=effect_id,
        instance_id="hero-1",
        source=AugmentationSource(type="manual", id=effect_id),
    )


def test_matching_growth_effect_changes_only_points_awarded_during_use() -> None:
    state, bridge = _growth_state()
    _apply_growth_effect(
        state,
        effect_id="accelerated_training",
        operation="multiply",
        value="2",
        required_tags=["weapon"],
    )

    assert effective_growth_rate(
        state,
        sheet_id="hero",
        instance_id="hero-1",
        bridge=bridge,
    ) == 0.02
    assert growth_points_after_uses(
        state,
        sheet_id="hero",
        instance_id="hero-1",
        bridge=bridge,
        quantity=3,
    ) == 0.16
    assert bridge.progress == 0.1

    state.standalone_effect_applications["accelerated_training"].active = False
    assert effective_growth_rate(
        state,
        sheet_id="hero",
        instance_id="hero-1",
        bridge=bridge,
    ) == 0.01


def test_growth_effect_requires_all_tags_and_honors_exclusions() -> None:
    state, bridge = _growth_state()
    _apply_growth_effect(
        state,
        effect_id="arcane_training",
        operation="multiply",
        value="10",
        required_tags=["weapon", "magical"],
    )
    _apply_growth_effect(
        state,
        effect_id="not_swords",
        operation="add",
        value="1",
        required_tags=["weapon"],
        excluded_tags=["sword"],
    )

    assert effective_growth_rate(
        state,
        sheet_id="hero",
        instance_id="hero-1",
        bridge=bridge,
    ) == 0.01


def test_growth_points_remain_capped_at_mastery() -> None:
    state, bridge = _growth_state()
    bridge.growth_points = 0.99
    _apply_growth_effect(
        state,
        effect_id="fast_training",
        operation="multiply",
        value="5",
        required_tags=["weapon"],
    )

    assert growth_points_after_uses(
        state,
        sheet_id="hero",
        instance_id="hero-1",
        bridge=bridge,
        quantity=1,
    ) == 1.0
