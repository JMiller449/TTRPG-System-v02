from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
import re
from typing import Any, List, Optional, TYPE_CHECKING

from backend.state.models.proficiency import ProficiencyBridge

if TYPE_CHECKING:
    from backend.state.models.sheet import InstancedSheet, Sheet


def normalize_formula_tags(tags: Iterable[str] | None) -> list[str]:
    normalized_tags: list[str] = []
    seen: set[str] = set()
    for tag in tags or []:
        if not isinstance(tag, str):
            raise ValueError("Formula tags must be strings.")
        normalized = " ".join(tag.split()).casefold()
        if not normalized:
            raise ValueError("Formula tags must not be empty.")
        if normalized in seen:
            continue
        seen.add(normalized)
        normalized_tags.append(normalized)
    return normalized_tags


@dataclass
class FormulaAliases:
    name: str
    path: List[str]

    @classmethod
    def from_dict(cls, raw: dict) -> "FormulaAliases":
        return cls(
            name=raw["name"],
            path=list(raw["path"]),
        )


@dataclass
class Formula:
    aliases: Optional[List[FormulaAliases]]
    """Aliases resolved relative to the provided root object."""
    text: str
    """Formula text using @alias placeholders, for example '@strength * 2'."""
    tags: list[str] = field(default_factory=list)
    """Normalized semantic labels used for evaluation-time modifier matching."""

    def __post_init__(self) -> None:
        self.tags = normalize_formula_tags(self.tags)

    @classmethod
    def from_dict(cls, raw: dict) -> "Formula":
        aliases = raw.get("aliases")
        return cls(
            aliases=None
            if aliases is None
            else [FormulaAliases.from_dict(alias) for alias in aliases],
            text=raw["text"],
            tags=normalize_formula_tags(raw.get("tags")),
        )

    def _resolve_path_value(
        self, root: Sheet | InstancedSheet, var_name: str, var_path: List[str]
    ) -> Any:
        current_var: Any = root
        for idx, branch in enumerate(var_path):
            if isinstance(current_var, dict):
                if branch not in current_var:
                    raise ValueError(
                        f"Branch '{branch}' which is idx {idx} on variable '{var_name}' does not exist"
                    )
                current_var = current_var[branch]
                continue

            current_var = getattr(current_var, branch, None)
            if current_var is None:
                raise ValueError(
                    f"Branch '{branch}' which is idx {idx} on variable '{var_name}' does not exist"
                )
        return current_var

    def expand_variable(
        self,
        root: Sheet | InstancedSheet,
        var_name: str,
        var_path: List[str],
        *,
        seen_formula_ids: set[int] | None = None,
    ) -> str:
        current_var = self._resolve_path_value(root, var_name, var_path)

        if isinstance(current_var, Formula):
            nested_formula = current_var
            if getattr(root, "stats", None) is not None:
                aliases = current_var.aliases
                if aliases is None:
                    aliases = [
                        FormulaAliases(name=name, path=["stats", name])
                        for name in sorted(
                            set(re.findall(r"@([A-Za-z_][A-Za-z0-9_]*)", current_var.text))
                        )
                        if hasattr(root.stats, name)
                    ]
                normalized_aliases = [
                        FormulaAliases(
                            name=alias.name,
                            path=(
                                ["stats", alias.path[0]]
                                if len(alias.path) == 1 and hasattr(root.stats, alias.path[0])
                                else list(alias.path)
                            ),
                        )
                        for alias in aliases
                    ]
                if aliases is not current_var.aliases or any(
                    normalized.path != original.path
                    for normalized, original in zip(
                        normalized_aliases, current_var.aliases or [], strict=False
                    )
                ):
                    nested_formula = Formula(
                        aliases=normalized_aliases,
                        text=current_var.text,
                        tags=list(current_var.tags),
                    )
            expanded = nested_formula.expand_formula(
                root,
                seen_formula_ids=seen_formula_ids,
            )
            if len(var_path) == 2 and var_path[0] == "stats":
                bonuses = getattr(root, "stat_bonuses", {})
                bonus = bonuses.get(var_path[1], 0)
                if bonus:
                    return f"({expanded}) + ({bonus})"
            return expanded
        elif isinstance(current_var, int | float):
            return str(current_var)
        elif isinstance(current_var, ProficiencyBridge):
            # TODO: add this proficiency to the the list of proficiencies that need to be upped at the end of this transaction
            prof_calc = current_var.growth_rate * current_var.use_count
            prof = min(prof_calc, 1)
            return str(prof)
        else:
            raise ValueError(
                "Given invalid value which maps to type "
                + current_var.__class__.__name__
                + f" at path {var_path}"
            )

    def expand_formula(
        self,
        root: Sheet | InstancedSheet,
        *,
        seen_formula_ids: set[int] | None = None,
    ) -> str:
        seen_formula_ids = set() if seen_formula_ids is None else set(seen_formula_ids)
        formula_id = id(self)
        if formula_id in seen_formula_ids:
            raise ValueError("Formula expansion cycle detected.")
        seen_formula_ids.add(formula_id)

        output_formula = self.text
        for alias in self.aliases or []:
            value = (
                "("
                + self.expand_variable(
                    root,
                    alias.name,
                    alias.path,
                    seen_formula_ids=seen_formula_ids,
                )
                + ")"
            )
            text_var = "@" + alias.name
            output_formula = output_formula.replace(text_var, value)
        return output_formula


@dataclass
class FormulaDefinition:
    id: str
    formula: Formula

    @classmethod
    def from_dict(cls, raw: dict) -> "FormulaDefinition":
        return cls(
            id=raw["id"],
            formula=Formula.from_dict(raw["formula"]),
        )
