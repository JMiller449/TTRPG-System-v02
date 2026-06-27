import asyncio
from copy import deepcopy

import pytest

from backend.features.session.service import websocket_sessions
from backend.features.state_sync.service import state_sync_service
from backend.routes.ws import handle_client_payload
from backend.state.models.sheet import InstancedSheet
from backend.state.store import DEFAULT_STATE, StateSingleton


class FakeWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.sent_messages: list[dict] = []

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, payload: dict) -> None:
        self.sent_messages.append(payload)


@pytest.fixture(autouse=True)
def reset_state() -> None:
    StateSingleton._state = deepcopy(DEFAULT_STATE)


def _add_instance(*, health: float = 100, mana: int = 30) -> None:
    StateSingleton.getState().instanced_sheets["rapid_instance"] = (
        InstancedSheet.from_dict(
            {
                "parent_id": "rapid_template",
                "health": health,
                "mana": mana,
                "augments": {},
            }
        )
    )


def _adjust_health_payload(index: int, delta: float) -> dict:
    return {
        "type": "adjust_instanced_sheet_resource",
        "instance_id": "rapid_instance",
        "resource": "health",
        "delta": delta,
        "request_id": f"rapid-{index}",
    }


async def _submit_concurrently(
    sockets: list[FakeWebSocket],
    *,
    start: int,
    count: int,
    delta: float,
) -> None:
    await asyncio.gather(
        *(
            handle_client_payload(
                sockets[offset % len(sockets)],
                _adjust_health_payload(start + offset, delta),
            )
            for offset in range(count)
        )
    )


def test_rapid_intents_from_multiple_clients_emit_one_ordered_patch_stream(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        _add_instance()
        await websocket_sessions.reset()

        senders = [FakeWebSocket() for _ in range(4)]
        observer = FakeWebSocket()
        for sender in senders:
            await websocket_sessions.connect(sender, role="dm")
        await websocket_sessions.connect(observer, role="player")

        await _submit_concurrently(senders, start=0, count=24, delta=-1)

        patches = observer.sent_messages
        assert len(patches) == 24
        assert all(patch["type"] == "state_patch" for patch in patches)
        assert [patch["state_version"] for patch in patches] == list(range(1, 25))
        assert {patch["request_id"] for patch in patches} == {
            f"rapid-{index}" for index in range(24)
        }
        assert [patch["ops"][0]["value"] for patch in patches] == list(
            range(99, 75, -1)
        )
        assert all(sender.sent_messages == patches for sender in senders)

        audit_entries = await state_sync_service.recent_mutations()
        assert [entry.state_version for entry in audit_entries] == list(range(1, 25))
        assert {entry.source.request_id for entry in audit_entries if entry.source} == {
            f"rapid-{index}" for index in range(24)
        }
        assert all(
            entry.source is not None
            and entry.source.request_type == "adjust_instanced_sheet_resource"
            and entry.source.actor_role == "dm"
            and entry.source.entity_id("instance_id") == "rapid_instance"
            and entry.operations == ("set",)
            and entry.paths
            == ("/instanced_sheets/rapid_instance/health",)
            for entry in audit_entries
        )

        snapshot = await state_sync_service.snapshot(role="dm")
        assert snapshot.state_version == 24
        assert snapshot.state["instanced_sheets"]["rapid_instance"]["health"] == 76
        assert StateSingleton.getState().instanced_sheets["rapid_instance"].health == 76

    asyncio.run(scenario())


def test_reconnect_replays_every_patch_after_last_seen_version(monkeypatch) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        _add_instance()
        await websocket_sessions.reset()

        sender = FakeWebSocket()
        disconnected_client = FakeWebSocket()
        await websocket_sessions.connect(sender, role="dm")
        await websocket_sessions.connect(disconnected_client, role="player")

        await _submit_concurrently([sender], start=0, count=10, delta=-1)
        assert [
            patch["state_version"] for patch in disconnected_client.sent_messages
        ] == list(range(1, 11))
        await websocket_sessions.disconnect(disconnected_client)

        await _submit_concurrently([sender], start=10, count=15, delta=-1)
        assert len(disconnected_client.sent_messages) == 10

        reconnected_client = FakeWebSocket()
        await websocket_sessions.connect(reconnected_client, role="player")
        await handle_client_payload(
            reconnected_client,
            {
                "type": "resync_state",
                "last_seen_version": 10,
                "request_id": "resync-after-gap",
            },
        )

        replay = reconnected_client.sent_messages
        assert len(replay) == 15
        assert [patch["state_version"] for patch in replay] == list(range(11, 26))
        assert all(patch["request_id"] == "resync-after-gap" for patch in replay)
        assert replay[-1]["ops"] == [
            {
                "op": "set",
                "path": "/instanced_sheets/rapid_instance/health",
                "value": 75,
            }
        ]
        assert StateSingleton.getState().instanced_sheets["rapid_instance"].health == 75

    asyncio.run(scenario())


def test_resync_falls_back_to_consistent_snapshot_after_patch_history_expires(
    monkeypatch,
) -> None:
    async def scenario() -> None:
        monkeypatch.setattr(StateSingleton, "dumpState", lambda: None)
        _add_instance()
        await websocket_sessions.reset()

        sender = FakeWebSocket()
        await websocket_sessions.connect(sender, role="dm")
        await _submit_concurrently([sender], start=0, count=260, delta=1)
        assert state_sync_service.current_version == 260
        sender.sent_messages.clear()

        await handle_client_payload(
            sender,
            {
                "type": "resync_state",
                "last_seen_version": 0,
                "request_id": "resync-expired-history",
            },
        )

        assert len(sender.sent_messages) == 1
        snapshot = sender.sent_messages[0]
        assert snapshot["type"] == "state_snapshot"
        assert snapshot["request_id"] == "resync-expired-history"
        assert snapshot["state_version"] == 260
        assert snapshot["state"]["instanced_sheets"]["rapid_instance"]["health"] == 360
        assert StateSingleton.getState().instanced_sheets["rapid_instance"].health == 360

    asyncio.run(scenario())
