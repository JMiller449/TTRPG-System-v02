import json
from dataclasses import asdict

from fastapi import APIRouter, WebSocket

from backend.schemas.ipc_types.requests import CreatePlayer, Requests
from backend.schemas.ipc_types.responses import Error, StateSnapshot
from backend.state.game_logic import GameLogic

router = APIRouter()


# handles websocket implementation
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        try:
            payload = json.loads(data)
            msg_type = payload.get("type")
            match msg_type:
                case "yap":
                    print(f"Yapper said {payload.get('message')}")
                case "create_player":
                    req_obj: Requests = CreatePlayer(**payload)
                    GameLogic.create_player(req_obj)
                    players = GameLogic.state_snapshot_players()
                    response = StateSnapshot(
                        request_id=req_obj.request_id,
                        players=players,
                    )
                    await websocket.send_json(asdict(response))
                case _:
                    await websocket.send_json(
                        asdict(
                            Error(
                                message=f"Unknown request type: {msg_type}",
                            )
                        )
                    )
        except Exception:
            await websocket.send_json(
                asdict(
                    Error(
                        message=f"Invalid Request: {data}",
                    )
                )
            )
            return
