import asyncio

from backend.core import main


def test_periodic_dump_task_stops_without_waiting_for_interval(monkeypatch) -> None:
    async def scenario() -> None:
        dumps: list[str] = []
        monkeypatch.setattr(main.StateSingleton, "dumpState", lambda: dumps.append("dump"))

        stop_event = asyncio.Event()
        task = asyncio.create_task(main._periodic_dump(stop_event))
        await asyncio.sleep(0)
        stop_event.set()

        await asyncio.wait_for(task, timeout=0.1)
        assert dumps == []

    asyncio.run(scenario())
