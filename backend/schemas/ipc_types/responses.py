from dataclasses import dataclass
from typing import Literal, Union


@dataclass
class Error:
    message: str
    type: Literal["error"] = "error"


# Response to client
Responses = Union[Error]
