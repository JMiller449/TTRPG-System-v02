from dataclasses import dataclass


@dataclass
class EnemyBridge:
    relationship_id: str
    enemy_id: str
    count: int


@dataclass
class Enemy:
    id: str
    name: str
    desc: str
    xp_given: int
