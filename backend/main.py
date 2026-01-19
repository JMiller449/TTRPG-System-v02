import json
from typing import Union
from fastapi import FastAPI, WebSocket

app = FastAPI()

# TODO: make this specific to a union of objects
UserRequests = Union[str]

# TODO:


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        req_obj: UserRequests = json.load(data)
        await websocket.send_text(f"Message text was: {data}")
