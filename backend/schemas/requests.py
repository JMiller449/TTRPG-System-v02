from dataclasses import dataclass
from typing import Literal, Union


@dataclass
class Yap:
    type: Literal["yap"] = "yap"
    message: str


# Request from client
Requests = Union[Yap]
