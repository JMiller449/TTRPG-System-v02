from dataclasses import dataclass, field
from math import isfinite
from typing import List, Literal

from backend.state.models.augmentation import Augmentation
from backend.state.models.attribute import AttributeBridge
from backend.state.models.tag import normalize_tag_ids


@dataclass
class ItemPlayerCatalogAccess:
    mode: Literal["none", "all", "selected"] = "all"
    instance_ids: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.mode not in {"none", "all", "selected"}:
            raise ValueError("Item player catalog access mode is invalid.")
        if any(
            not isinstance(instance_id, str) or not instance_id
            for instance_id in self.instance_ids
        ):
            raise ValueError(
                "Item player catalog access IDs must be nonempty strings."
            )
        if len(self.instance_ids) != len(set(self.instance_ids)):
            raise ValueError("Item player catalog access IDs must be unique.")
        if self.mode != "selected" and self.instance_ids:
            raise ValueError(
                "Only selected item player catalog access can contain instance IDs."
            )

    def allows(self, instance_id: str | None) -> bool:
        return self.mode == "all" or (
            self.mode == "selected"
            and instance_id is not None
            and instance_id in self.instance_ids
        )

    @classmethod
    def from_dict(cls, raw: dict | None) -> "ItemPlayerCatalogAccess":
        raw = raw or {}
        return cls(
            mode=raw.get("mode", "all"),
            instance_ids=list(raw.get("instance_ids", [])),
        )


@dataclass
class ItemBridge:
    relationship_id: str
    count: int
    equipped: bool
    item_id: str
    parent_container_id: str | None = None

    @classmethod
    def from_dict(cls, raw: dict) -> "ItemBridge":
        return cls(
            relationship_id=raw["relationship_id"],
            count=raw["count"],
            equipped=raw.get("equipped", raw.get("active", False)),
            item_id=raw["item_id"],
            parent_container_id=raw.get("parent_container_id"),
        )


@dataclass(frozen=True)
class ItemActionGrant:
    action_id: str
    availability: Literal["carried", "equipped"]
    consume_quantity: int = 0

    @classmethod
    def from_dict(cls, raw: dict) -> "ItemActionGrant":
        return cls(
            action_id=raw["action_id"],
            availability=raw["availability"],
            consume_quantity=raw.get("consume_quantity", 0),
        )


@dataclass
class Item:
    id: str
    name: str
    interaction_type: Literal["equippable", "consumable", "inventory_only"]
    rank: str
    description: str
    world_anvil_url: str
    gm_notes: str
    gm_special_properties: str
    price: str
    weight: float  # pounds
    augmentation_templates: List[Augmentation]
    player_catalog_access: ItemPlayerCatalogAccess = field(
        default_factory=ItemPlayerCatalogAccess
    )
    approval_status: Literal["approved", "pending"] = "approved"
    submitted_by_instance_id: str | None = None
    submitted_by_name: str | None = None
    can_contain_items: bool = False
    storage_capacity_weight: float | None = None
    contents_weight_behavior: Literal["normal", "ignored"] = "normal"
    tags: list[str] = field(default_factory=list)
    action_grants: List[ItemActionGrant] = field(default_factory=list)
    attributes: dict[str, AttributeBridge] = field(default_factory=dict)

    @property
    def attribute_profile(self) -> str | None:
        """Compatibility view for callers predating managed item tags."""
        return "weapon" if "weapon" in self.tags else None

    @attribute_profile.setter
    def attribute_profile(self, value: str | None) -> None:
        """Map legacy profile mutations onto the managed weapon tag."""
        if value == "weapon":
            self.tags = normalize_tag_ids([*self.tags, "weapon"])
        else:
            self.tags = [tag_id for tag_id in self.tags if tag_id != "weapon"]

    def __post_init__(self) -> None:
        if isinstance(self.weight, bool) or not isinstance(self.weight, int | float):
            raise ValueError("Item weight must be numeric.")
        self.weight = float(self.weight)
        if not isfinite(self.weight) or self.weight < 0:
            raise ValueError("Item weight must be finite and nonnegative.")
        if self.storage_capacity_weight is not None:
            if (
                isinstance(self.storage_capacity_weight, bool)
                or not isinstance(self.storage_capacity_weight, int | float)
            ):
                raise ValueError("Storage capacity weight must be numeric or null.")
            self.storage_capacity_weight = float(self.storage_capacity_weight)
            if (
                not isfinite(self.storage_capacity_weight)
                or self.storage_capacity_weight < 0
            ):
                raise ValueError(
                    "Storage capacity weight must be finite and nonnegative."
                )
        if (
            not self.can_contain_items
            and (
                self.contents_weight_behavior != "normal"
                or self.storage_capacity_weight is not None
            )
        ):
            raise ValueError(
                "Only storage containers can define capacity or contained-weight behavior."
            )
        self.tags = normalize_tag_ids(self.tags)

    @classmethod
    def from_dict(cls, raw: dict) -> "Item":
        raw_attributes = raw.get("attributes", raw.get("facts", {}))
        tags = list(raw.get("tags", []))
        if raw.get("attribute_profile") == "weapon":
            tags.append("weapon")
        access = raw.get("player_catalog_access")
        if not isinstance(access, dict):
            access = {
                "mode": "all" if bool(raw.get("player_visible", True)) else "none",
                "instance_ids": [],
            }
        return cls(
            id=raw["id"],
            name=raw["name"],
            interaction_type=raw.get("interaction_type", "inventory_only"),
            rank=raw.get("rank", ""),
            description=raw["description"],
            world_anvil_url=raw.get("world_anvil_url", ""),
            gm_notes=raw.get("gm_notes", ""),
            gm_special_properties=raw.get("gm_special_properties", ""),
            price=raw["price"],
            weight=float(raw.get("weight", 0)),
            player_catalog_access=ItemPlayerCatalogAccess.from_dict(access),
            approval_status=raw.get("approval_status", "approved"),
            submitted_by_instance_id=raw.get("submitted_by_instance_id"),
            submitted_by_name=raw.get("submitted_by_name"),
            can_contain_items=bool(raw.get("can_contain_items", False)),
            storage_capacity_weight=raw.get("storage_capacity_weight"),
            contents_weight_behavior=raw.get("contents_weight_behavior", "normal"),
            tags=tags,
            augmentation_templates=[
                Augmentation.from_dict(augmentation)
                for augmentation in raw.get("augmentation_templates", [])
            ],
            action_grants=[
                ItemActionGrant.from_dict(grant)
                for grant in raw.get("action_grants", [])
            ],
            attributes={
                key: AttributeBridge.from_dict(bridge)
                for key, bridge in raw_attributes.items()
            },
        )
