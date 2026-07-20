from dataclasses import dataclass, fields


@dataclass
class CharacterProfile:
    species: str = ""
    background: str = ""
    alignment: str = ""
    pronouns: str = ""
    age: str = ""
    height: str = ""
    weight: str = ""
    eyes: str = ""
    skin: str = ""
    hair: str = ""
    appearance: str = ""
    personality_traits: str = ""
    ideals: str = ""
    bonds: str = ""
    flaws: str = ""
    allies_and_organizations: str = ""
    backstory: str = ""

    def __post_init__(self) -> None:
        for profile_field in fields(self):
            value = getattr(self, profile_field.name)
            if not isinstance(value, str):
                raise ValueError(
                    f"Character profile field '{profile_field.name}' must be text."
                )
            setattr(self, profile_field.name, value.strip())

    @classmethod
    def from_dict(cls, raw: dict | None) -> "CharacterProfile":
        if raw is None:
            return cls()
        if not isinstance(raw, dict):
            raise ValueError("Character profile must be an object.")
        return cls(
            **{
                profile_field.name: raw.get(profile_field.name, "")
                for profile_field in fields(cls)
            }
        )
