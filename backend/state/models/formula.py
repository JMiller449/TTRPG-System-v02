from __future__ import annotations

from dataclasses import dataclass
from typing import Any, List, Optional, TYPE_CHECKING

from backend.state.models.proficiency import ProficiencyBridge

if TYPE_CHECKING:
    from backend.state.models.sheet import Sheet


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

    @classmethod
    def from_dict(cls, raw: dict) -> "Formula":
        aliases = raw.get("aliases")
        return cls(
            aliases=None
            if aliases is None
            else [FormulaAliases.from_dict(alias) for alias in aliases],
            text=raw["text"],
        )

    def _resolve_path_value(self, root: Sheet, var_name: str, var_path: List[str]) -> Any:
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
        root: Sheet,
        var_name: str,
        var_path: List[str],
        *,
        seen_formula_ids: set[int] | None = None,
    ) -> str:
        current_var = self._resolve_path_value(root, var_name, var_path)

        if isinstance(current_var, Formula):
            return current_var.expand_formula(root, seen_formula_ids=seen_formula_ids)
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
        root: Sheet,
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
            value = "(" + self.expand_variable(
                root,
                alias.name,
                alias.path,
                seen_formula_ids=seen_formula_ids,
            ) + ")"
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
