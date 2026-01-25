from dataclasses import dataclass, field
from typing import Dict, List
from backend.schemas.state.item import Item
from backend.schemas.state.sheet import PersistentSheet, Sheet
from backend.schemas.state.action import Action


@dataclass
class State:
    sheets: Dict[str, Sheet] = field(default_factory=dict)
    """ Characters sheets to be instanced off of """

    # Temp state for combat purposes
    instanced_sheets: Dict[str, PersistentSheet] = field(default_factory=dict)
    """Instanced sheets to spawn characters in based on stats and enemies in bulk"""
    actions_pending_reactions: Action
    """This should be similar to warhammer everyone await the one user to respond to(not the right type probably)"""
    turn_order_queue: List[str]
    """Instanced sheets queue for turns,can be extended to be an object for more info"""

    # global shared between sheets for sheets to bridge to
    actions: Dict[str, Action] = field(default_factory=dict)
    """ Global actions sheets refrences"""
    items: Dict[str, Item] = field(default_factory=dict)
    """ Global items sheets refrences"""
