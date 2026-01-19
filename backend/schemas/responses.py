from dataclasses import dataclass
from typing import Literal, Union


@dataclass
class Error:
    type: Literal["error"] = "error"
    message: str


# Response to client
Responses = Union[Error]
