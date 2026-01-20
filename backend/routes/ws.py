import json

from fastapi import APIRouter, WebSocket

from backend.schemas.ipc_types.requests import Requests
from backend.schemas.ipc_types.responses import Error

router = APIRouter()


# handles websocket implementation
@router.websocket("/ws")
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
            websocket.send_json(Error(f"Invalid Request: {data}"))
            return
