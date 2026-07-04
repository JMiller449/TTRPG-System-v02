from __future__ import annotations

import argparse
import asyncio
import json
import os
from typing import Any

from websockets.asyncio.client import connect


def _required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required for websocket verification.")
    return value


async def _authenticate(
    url: str,
    token: str,
    *,
    expected_authenticated: bool,
    expected_role: str | None,
) -> None:
    async with connect(url, open_timeout=10, close_timeout=5) as websocket:
        await websocket.send(json.dumps({"type": "authenticate", "token": token}))
        raw_response = await asyncio.wait_for(websocket.recv(), timeout=10)
        response: Any = json.loads(raw_response)

        if not isinstance(response, dict) or response.get("type") != "authenticate_response":
            raise RuntimeError(f"Unexpected authentication response from {url}.")
        if response.get("authenticated") is not expected_authenticated:
            raise RuntimeError(f"Unexpected authentication result from {url}.")
        if response.get("role") != expected_role:
            raise RuntimeError(f"Unexpected authentication role from {url}.")


async def _verify(app_url: str, chat_url: str) -> None:
    player_code = _required_environment("PLAYER_JOIN_CODE")
    service_code = _required_environment("SERVICE_AUTH_CODE")

    await _authenticate(
        app_url,
        "player",
        expected_authenticated=False,
        expected_role=None,
    )
    await _authenticate(
        app_url,
        player_code,
        expected_authenticated=True,
        expected_role="player",
    )
    await _authenticate(
        chat_url,
        service_code,
        expected_authenticated=True,
        expected_role="service",
    )

    print(f"Verified application websocket: {app_url}")
    print(f"Verified Roll20 bridge websocket: {chat_url}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verify TTRPG application and Roll20 bridge websockets."
    )
    parser.add_argument("--app-url", required=True)
    parser.add_argument("--chat-url", required=True)
    arguments = parser.parse_args()
    asyncio.run(_verify(arguments.app_url, arguments.chat_url))


if __name__ == "__main__":
    main()
