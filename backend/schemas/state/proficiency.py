from dataclasses import dataclass


@dataclass
class ProficiencyBridge:
    relationship_id: str
    prof_id: str
    use_count: int
    growth_rate: float


@dataclass
class Proficiency:
    id: str
    name: str
    description: str
