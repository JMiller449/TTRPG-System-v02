from contextlib import asynccontextmanager
import asyncio
from backend.state.store import StateSingleton
from backend.routes.ws import router as ws_router
from fastapi import FastAPI

DUMP_INTERVAL_SECONDS = 600


async def _periodic_dump(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        await asyncio.sleep(DUMP_INTERVAL_SECONDS)
        StateSingleton.dumpState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    StateSingleton.initializeState()
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
