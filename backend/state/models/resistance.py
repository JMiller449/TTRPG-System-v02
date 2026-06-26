from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Resistances:
    resistance: float = 0.0
    physical: float = 0.0
    magical: float = 0.0
    slashing: float = 0.0
    bludgeoning: float = 0.0
    piercing: float = 0.0
    arcane: float = 0.0
    fire: float = 0.0
    water: float = 0.0
    earth: float = 0.0
    wind: float = 0.0
    light: float = 0.0
    dark: float = 0.0
    lightning: float = 0.0
    ice: float = 0.0
    time: float = 0.0
    gravity: float = 0.0
    psychic: float = 0.0

    @classmethod
    def from_dict(cls, raw: dict | None) -> "Resistances":
        if raw is None:
            return cls()
        return cls(
            resistance=raw.get("resistance", 0.0),
            physical=raw.get("physical", 0.0),
            magical=raw.get("magical", 0.0),
            slashing=raw.get("slashing", 0.0),
            bludgeoning=raw.get("bludgeoning", 0.0),
            piercing=raw.get("piercing", 0.0),
            arcane=raw.get("arcane", 0.0),
            fire=raw.get("fire", 0.0),
            water=raw.get("water", 0.0),
            earth=raw.get("earth", 0.0),
            wind=raw.get("wind", 0.0),
            light=raw.get("light", 0.0),
            dark=raw.get("dark", 0.0),
            lightning=raw.get("lightning", 0.0),
            ice=raw.get("ice", 0.0),
            time=raw.get("time", 0.0),
            gravity=raw.get("gravity", 0.0),
            psychic=raw.get("psychic", 0.0),
        )
