from __future__ import annotations

import asyncio
from collections.abc import Iterator

import pytest


@pytest.fixture(autouse=True)
def deterministic_request_ids(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    counter = {"value": 0}

    def _next_request_id() -> str:
        counter["value"] += 1
        return f"req-{counter['value']}"

    monkeypatch.setattr("backend.routes.ws.generate_request_id", _next_request_id)
    yield


@pytest.fixture(autouse=True)
def reset_state_sync_service() -> Iterator[None]:
    from backend.features.state_sync.service import state_sync_service

    asyncio.run(state_sync_service.reset())
    yield
