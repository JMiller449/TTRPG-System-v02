import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.routes.ws import router as ws_router
from backend.state.store import StateSingleton

DUMP_INTERVAL_SECONDS = 6000


async def _periodic_dump(stop_event: asyncio.Event) -> None:
    while True:
        try:
            await asyncio.wait_for(
                stop_event.wait(),
                timeout=DUMP_INTERVAL_SECONDS,
            )
            return
        except TimeoutError:
            pass
        StateSingleton.dumpState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    state = StateSingleton.initializeState()
    from backend.features.augmentations.service import (
        synchronize_equipment_augmentations_mutation,
    )

    if synchronize_equipment_augmentations_mutation(state):
        StateSingleton.dumpState()
    stop_event = asyncio.Event()
    task = asyncio.create_task(_periodic_dump(stop_event))
    try:
        yield
    finally:
        stop_event.set()
        await task
        StateSingleton.dumpState()


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan)
    app.include_router(ws_router)
    return app


app = create_app()
