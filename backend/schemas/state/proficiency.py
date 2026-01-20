from dataclasses import dataclass


@dataclass
class ProficiencyBridge:
    relationship_id: str
    growth_rate: float
    use_count: int
    proficiency_id: str


@dataclass
class Proficiency:
    id: str
    name: str
    description: str
