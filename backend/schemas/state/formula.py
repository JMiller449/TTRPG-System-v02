from dataclasses import dataclass
from typing import Dict, List, Optional

from backend.schemas.state.proficiency import ProficiencyBridge
from backend.schemas.state.sheet import Sheet


@dataclass
class FormulaAliases:
    name: str
    path: List[str]


# caster and target should be assumed based on the instance thats casting and the one that being targeted
@dataclass
class Formula:
    aliases: Optional[List[FormulaAliases]]
    """aliases to slot  into formula when in use \n\n
    'charStrength': ["stats", "strength"]
  """
    text: str
    """The formula directly with @variable \n\n ex: '1 + @charStrength * 5 - @targetHealth'"""

    def expand_variable(self, caster: Sheet, var_name: str, var_path: List[str]) -> str:
        current_var = caster
        for idx, branch in enumerate(var_path):
            current_var = getattr(current_var, branch, None)
            if current_var is None:
                raise ValueError(
                    f"Branch '{branch}' which is idx {idx} on variable '{var_name}' does not exist"
                )
        if isinstance(current_var, Formula):
            return current_var.expand_formula(caster)
        elif isinstance(current_var, int) or isinstance(current_var, float):
            return str(current_var)
        elif isinstance(current_var, ProficiencyBridge):
            # TODO: add this proficiency to the the list of proficiencies that need to be upped at the end of this transaction
            prof_calc = current_var.growth_rate * current_var.use_count
            prof = min(prof_calc, 1)
            return str(prof)
        else:
            raise ValueError(
                "Given Invalid value which maps out to a "
                + str(current_var.__class__())
                + str(var_path)
            )

    def expand_formula(self, caster: Sheet) -> str:
        output_formula = self.text
        for alias in self.aliases:
            value = "(" + self.expand_variable(caster, alias.name, alias.path) + ")"
            text_var = "@" + alias.name
            output_formula.replace(text_var, value)
        return output_formula
