from __future__ import annotations

import asyncio
import json
from pathlib import Path

from backend.dev.dm_examples import (
    CONDITION_IDS,
    ENEMY_TEMPLATE_IDS,
    FORMULA_IDS,
)
from backend.dev.seed import SEED_ACCESS_CODES, seed_state
from backend.state import store as store_module
from backend.state.models.action import FormulaReference
from backend.state.models.state import State


def test_seed_state_is_complete_reloadable_and_deterministic(tmp_path: Path) -> None:
    target = tmp_path / "state.json"
    store_module._write_checkpoint(target, State())

    first_state = asyncio.run(seed_state(target))
    first_document = json.loads(target.read_text(encoding="utf-8"))
    original_backup = store_module._load_checkpoint(target.with_name("state.json.bak"))

    assert original_backup is not None
    assert original_backup.sheets == {}
    assert set(FORMULA_IDS).issubset(first_state.formulas)
    assert set(SEED_ACCESS_CODES) == set(first_state.sheet_access_codes)
    assert all(
        first_state.sheets[sheet_id].dm_only for sheet_id in ENEMY_TEMPLATE_IDS
    )
    assert set(CONDITION_IDS).issubset(first_state.condition_presets)
    assert first_state.active_conditions == {}
    assert first_state.condition_presets["hidden_gate_mark"].visibility == "gm_only"
    example_1 = first_state.sheets["dm_examples_sheet"]
    example_2 = first_state.sheets["starter_shadowblade_template"]
    assert example_1.name == "Example Player 1"
    assert example_1.xp_cap == 100
    assert sum(
        record.xp_per_participant
        for record in first_state.kill_registry.values()
        if any(participant.instance_id == "dm_examples_instance" for participant in record.participants)
    ) == 75
    assert example_2.name == "Example Player 2"
    assert example_2.xp_cap == 60
    assert sum(
        record.xp_per_participant
        for record in first_state.kill_registry.values()
        if any(participant.instance_id == "starter_shadowblade_instance" for participant in record.participants)
    ) == 60
    effect_types = {
        template.effect.type
        for condition in first_state.condition_presets.values()
        for template in condition.augmentation_templates
    }
    assert effect_types == {
        "formula_modifier",
        "evaluation_formula_modifier",
        "roll_mode_modifier",
    }

    flames = first_state.actions["flames_of_life"]
    assert isinstance(flames.steps[0].amount, FormulaReference)
    assert flames.steps[0].amount.formula_id == "flames_of_life_mana_cost"

    second_state = asyncio.run(seed_state(target))
    second_document = json.loads(target.read_text(encoding="utf-8"))

    assert second_state.to_dict(include_private=True) == first_state.to_dict(
        include_private=True
    )
    assert second_document["state"] == first_document["state"]
    assert store_module._load_checkpoint(target) is not None
