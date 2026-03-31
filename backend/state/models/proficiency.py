from dataclasses import dataclass


@dataclass
class ProficiencyBridge:
    relationship_id: str
    prof_id: str
    use_count: int
    growth_rate: float

    @classmethod
    def from_dict(cls, raw: dict) -> "ProficiencyBridge":
        return cls(
            relationship_id=raw["relationship_id"],
            prof_id=raw["prof_id"],
            use_count=raw["use_count"],
            growth_rate=raw["growth_rate"],
        )


@dataclass
class Proficiency:
    id: str
    name: str
    description: str

    @classmethod
    def from_dict(cls, raw: dict) -> "Proficiency":
        return cls(
            id=raw["id"],
            name=raw["name"],
            description=raw["description"],
        )
