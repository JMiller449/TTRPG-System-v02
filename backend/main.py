from dataclasses import dataclass
import json
from typing import Literal, Union
from fastapi import FastAPI, WebSocket

app = FastAPI()


# TODO: make this specific to a union of objects
@dataclass
class Error:
    type: Literal["error"] = "error"
    message: str


Resposnes = Union[Error]


@dataclass
class Yap:
    type: Literal["yap"] = "yap"
    message: str


Requests = Union[Yap]


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        try:
            req_obj: Requests = json.load(data)
            match (req_obj.type):
                case "yap":
                    print(f"Yapper said {req_obj.message}")
        except:
            websocket.send_text(f"Invalid Request: {data}")
            return
        await websocket.send_text(f"Message text was: {data}")
