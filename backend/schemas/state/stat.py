from dataclasses import dataclass


@dataclass
class Stat:
    id: str
    parent_id: str
    name: str
    formula: str
