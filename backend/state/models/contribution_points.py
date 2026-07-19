from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


@dataclass(frozen=True)
class ContributionPointTransaction:
    id: str
    instance_id: str
    amount: int
    balance_after: int
    reason: str
    occurred_at: str
    actor_role: Literal["dm"] = "dm"

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ContributionPointTransaction":
        amount = raw["amount"]
        balance_after = raw["balance_after"]
        if (
            isinstance(amount, bool)
            or not isinstance(amount, int)
            or isinstance(balance_after, bool)
            or not isinstance(balance_after, int)
            or balance_after < 0
        ):
            raise ValueError("Contribution-point transactions must use whole nonnegative balances.")
        return cls(
            id=raw["id"],
            instance_id=raw["instance_id"],
            amount=amount,
            balance_after=balance_after,
            reason=raw.get("reason", ""),
            occurred_at=raw["occurred_at"],
            actor_role="dm",
        )
