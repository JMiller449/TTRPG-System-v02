from dataclasses import dataclass
from typing import Dict, List, Optional


# caster and target should be assumbed based on the instance thats casting and the one that being targeted
@dataclass
class Formula:
    aliases: Optional[Dict[str, List[str]]]
    """aliases to slot  into formula when in use \n\n
    'charStrength': ["caster", "stats", "strength"],\n
    'targetStrength': ["target", "strength"]
  """
    text: str
    """The formula directly with @variable \n\n ex: '1 + @charStrength * 5 - @targetHealth'"""
