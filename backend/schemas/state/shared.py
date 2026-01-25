from dataclasses import dataclass


@dataclass
class Bridge:
    relationship_id: str # an ID to reference this Bridge
    entry_id: str # points to a dataclass with the info being 'bridged to'
