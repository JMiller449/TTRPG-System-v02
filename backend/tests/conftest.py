from __future__ import annotations

import asyncio
from collections.abc import Iterator
from pathlib import Path

import pytest


@pytest.fixture(autouse=True)
def isolated_state_checkpoint(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[Path]:
    """Keep every test's checkpoint writes out of the developer's real state file.

    Tests reach ``StateSingleton.dumpState`` through any ``apply_mutation`` call.
    Without this redirection those writes land on the repo-root checkpoint and
    replace real campaign state with test fixtures.
    """
    from backend.state import store as store_module

    state_path = tmp_path / "state_dumpy.json"
    monkeypatch.setattr(store_module, "STATE_PATH", state_path)
    yield state_path


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
