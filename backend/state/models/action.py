from dataclasses import dataclass, field
from typing import Literal

from backend.state.models.formula import Formula

ActionStepTarget = Literal["caster", "target"]


@dataclass
class SendMessageStep:
    step_id: str
    message: Formula
    type: Literal["send_message"] = "send_message"

    @classmethod
    def from_dict(cls, raw: dict) -> "SendMessageStep":
        return cls(
            step_id=raw["step_id"],
            message=Formula.from_dict(raw["message"]),
        )


@dataclass
class SetValueStep:
    step_id: str
    path: list[str]
    value: Formula
    target: ActionStepTarget = "caster"
    type: Literal["set_value"] = "set_value"

    @classmethod
    def from_dict(cls, raw: dict) -> "SetValueStep":
        return cls(
            step_id=raw["step_id"],
            path=list(raw["path"]),
            value=Formula.from_dict(raw["value"]),
            target=raw.get("target", "caster"),
        )


ActionStep = SendMessageStep | SetValueStep


@dataclass
class Action:
    id: str
    name: str
    notes: str = ""
    steps: list[ActionStep] = field(default_factory=list)

    @classmethod
    def from_dict(cls, raw: dict) -> "Action":
        steps: list[ActionStep] = []
        for raw_step in raw.get("steps", []):
            step_type = raw_step["type"]
            if step_type == "send_message":
                steps.append(SendMessageStep.from_dict(raw_step))
                continue
            if step_type == "set_value":
                steps.append(SetValueStep.from_dict(raw_step))
                continue
            raise ValueError(f"Unsupported action step type '{step_type}'.")

        return cls(
            id=raw["id"],
            name=raw["name"],
            notes=raw.get("notes", ""),
            steps=steps,
        )
