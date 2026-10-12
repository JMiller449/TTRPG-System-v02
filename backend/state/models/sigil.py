"""Persistent inscriptions; flat parent links preserve arbitrarily deep trees."""
from dataclasses import dataclass, field
from math import isfinite


@dataclass
class SigilCharge:
    action_id: str
    imbuer_instance_id: str
    action_signature: str
    mana_paid: int

    def __post_init__(self) -> None:
        if not self.action_id or not self.imbuer_instance_id or not self.action_signature:
            raise ValueError("Sigil charges require Action and imbuer identities.")
        if type(self.mana_paid) is not int or self.mana_paid < 0:
            raise ValueError("Paid sigil mana must be a nonnegative whole number.")

    @classmethod
    def from_dict(cls, raw: dict) -> "SigilCharge":
        return cls(**raw)


@dataclass
class SigilNode:
    id: str
    name: str
    diameter: float
    parent_id: str | None = None
    action_id: str | None = None
    mana_cost_step_ids: list[str] = field(default_factory=list)
    power_step_ids: list[str] = field(default_factory=list)
    charge: SigilCharge | None = None
    last_imbuer_instance_id: str | None = None

    def __post_init__(self) -> None:
        if not self.id or not self.name.strip():
            raise ValueError("Sigil nodes require an ID and name.")
        if isinstance(self.diameter, bool) or not isfinite(self.diameter) or self.diameter <= 0:
            raise ValueError("Sigil diameters must be finite and positive.")
        for values in (self.mana_cost_step_ids, self.power_step_ids):
            if len(values) != len(set(values)):
                raise ValueError("Duplicate sigil step references.")
        if set(self.mana_cost_step_ids) & set(self.power_step_ids):
            raise ValueError("Mana casting costs cannot also be power values.")
        if self.charge is not None and self.charge.action_id != self.action_id:
            raise ValueError("Sigil charge does not match its Action binding.")

    @classmethod
    def from_dict(cls, raw: dict) -> "SigilNode":
        values = dict(raw)
        values["charge"] = SigilCharge.from_dict(raw["charge"]) if raw.get("charge") else None
        return cls(**values)


@dataclass
class Sigil:
    id: str
    owner_instance_id: str
    nodes: list[SigilNode]
    access_instance_ids: list[str] = field(default_factory=list)
    item_relationship_id: str | None = None
    revision: int = 0

    def __post_init__(self) -> None:
        if not self.id or not self.owner_instance_id or not self.nodes:
            raise ValueError("Sigils require an ID, owner and root node.")
        if type(self.revision) is not int or self.revision < 0:
            raise ValueError("Sigil revisions must be nonnegative whole numbers.")
        by_id = {node.id: node for node in self.nodes}
        if len(by_id) != len(self.nodes):
            raise ValueError("Duplicate sigil node IDs.")
        if sum(node.parent_id is None for node in self.nodes) != 1:
            raise ValueError("Sigils require exactly one root node.")
        # Iterative coloring avoids recursion limits, including for imported trees.
        complete: set[str] = set()
        for node in self.nodes:
            visiting: set[str] = set()
            current: SigilNode | None = node
            while current is not None and current.id not in complete:
                if current.id in visiting:
                    raise ValueError("Sigil hierarchy contains a cycle.")
                visiting.add(current.id)
                if current.parent_id is not None and current.parent_id not in by_id:
                    raise ValueError("Sigil references a missing parent node.")
                current = by_id.get(current.parent_id)
            complete.update(visiting)
        if len(self.access_instance_ids) != len(set(self.access_instance_ids)):
            raise ValueError("Duplicate sigil access references.")

    @classmethod
    def from_dict(cls, raw: dict) -> "Sigil":
        values = dict(raw)
        values["nodes"] = [SigilNode.from_dict(node) for node in raw["nodes"]]
        return cls(**values)
