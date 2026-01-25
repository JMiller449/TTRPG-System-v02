from dataclasses import dataclass


@dataclass
class Proficiency:
    id: str
    name: str
    description: str
    use_count: int
    growth_rate: float
