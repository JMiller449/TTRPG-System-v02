from dataclasses import dataclass
from typing import Literal, Union


@dataclass
class Yap:
    message: str
    type: Literal["yap"] = "yap"


# Request from client
Requests = Union[Yap]
